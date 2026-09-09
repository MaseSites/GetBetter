import { notifyDataChanged } from './live';
import { serviceUrl } from './service';
import { COLLECTION_NAMES, type CollectionName, type Row, type Schema } from './types';

/**
 * Die Daten liegen in der gemeinsamen Datenbank (`services/api`), nicht mehr
 * je App auf dem Geraet. Hier drin bleibt eine Abschrift im Arbeitsspeicher:
 * gelesen wird daraus, geschrieben wird gebuendelt zurueck.
 *
 * Weil alle Better-Apps denselben Dienst benutzen, sieht BetterFamily, was
 * GetBetter eintraegt. Damit das ohne Neuladen auffaellt, fragt der Speicher
 * regelmaessig nach der Fassungsnummer und laedt bei Bedarf neu.
 */
type Tables = { [K in CollectionName]: Schema[K][] };

let tables: Tables | null = null;
let loading: Promise<Tables> | null = null;

/** Fassungsnummer des Dienstes beim letzten Laden. */
let revision = -1;
/** Ohne erfolgreiches Laden wird nichts zurueckgeschrieben — sonst leeren wir sie. */
let loaded = false;

const dirty = new Set<CollectionName>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** So oft fragen wir nach, ob eine andere App etwas geaendert hat. */
const POLL_MS = 4000;

export class DatabaseUnreachable extends Error {
  constructor() {
    super('Die Datenbank ist nicht erreichbar.');
    this.name = 'DatabaseUnreachable';
  }
}

function emptyTables(): Tables {
  return {
    accounts: [],
    households: [],
    householdMembers: [],
    calendars: [],
    calendarMembers: [],
    calendarShares: [],
    appAccess: [],
    events: [],
    tasks: [],
    notes: [],
    shoppingItems: [],
    chores: [],
    alarms: [],
  };
}

type Snapshot = { revision: number; tables: Partial<Tables> };

async function fetchSnapshot(): Promise<Snapshot> {
  const response = await fetch(`${serviceUrl()}/v1/db`);
  if (!response.ok) throw new DatabaseUnreachable();
  return (await response.json()) as Snapshot;
}

function apply(snapshot: Snapshot): Tables {
  const next = emptyTables();
  for (const name of COLLECTION_NAMES) {
    const rows = snapshot.tables[name];
    if (Array.isArray(rows)) next[name] = rows as never;
  }
  revision = snapshot.revision;
  tables = next;
  loaded = true;
  return next;
}

async function load(): Promise<Tables> {
  if (tables) return tables;
  if (!loading) {
    loading = (async () => {
      try {
        const result = apply(await fetchSnapshot());
        startPolling();
        return result;
      } catch {
        // Beim naechsten Versuch neu anfragen, statt leer weiterzulaufen.
        loading = null;
        throw new DatabaseUnreachable();
      }
    })();
  }
  return loading;
}

/** Holt die Daten neu, wenn eine andere App etwas geschrieben hat. */
async function poll(): Promise<void> {
  if (!loaded || dirty.size > 0) return;
  try {
    const response = await fetch(`${serviceUrl()}/v1/revision`);
    if (!response.ok) return;
    const { revision: latest } = (await response.json()) as { revision: number };
    if (latest === revision) return;
    apply(await fetchSnapshot());
    notifyDataChanged();
  } catch {
    // Der Dienst ist gerade weg; die Abschrift bleibt stehen.
  }
}

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => void poll(), POLL_MS);
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 60);
}

/** Schreibt die veraenderten Sammlungen zurueck. */
export async function flush(): Promise<void> {
  if (!tables || !loaded || dirty.size === 0) return;
  const pending = [...dirty];
  dirty.clear();

  for (const name of pending) {
    try {
      const response = await fetch(`${serviceUrl()}/v1/db/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: tables[name] }),
      });
      if (!response.ok) throw new DatabaseUnreachable();
      const { revision: latest } = (await response.json()) as { revision: number };
      revision = latest;
    } catch {
      // Beim naechsten Schreiben erneut versuchen.
      dirty.add(name);
      scheduleFlush();
      return;
    }
  }
}

function markDirty(name: CollectionName): void {
  dirty.add(name);
  scheduleFlush();
}

export type Query<T> = {
  where?: (row: T) => boolean;
  sort?: (a: T, b: T) => number;
  limit?: number;
};

/** Eine Sammlung. Gelesen wird aus der Abschrift, geschrieben in die Datenbank. */
export class Collection<K extends CollectionName> {
  constructor(private readonly name: K) {}

  private async rows(): Promise<Schema[K][]> {
    const all = await load();
    return all[this.name];
  }

  async list(query: Query<Schema[K]> = {}): Promise<Schema[K][]> {
    const rows = await this.rows();
    let result = query.where ? rows.filter(query.where) : [...rows];
    if (query.sort) result.sort(query.sort);
    if (query.limit !== undefined) result = result.slice(0, query.limit);
    return result;
  }

  async count(where?: (row: Schema[K]) => boolean): Promise<number> {
    const rows = await this.rows();
    return where ? rows.filter(where).length : rows.length;
  }

  async find(id: string): Promise<Schema[K] | undefined> {
    const rows = await this.rows();
    return rows.find((row) => row.id === id);
  }

  async findBy(where: (row: Schema[K]) => boolean): Promise<Schema[K] | undefined> {
    const rows = await this.rows();
    return rows.find(where);
  }

  async insert(row: Schema[K]): Promise<Schema[K]> {
    const rows = await this.rows();
    rows.push(row);
    markDirty(this.name);
    return row;
  }

  async update(id: string, patch: Partial<Schema[K]>): Promise<Schema[K] | undefined> {
    const rows = await this.rows();
    const index = rows.findIndex((row) => row.id === id);
    const existing = rows[index];
    if (index < 0 || !existing) return undefined;
    const next = { ...existing, ...patch } as Schema[K];
    rows[index] = next;
    markDirty(this.name);
    return next;
  }

  async remove(id: string): Promise<void> {
    const rows = await this.rows();
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return;
    rows.splice(index, 1);
    markDirty(this.name);
  }

  async removeWhere(where: (row: Schema[K]) => boolean): Promise<number> {
    const rows = await this.rows();
    let removed = 0;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const row = rows[i];
      if (row && where(row)) {
        rows.splice(i, 1);
        removed += 1;
      }
    }
    if (removed > 0) markDirty(this.name);
    return removed;
  }
}

export const db = {
  accounts: new Collection('accounts'),
  households: new Collection('households'),
  householdMembers: new Collection('householdMembers'),
  calendars: new Collection('calendars'),
  calendarMembers: new Collection('calendarMembers'),
  calendarShares: new Collection('calendarShares'),
  appAccess: new Collection('appAccess'),
  events: new Collection('events'),
  tasks: new Collection('tasks'),
  notes: new Collection('notes'),
  shoppingItems: new Collection('shoppingItems'),
  chores: new Collection('chores'),
  alarms: new Collection('alarms'),
} as const;

/** Wartet, bis die Daten da sind. Wirft, wenn der Dienst nicht laeuft. */
export function ready(): Promise<unknown> {
  return load();
}

/** Nach einem Schreiben aus einer anderen App: sofort nachsehen. */
export function refresh(): Promise<void> {
  return poll();
}

export function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && 'id' in value;
}

export { isRow };
