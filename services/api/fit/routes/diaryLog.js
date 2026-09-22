/**
 * Gewicht, Anpassung der Ziele, Aenderungsprotokoll mit Rueckgaengig und das
 * Loeschen aller Daten — die Routen neben dem Tagebuch (`diary.js`).
 */
const { suggestAdjustment, weightTrend } = require('../goals.js');
const { goalsOf } = require('../diary.js');

function logRoutes(ctx) {
  const { ok, store } = ctx;
  const read = (auth, work) => store.read((tx) => work(tx.forOwner(auth.accountId), tx));
  const write = (auth, work) => store.transact((tx) => work(tx.forOwner(auth.accountId), tx));
  const dayOf = (value, own) => {
    if (ctx.isDay(value)) return value;
    const profile = own?.list('profiles')[0]?.profile;
    return ctx.todayIn(profile?.timezone, ctx.now());
  };

  return [
    {
      method: 'GET',
      path: /^\/v1\/fit\/weights$/,
      handler: ({ auth }) =>
        read(auth, (own) => {
          const entries = own.list('weightEntries').sort((a, b) => a.day.localeCompare(b.day));
          const profileRow = own.list('profiles')[0];
          const today = ctx.todayIn(profileRow?.profile?.timezone, ctx.now());
          return ok(200, {
            entries,
            trend: weightTrend(entries),
            suggestion: profileRow ? suggestAdjustment(profileRow.profile, entries, today) : null,
            kcalAdjustment: profileRow?.kcalAdjustment ?? 0,
          });
        }),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/weights$/,
      body: true,
      handler: ({ auth, body }) => {
        const weightKg = Number(body.weightKg);
        if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 350)
          return ok(400, { error: 'weight_invalid' });
        return write(auth, (own) => {
          const day = dayOf(body.day, own);
          const rounded = Math.round(weightKg * 10) / 10;
          const existing = own.list('weightEntries', (row) => row.day === day)[0];
          const entry = existing
            ? own.update('weightEntries', existing.id, { weightKg: rounded })
            : own.insert('weightEntries', {
                day,
                weightKg: rounded,
                createdAt: ctx.now().toISOString(),
              });
          return ok(existing ? 200 : 201, { entry });
        });
      },
    },
    {
      method: 'DELETE',
      path: /^\/v1\/fit\/weights\/([^/]+)$/,
      handler: ({ auth, params: [id] }) =>
        write(auth, (own) =>
          own.remove('weightEntries', id) ? ok(200, { ok: true }) : ok(404, { error: 'not_found' }),
        ),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/goals\/adjustment$/,
      body: true,
      handler: ({ auth, body }) =>
        write(auth, (own) => {
          const profileRow = own.list('profiles')[0];
          if (!profileRow) return ok(409, { error: 'profile_required' });
          const wanted = Number(body.kcal);
          if (wanted !== 0) {
            // Bestaetigt wird genau der Vorschlag des Dienstes, keine freie Zahl.
            const suggestion = suggestAdjustment(
              profileRow.profile,
              own.list('weightEntries'),
              ctx.todayIn(profileRow.profile.timezone, ctx.now()),
            );
            if (!suggestion || suggestion.kcal !== wanted)
              return ok(409, { error: 'suggestion_changed', suggestion });
          }
          const next =
            wanted === 0
              ? 0
              : Math.max(-300, Math.min(300, (profileRow.kcalAdjustment ?? 0) + wanted));
          const row = own.update(
            'profiles',
            profileRow.id,
            { kcalAdjustment: next },
            { reason: 'weight_trend' },
          );
          return ok(200, { goals: goalsOf(ctx, row, null, own), kcalAdjustment: next });
        }),
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/changes$/,
      handler: ({ auth, url }) =>
        read(auth, (own) => {
          const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 30));
          const table = url.searchParams.get('table');
          const rows = own
            .list('changeLog', (row) => !table || row.table === table)
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, limit);
          return ok(200, { changes: rows });
        }),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/changes\/([^/]+)\/undo$/,
      handler: ({ auth, params: [id] }) =>
        write(auth, (own) => {
          const change = own.get('changeLog', id);
          if (!change) return ok(404, { error: 'not_found' });
          if (change.undoneAt) return ok(409, { error: 'already_undone' });
          const current = own.get(change.table, change.rowId);
          const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
          // Nur zuruecknehmen, was seither niemand mehr angefasst hat.
          if (change.action === 'insert') {
            if (!current || !same(current, change.after))
              return ok(409, { error: 'changed_since' });
            own.remove(change.table, change.rowId, { reason: 'undo' });
          } else if (change.action === 'update') {
            if (!current || !same(current, change.after))
              return ok(409, { error: 'changed_since' });
            // Die ganze Zeile, nicht zusammengefuehrt: Felder, die erst die Aenderung brachte, gehen mit.
            own.replace(change.table, change.rowId, change.before, { reason: 'undo' });
          } else {
            if (current) return ok(409, { error: 'changed_since' });
            own.insert(change.table, change.before, { reason: 'undo' });
          }
          own.update('changeLog', id, { undoneAt: ctx.now().toISOString() });
          return ok(200, { ok: true });
        }),
    },
    {
      method: 'DELETE',
      path: /^\/v1\/fit\/data$/,
      body: true,
      handler: async ({ auth, body }) => {
        if (body.confirm !== 'DELETE') return ok(400, { error: 'confirm_required' });
        // Auch die Bilder: behaltene und die, die noch auf ein zweites Foto warten.
        const pending = await read(auth, (own) =>
          own.list('mealAnalyses').flatMap((row) => row.tempImages ?? []),
        );
        await ctx.images.remove(pending);
        await ctx.images.removeKept(auth.accountId);
        return write(auth, (own) => {
          own.removeEverything();
          return ok(200, { ok: true });
        });
      },
    },
  ];
}

module.exports = { logRoutes };
