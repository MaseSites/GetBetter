import { notifyDataChanged } from './live';
import { db, newId } from './store';
import type { AlarmRow, EventRow, NoteRow, ShoppingItemRow, TaskRow } from './types';

function now(): string {
  return new Date().toISOString();
}

/** Nach jeder Aenderung laden offene Abfragen neu. */
function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

// ---------------------------------------------------------------- Termine

export const events = {
  listUpcoming(accountId: string, fromIso: string, limit?: number) {
    return db.events.list({
      where: (row) => row.accountId === accountId && (row.endsAt ?? row.startsAt) >= fromIso,
      sort: (a, b) => a.startsAt.localeCompare(b.startsAt),
      ...(limit !== undefined ? { limit } : {}),
    });
  },

  listBetween(accountId: string, fromIso: string, toIso: string) {
    return db.events.list({
      where: (row) =>
        row.accountId === accountId && row.startsAt >= fromIso && row.startsAt < toIso,
      sort: (a, b) => a.startsAt.localeCompare(b.startsAt),
    });
  },

  find(id: string) {
    return db.events.find(id);
  },

  async create(input: {
    accountId: string;
    title: string;
    startsAt: string;
    endsAt?: string | null;
    location?: string | null;
    notes?: string | null;
    allDay?: boolean;
    color?: string | null;
  }): Promise<EventRow> {
    const row: EventRow = {
      id: newId('ev'),
      accountId: input.accountId,
      title: input.title.trim(),
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      allDay: input.allDay ?? false,
      color: input.color ?? null,
      createdAt: now(),
    };
    return changed(await db.events.insert(row));
  },

  async update(id: string, patch: Partial<Omit<EventRow, 'id' | 'accountId'>>) {
    return changed(await db.events.update(id, patch));
  },

  async remove(id: string) {
    await db.events.remove(id);
    changed(null);
  },
};

// --------------------------------------------------------------- Aufgaben

export const tasks = {
  listOpen(accountId: string) {
    return db.tasks.list({
      where: (row) => row.accountId === accountId && !row.done,
      sort: (a, b) => {
        // Was eine Frist hat, steht oben, danach das Aelteste zuerst.
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      },
    });
  },

  listDone(accountId: string, limit = 30) {
    return db.tasks.list({
      where: (row) => row.accountId === accountId && row.done,
      sort: (a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
      limit,
    });
  },

  countOpen(accountId: string) {
    return db.tasks.count((row) => row.accountId === accountId && !row.done);
  },

  async create(input: {
    accountId: string;
    title: string;
    dueAt?: string | null;
    shared?: boolean;
  }): Promise<TaskRow> {
    const row: TaskRow = {
      id: newId('tk'),
      accountId: input.accountId,
      title: input.title.trim(),
      done: false,
      dueAt: input.dueAt ?? null,
      shared: input.shared ?? false,
      createdAt: now(),
      completedAt: null,
    };
    return changed(await db.tasks.insert(row));
  },

  async setDone(id: string, done: boolean) {
    return changed(await db.tasks.update(id, { done, completedAt: done ? now() : null }));
  },

  async rename(id: string, title: string) {
    return changed(await db.tasks.update(id, { title: title.trim() }));
  },

  async remove(id: string) {
    await db.tasks.remove(id);
    changed(null);
  },

  async clearDone(accountId: string) {
    const removed = await db.tasks.removeWhere((row) => row.accountId === accountId && row.done);
    return changed(removed);
  },
};

// --------------------------------------------------------------- Notizen

export const notes = {
  list(accountId: string) {
    return db.notes.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    });
  },

  find(id: string) {
    return db.notes.find(id);
  },

  count(accountId: string) {
    return db.notes.count((row) => row.accountId === accountId);
  },

  async create(input: { accountId: string; title?: string; body?: string }): Promise<NoteRow> {
    const timestamp = now();
    const row: NoteRow = {
      id: newId('nt'),
      accountId: input.accountId,
      title: input.title?.trim() ?? '',
      body: input.body ?? '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return changed(await db.notes.insert(row));
  },

  async save(id: string, patch: { title?: string; body?: string }) {
    return changed(await db.notes.update(id, { ...patch, updatedAt: now() }));
  },

  async remove(id: string) {
    await db.notes.remove(id);
    changed(null);
  },
};

// ---------------------------------------------------------- Einkaufsliste

export const shopping = {
  list(accountId: string) {
    return db.shoppingItems.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.createdAt.localeCompare(b.createdAt);
      },
    });
  },

  countOpen(accountId: string) {
    return db.shoppingItems.count((row) => row.accountId === accountId && !row.done);
  },

  async add(input: {
    accountId: string;
    name: string;
    quantity?: string | null;
  }): Promise<ShoppingItemRow> {
    const row: ShoppingItemRow = {
      id: newId('sh'),
      accountId: input.accountId,
      name: input.name.trim(),
      quantity: input.quantity?.trim() || null,
      done: false,
      createdAt: now(),
    };
    return changed(await db.shoppingItems.insert(row));
  },

  async setDone(id: string, done: boolean) {
    return changed(await db.shoppingItems.update(id, { done }));
  },

  async remove(id: string) {
    await db.shoppingItems.remove(id);
    changed(null);
  },

  async clearDone(accountId: string) {
    const removed = await db.shoppingItems.removeWhere(
      (row) => row.accountId === accountId && row.done,
    );
    return changed(removed);
  },
};

// ----------------------------------------------------------------- Wecker

export const alarms = {
  list(accountId: string) {
    return db.alarms.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.time.localeCompare(b.time),
    });
  },

  async nextEnabled(accountId: string) {
    const rows = await alarms.list(accountId);
    return rows.find((row) => row.enabled);
  },

  async create(input: {
    accountId: string;
    time: string;
    label?: string;
    days?: readonly string[];
  }): Promise<AlarmRow> {
    const row: AlarmRow = {
      id: newId('al'),
      accountId: input.accountId,
      time: input.time,
      label: input.label?.trim() ?? '',
      days: input.days ?? [],
      enabled: true,
      createdAt: now(),
    };
    return changed(await db.alarms.insert(row));
  },

  async setEnabled(id: string, enabled: boolean) {
    return changed(await db.alarms.update(id, { enabled }));
  },

  async update(id: string, patch: Partial<Omit<AlarmRow, 'id' | 'accountId'>>) {
    return changed(await db.alarms.update(id, patch));
  },

  async remove(id: string) {
    await db.alarms.remove(id);
    changed(null);
  },
};
