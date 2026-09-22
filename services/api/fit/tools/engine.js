/**
 * Bestaetigte Aktionen (Masterplan §16, §17): nichts aendert sich, weil jemand
 * — die App oder der Coach — es behauptet.
 *
 *   1. vorschlagen   `propose(tool, args)`  -> Vorschau, gespeichert als `proposed`
 *   2. zeigen        die App zeigt `preview.summary` und `preview.changes`
 *   3. bestaetigen   `confirm(id)`: die Vorschau wird neu gerechnet; weicht sie ab,
 *                    gilt nichts (`stale`) und die neue Vorschau kommt zurueck
 *   4. speichern     `apply` laeuft in derselben Transaktion — ganz oder gar nicht
 *   5. melden        `result` beschreibt, was tatsaechlich gespeichert ist
 *
 * Ein Werkzeug: `{ name, kind: 'read' | 'write', validate(args), preview(env, args),
 * apply(env, args, preview), run(env, args) }`.
 */

const ACTION_TTL_MS = 24 * 60 * 60 * 1000;
/** So gross duerfen die Angaben einer Aktion sein, wie sie in `coachActions` landen. */
const MAX_ARGS_BYTES = 64 * 1024;

const sizeOf = (value) => {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  } catch {
    return Infinity;
  }
};

/** Bricht eine Transaktion ab: `store.transact` verwirft dann die ganze Kopie. */
class Rollback extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function createEngine(ctx, tools) {
  const { store, ok } = ctx;
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  /** Alles, was ein Werkzeug braucht, fuer eine Person in einer Transaktion. */
  async function envOf(tx, accountId) {
    const own = tx.forOwner(accountId);
    const profileRow = own.list('profiles')[0] ?? null;
    const today = ctx.todayIn(profileRow?.profile?.timezone, ctx.now());
    return { ctx, tx, own, accountId, profileRow, profile: profileRow?.profile ?? null, today };
  }

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  async function propose(accountId, name, rawArgs, origin = 'app') {
    const tool = byName.get(name);
    if (!tool || tool.kind !== 'write') return ok(400, { error: 'tool_unknown' });
    // Zu gross wird nie geprueft und nie gespeichert — weder roh noch bereinigt.
    if (sizeOf(rawArgs) > MAX_ARGS_BYTES) return ok(413, { error: 'args_too_large' });
    const checked = tool.validate(rawArgs ?? {});
    if (!checked.ok) return ok(400, { error: checked.error ?? 'args_invalid', details: checked.details });
    if (sizeOf(checked.args) > MAX_ARGS_BYTES) return ok(413, { error: 'args_too_large' });
    return store.transact(async (tx) => {
      const env = await envOf(tx, accountId);
      const preview = await tool.preview(env, checked.args);
      if (!preview.ok) return ok(409, { error: preview.error, details: preview.details ?? null });
      // Offene Vorschlaege desselben Werkzeugs mit denselben Angaben ersetzen statt stapeln.
      for (const old of env.own.list('coachActions', (row) => row.status === 'proposed' && row.tool === name && same(row.args, checked.args))) {
        env.own.update('coachActions', old.id, { status: 'expired', decidedAt: ctx.now().toISOString() });
      }
      const action = env.own.insert('coachActions', {
        tool: name,
        args: checked.args,
        preview,
        status: 'proposed',
        origin,
        createdAt: ctx.now().toISOString(),
        expiresAt: new Date(ctx.now().getTime() + ACTION_TTL_MS).toISOString(),
        decidedAt: null,
        result: null,
      });
      return ok(201, { action });
    });
  }

  async function confirm(accountId, id) {
    try {
      return await confirmInside(accountId, id);
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
      // Die Transaktion ist verworfen — nichts Halbes ist gespeichert. Nur das Scheitern wird vermerkt.
      await store.transact((tx) => {
        tx.forOwner(accountId).update('coachActions', id, { status: 'failed', decidedAt: ctx.now().toISOString(), result: { error: error.code } });
      });
      return ok(409, { error: error.code });
    }
  }

  async function confirmInside(accountId, id) {
    return store.transact(async (tx) => {
      const env = await envOf(tx, accountId);
      const action = env.own.get('coachActions', id);
      if (!action) return ok(404, { error: 'not_found' });
      if (action.status === 'confirmed') return ok(200, { action });
      if (action.status !== 'proposed') return ok(409, { error: `action_${action.status}` });
      if (Date.parse(action.expiresAt) < ctx.now().getTime()) {
        env.own.update('coachActions', id, { status: 'expired', decidedAt: ctx.now().toISOString() });
        return ok(409, { error: 'action_expired' });
      }
      const tool = byName.get(action.tool);
      const fresh = await tool.preview(env, action.args);
      // Hat sich seit dem Vorschlag etwas geaendert, wird nichts gespeichert.
      if (!fresh.ok || !same(fresh.changes, action.preview.changes)) {
        env.own.update('coachActions', id, { status: 'expired', decidedAt: ctx.now().toISOString() });
        return ok(409, { error: 'stale', preview: fresh.ok ? fresh : null });
      }
      const applied = await tool.apply(env, action.args, fresh);
      if (!applied.ok) throw new Rollback(applied.error);
      const next = env.own.update('coachActions', id, { status: 'confirmed', decidedAt: ctx.now().toISOString(), result: applied.result });
      return ok(200, { action: next });
    });
  }

  async function reject(accountId, id) {
    return store.transact((tx) => {
      const own = tx.forOwner(accountId);
      const action = own.get('coachActions', id);
      if (!action) return ok(404, { error: 'not_found' });
      if (action.status !== 'proposed') return ok(409, { error: `action_${action.status}` });
      return ok(200, { action: own.update('coachActions', id, { status: 'rejected', decidedAt: ctx.now().toISOString() }) });
    });
  }

  /** Ein Lese-Werkzeug ausfuehren — aendert nie etwas. */
  async function read(accountId, name, rawArgs) {
    const tool = byName.get(name);
    if (!tool || tool.kind !== 'read') return { ok: false, error: 'tool_unknown' };
    const checked = tool.validate(rawArgs ?? {});
    if (!checked.ok) return { ok: false, error: checked.error ?? 'args_invalid' };
    return store.read(async (tx) => tool.run(await envOf(tx, accountId), checked.args));
  }

  return { propose, confirm, reject, read, tools: byName };
}

module.exports = { createEngine };
