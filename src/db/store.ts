import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLLECTION_NAMES, type CollectionName, type Row, type Schema } from './types';

const KEY_PREFIX = 'better-life/db/v1/';
const SCHEMA_VERSION_KEY = `${KEY_PREFIX}version`;
export const SCHEMA_VERSION = 1;

type Tables = { [K in CollectionName]: Schema[K][] };

let tables: Tables | null = null;
let loading: Promise<Tables> | null = null;

/** Sammlungen, die seit dem letzten Schreiben veraendert wurden. */
const dirty = new Set<CollectionName>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function emptyTables(): Tables {
  return {
    accounts: [],
    events: [],
    tasks: [],
    notes: [],
    shoppingItems: [],
    alarms: [],
  };
}

function parseCollection<K extends CollectionName>(raw: string | null): Schema[K][] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Schema[K][]) : [];
  } catch {
    // Ein kaputter Eintrag darf die App nicht blockieren.
    return [];
  }
}

async function load(): Promise<Tables> {
  if (tables) return tables;
  if (!loading) {
    loading = (async () => {
      const keys = COLLECTION_NAMES.map((name) => `${KEY_PREFIX}${name}`);
      const entries = await AsyncStorage.multiGet([SCHEMA_VERSION_KEY, ...keys]);
      const byKey = new Map(entries);

      const next = emptyTables();
      for (const name of COLLECTION_NAMES) {
        next[name] = parseCollection(byKey.get(`${KEY_PREFIX}${name}`) ?? null) as never;
      }

      if (byKey.get(SCHEMA_VERSION_KEY) !== String(SCHEMA_VERSION)) {
        await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
      }

      tables = next;
      return next;
    })();
  }
  return loading;
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 60);
}

/** Schreibt alle veraenderten Sammlungen. Wird auch beim Abmelden aufgerufen. */
export async function flush(): Promise<void> {
  if (!tables || dirty.size === 0) return;
  const pending = [...dirty];
  dirty.clear();
  const pairs: [string, string][] = pending.map((name) => [
    `${KEY_PREFIX}${name}`,
    JSON.stringify(tables?.[name] ?? []),
  ]);
  try {
    await AsyncStorage.multiSet(pairs);
  } catch {
    // Beim naechsten Schreiben erneut versuchen.
    pending.forEach((name) => dirty.add(name));
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

/**
 * Eine Sammlung. Die Daten liegen im Speicher und werden nach jeder Aenderung
 * gebuendelt zurueckgeschrieben — bei den Datenmengen dieser App genug.
 */
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
  events: new Collection('events'),
  tasks: new Collection('tasks'),
  notes: new Collection('notes'),
  shoppingItems: new Collection('shoppingItems'),
  alarms: new Collection('alarms'),
} as const;

/** Wartet, bis die Daten geladen sind. Der Start zeigt solange den Ladezustand. */
export function ready(): Promise<unknown> {
  return load();
}

/** Nur fuer Entwicklung: alles loeschen. */
export async function wipeDatabase(): Promise<void> {
  await AsyncStorage.multiRemove([
    SCHEMA_VERSION_KEY,
    ...COLLECTION_NAMES.map((name) => `${KEY_PREFIX}${name}`),
  ]);
  tables = emptyTables();
  loading = null;
  dirty.clear();
}

export function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && 'id' in value;
}

export { isRow };
