/**
 * Die Ablage von Better Fit: `<datenordner>/fit.json`, getrennt von `db.json`.
 *
 * `GET /v1/db` gibt jeder App alles — Gewicht, Mahlzeiten und Allergien
 * gehoeren nicht dorthin. Hier gilt stattdessen die Regel einer Row Level
 * Security: eine Route bekommt nie die Tabellen, sondern nur `forOwner(id)`,
 * und diese Sicht liest und aendert ausschliesslich Zeilen mit `ownerId === id`.
 *
 * Aenderungen laufen in `transact`: auf einer Kopie, der Reihe nach, und erst
 * wenn alles geklappt hat, wird die Kopie zum Stand und landet auf der Platte.
 * Wirft der Ablauf, bleibt der alte Stand — das ist das „atomar“ aus dem Plan.
 *
 * Jede Aenderung einer persoenlichen Zeile landet im `changeLog` (vorher und
 * nachher), damit sie nachvollziehbar und korrigierbar bleibt.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { applyRetention } = require('./retention.js');

/** Tabellen mit persoenlichen Daten — jede Zeile traegt `ownerId`. */
const PERSONAL = [
  'profiles',
  'customFoods',
  'recipes',
  'pantryItems',
  'mealPlans',
  'shoppingLists',
  'meals',
  'mealAnalyses',
  'weightEntries',
  'workoutPlans',
  'scheduledWorkouts',
  'workoutLogs',
  'coachMessages',
  'coachActions',
  'usageLedger',
  'idempotency',
  'changeLog',
];

/** Gemeinsam und ohne Personenbezug: der Zwischenspeicher fuer Barcode und USDA. */
const SHARED = ['foodCache'];

/** Diese Tabellen schreiben kein Protokoll — sie sind selbst eines. */
const UNLOGGED = new Set(['changeLog', 'usageLedger', 'idempotency', 'mealAnalyses', 'coachMessages']);
const MAX_LOG_PER_OWNER = 500;

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`;
}

function emptyTables() {
  return Object.fromEntries([...PERSONAL, ...SHARED].map((name) => [name, []]));
}

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

class OwnerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'OwnerError';
    this.code = code;
  }
}

/**
 * Die Sicht eines Kontos auf die Tabellen. Es gibt keinen Weg an ihr vorbei:
 * `ownerId` setzt sie selbst, und eine Zeile eines anderen Kontos existiert
 * fuer sie schlicht nicht.
 */
function ownerView(tables, ownerId, log) {
  if (typeof ownerId !== 'string' || ownerId.length === 0) throw new OwnerError('owner_required');

  const table = (name) => {
    if (!PERSONAL.includes(name)) throw new OwnerError('not_personal');
    return tables[name];
  };
  const mine = (row) => row.ownerId === ownerId;

  function record(name, action, before, after, meta) {
    if (UNLOGGED.has(name) || !log) return;
    tables.changeLog.push({
      id: newId('chg'),
      ownerId,
      at: new Date().toISOString(),
      table: name,
      rowId: (after ?? before).id,
      action,
      before: clone(before) ?? null,
      after: clone(after) ?? null,
      reason: meta?.reason ?? null,
      undoneAt: null,
    });
    const own = tables.changeLog.filter(mine);
    if (own.length > MAX_LOG_PER_OWNER) {
      const drop = new Set(own.slice(0, own.length - MAX_LOG_PER_OWNER).map((row) => row.id));
      tables.changeLog = tables.changeLog.filter((row) => !drop.has(row.id));
    }
  }

  return {
    ownerId,
    list(name, where = () => true) {
      return table(name)
        .filter((row) => mine(row) && where(row))
        .map(clone);
    },
    get(name, id) {
      const row = table(name).find((entry) => entry.id === id && mine(entry));
      return clone(row) ?? null;
    },
    insert(name, row, meta) {
      const next = { ...clone(row), id: row.id ?? newId(name.slice(0, 3)), ownerId };
      table(name).push(next);
      record(name, 'insert', null, next, meta);
      return clone(next);
    },
    update(name, id, patch, meta) {
      const rows = table(name);
      const index = rows.findIndex((entry) => entry.id === id && mine(entry));
      if (index < 0) return null;
      const before = rows[index];
      // Besitzer und Id wechseln nie — was ein Patch dort mitbringt, zaehlt nicht.
      const next = { ...before, ...clone(patch), id: before.id, ownerId };
      rows[index] = next;
      record(name, 'update', before, next, meta);
      return clone(next);
    },
    /** Die ganze Zeile ersetzen (Rueckgaengig: exakt der Vorzustand, ohne spaetere Felder). */
    replace(name, id, row, meta) {
      const rows = table(name);
      const index = rows.findIndex((entry) => entry.id === id && mine(entry));
      if (index < 0) return null;
      const before = rows[index];
      const next = { ...clone(row), id: before.id, ownerId };
      rows[index] = next;
      record(name, 'update', before, next, meta);
      return clone(next);
    },
    remove(name, id, meta) {
      const rows = table(name);
      const index = rows.findIndex((entry) => entry.id === id && mine(entry));
      if (index < 0) return false;
      const [before] = rows.splice(index, 1);
      record(name, 'remove', before, null, meta);
      return true;
    },
    /** Alle Zeilen des Kontos in allen Tabellen — fuer das Loeschen des Kontos. */
    removeEverything() {
      for (const name of PERSONAL) tables[name] = tables[name].filter((row) => !mine(row));
    },
  };
}

/** Die Ablage ist kaputt und wurde beiseitegelegt: nichts mehr schreiben, bis jemand nachsieht. */
class StoreUnavailableError extends Error {
  constructor() {
    super('store_unavailable');
    this.name = 'StoreUnavailableError';
    this.code = 'store_unavailable';
    this.status = 503;
  }
}

function createFitStore({ dataDir, now = () => Date.now() }) {
  const file = path.join(dataDir, 'fit.json');
  let tables = null;
  let broken = false;
  let queue = Promise.resolve();

  async function load() {
    if (tables) return tables;
    const next = emptyTables();
    let text = null;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch {
      // Keine Datei: leer anfangen.
    }
    if (text !== null) {
      try {
        const parsed = JSON.parse(text);
        for (const name of Object.keys(next)) {
          if (Array.isArray(parsed?.tables?.[name])) next[name] = parsed.tables[name];
        }
      } catch {
        // Kaputt: nie still leer ueberschreiben. Eine Abschrift beiseitelegen und
        // jedes Schreiben verweigern (503), bis die Datei von Hand repariert ist.
        broken = true;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        await fs.copyFile(file, `${file}.corrupt-${stamp}`).catch(() => {});
      }
    }
    tables = next;
    return tables;
  }

  async function persist(snapshot) {
    await fs.mkdir(dataDir, { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify({ version: 1, tables: snapshot }), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await fs.rename(temp, file);
  }

  /**
   * Eine Aenderung als Ganzes. `work(tx)` bekommt `tx.forOwner(id)` und
   * `tx.shared(name)`; was es zurueckgibt, kommt zurueck. Wirft es, bleibt alles.
   */
  function transact(work) {
    const run = queue.then(async () => {
      const current = await load();
      if (broken) throw new StoreUnavailableError();
      const draft = clone(current);
      const tx = {
        forOwner: (ownerId) => ownerView(draft, ownerId, true),
        shared: (name) => {
          if (!SHARED.includes(name)) throw new OwnerError('not_shared');
          return draft[name];
        },
        // Nur die Zahl ueber alle Konten, wie `sumAll` — fuer das Budget in derselben Transaktion.
        sumAll: (name, field, where = () => true) => (draft[name] ?? []).filter(where).reduce((total, row) => total + (Number(row[field]) || 0), 0),
      };
      const result = await work(tx);
      // Obergrenzen je Konto (Coach, Analysen, Ledger, Zwischenspeicher) — siehe retention.js.
      applyRetention(draft, now());
      await persist(draft);
      tables = draft;
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  /** Nur lesen: dieselbe Sicht, aber auf einer Kopie, die niemand speichert. */
  async function read(work) {
    await queue;
    const current = clone(await load());
    return work({
      forOwner: (ownerId) => ownerView(current, ownerId, false),
      shared: (name) => {
        if (!SHARED.includes(name)) throw new OwnerError('not_shared');
        return current[name];
      },
    });
  }

  /**
   * Eine Summe ueber alle Konten — fuer das Monatsbudget. Gibt nur die Zahl
   * heraus, nie Zeilen: so bleibt es bei der Regel, dass niemand fremde Daten sieht.
   */
  async function sumAll(name, field, where = () => true) {
    await queue;
    const rows = (await load())[name] ?? [];
    return rows.filter(where).reduce((total, row) => total + (Number(row[field]) || 0), 0);
  }

  /** Nur fuer die Auswertung im Admin: ueber alle Zeilen falten, heraus kommt nur das Ergebnis. */
  async function fold(name, reducer, initial) {
    await queue;
    return ((await load())[name] ?? []).reduce(reducer, initial);
  }

  return { transact, read, sumAll, fold, isBroken: () => broken };
}

module.exports = { createFitStore, ownerView, newId, PERSONAL, SHARED, OwnerError, StoreUnavailableError };
