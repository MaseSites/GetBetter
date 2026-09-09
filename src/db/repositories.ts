import { notifyDataChanged } from './live';
import { db, newId } from './store';
import type {
  AlarmRow,
  CalendarScope,
  ChoreRepeat,
  ChoreRow,
  EventRow,
  NoteRow,
  ShoppingItemRow,
  TaskRow,
} from './types';

function now(): string {
  return new Date().toISOString();
}

/** Nach jeder Aenderung laden offene Abfragen neu. */
function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

// ---------------------------------------------------------------- Termine

/**
 * Welchen Ausschnitt des Kalenders jemand gerade sieht.
 * `member:<id>` zeigt den persoenlichen Kalender eines Haushaltsmitglieds.
 */
export type CalendarFilter = 'personal' | 'family' | 'all' | `cal:${string}` | `member:${string}`;

/** Wer fragt, in welchem Haushalt, und welche eigenen Kalender er hat. */
export type CalendarAccess = {
  accountId: string;
  householdId: string | null;
  /** Ids der angenommenen eigenen Kalender. */
  calendarIds: readonly string[];
};

/** Aeltere Zeilen kennen die neuen Felder noch nicht. */
function calendarOf(row: EventRow): CalendarScope {
  return row.calendar === 'family' ? 'family' : 'personal';
}

function isVisible(row: EventRow, access: CalendarAccess, filter: CalendarFilter): boolean {
  const scope = calendarOf(row);
  const mine = row.accountId === access.accountId;
  const sameHousehold = access.householdId !== null && row.householdId === access.householdId;
  const inMyCalendar = row.calendarId !== null && access.calendarIds.includes(row.calendarId);

  if (filter === 'personal') return mine && scope === 'personal';
  if (filter === 'family') return sameHousehold && scope === 'family';

  if (filter.startsWith('cal:')) {
    const calendarId = filter.slice('cal:'.length);
    return row.calendarId === calendarId && access.calendarIds.includes(calendarId);
  }

  if (filter.startsWith('member:')) {
    const memberId = filter.slice('member:'.length);
    if (row.accountId !== memberId || scope !== 'personal') return false;
    // Den eigenen Kalender sieht man ganz, fremde nur ohne die privaten Termine.
    return memberId === access.accountId || (sameHousehold && !row.isPrivate);
  }

  // 'all' zeigt bewusst nur die eigenen Termine — quer ueber alle Kalender,
  // aber ohne die Eintraege anderer. Fremdes findet man unter Familie
  // beziehungsweise beim jeweiligen Kalender.
  if (!mine) return false;
  if (scope === 'custom') return inMyCalendar;
  return true;
}

export const events = {
  find(id: string) {
    return db.events.find(id);
  },

  listBetween(
    access: CalendarAccess,
    fromIso: string,
    toIso: string,
    filter: CalendarFilter = 'all',
  ) {
    return db.events.list({
      where: (row) =>
        row.startsAt >= fromIso && row.startsAt < toIso && isVisible(row, access, filter),
      sort: (a, b) => a.startsAt.localeCompare(b.startsAt),
    });
  },

  listUpcoming(access: CalendarAccess, fromIso: string, limit?: number) {
    return db.events.list({
      where: (row) => (row.endsAt ?? row.startsAt) >= fromIso && isVisible(row, access, 'all'),
      sort: (a, b) => a.startsAt.localeCompare(b.startsAt),
      ...(limit !== undefined ? { limit } : {}),
    });
  },

  async create(input: {
    accountId: string;
    householdId: string | null;
    calendar: CalendarScope;
    calendarId?: string | null;
    isPrivate: boolean;
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
      householdId: input.householdId,
      calendar: input.calendar,
      calendarId: input.calendarId ?? null,
      isPrivate: input.calendar === 'personal' ? input.isPrivate : false,
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

/** Eigene Aufgaben plus die, die im Haushalt geteilt sind. */
function taskVisible(row: TaskRow, viewerId: string, householdId: string | null): boolean {
  if (row.accountId === viewerId) return true;
  return row.shared && householdId !== null && row.householdId === householdId;
}

export const tasks = {
  listOpen(viewerId: string, householdId: string | null) {
    return db.tasks.list({
      where: (row) => !row.done && taskVisible(row, viewerId, householdId),
      sort: (a, b) => {
        // Was eine Frist hat, steht oben, danach das Aelteste zuerst.
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      },
    });
  },

  listDone(viewerId: string, householdId: string | null, limit = 30) {
    return db.tasks.list({
      where: (row) => row.done && taskVisible(row, viewerId, householdId),
      sort: (a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
      limit,
    });
  },

  countOpen(viewerId: string, householdId: string | null) {
    return db.tasks.count((row) => !row.done && taskVisible(row, viewerId, householdId));
  },

  async create(input: {
    accountId: string;
    householdId: string | null;
    title: string;
    dueAt?: string | null;
    shared?: boolean;
  }): Promise<TaskRow> {
    const row: TaskRow = {
      id: newId('tk'),
      accountId: input.accountId,
      householdId: input.householdId,
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

  async setShared(id: string, shared: boolean) {
    return changed(await db.tasks.update(id, { shared }));
  },

  async remove(id: string) {
    await db.tasks.remove(id);
    changed(null);
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

/**
 * Im Haushalt teilen sich alle dieselbe Liste; allein sieht man nur die eigene.
 */
function shoppingVisible(
  row: ShoppingItemRow,
  viewerId: string,
  householdId: string | null,
): boolean {
  if (householdId !== null) return row.householdId === householdId;
  return row.accountId === viewerId && !row.householdId;
}

export const shopping = {
  list(viewerId: string, householdId: string | null) {
    return db.shoppingItems.list({
      where: (row) => shoppingVisible(row, viewerId, householdId),
      sort: (a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.createdAt.localeCompare(b.createdAt);
      },
    });
  },

  countOpen(viewerId: string, householdId: string | null) {
    return db.shoppingItems.count(
      (row) => !row.done && shoppingVisible(row, viewerId, householdId),
    );
  },

  async add(input: {
    accountId: string;
    householdId: string | null;
    name: string;
    quantity?: string | null;
  }): Promise<ShoppingItemRow> {
    const row: ShoppingItemRow = {
      id: newId('sh'),
      accountId: input.accountId,
      householdId: input.householdId,
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

  async clearDone(viewerId: string, householdId: string | null) {
    const removed = await db.shoppingItems.removeWhere(
      (row) => row.done && shoppingVisible(row, viewerId, householdId),
    );
    return changed(removed);
  },
};

// ----------------------------------------------------------------- Aemtli

export const chores = {
  list(householdId: string) {
    return db.chores.list({
      where: (row) => row.householdId === householdId,
      sort: (a, b) => {
        // Offene zuerst, danach nach Faelligkeit.
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      },
    });
  },

  listFor(householdId: string, accountId: string) {
    return db.chores.list({
      where: (row) => row.householdId === householdId && row.assignedTo === accountId,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  async create(input: {
    householdId: string;
    title: string;
    assignedTo?: string | null;
    repeat?: ChoreRepeat;
    dueAt?: string | null;
  }): Promise<ChoreRow> {
    const row: ChoreRow = {
      id: newId('ch'),
      householdId: input.householdId,
      title: input.title.trim(),
      assignedTo: input.assignedTo ?? null,
      repeat: input.repeat ?? 'weekly',
      dueAt: input.dueAt ?? null,
      lastDoneAt: null,
      lastDoneBy: null,
      createdAt: now(),
    };
    return changed(await db.chores.insert(row));
  },

  async assign(id: string, accountId: string | null) {
    return changed(await db.chores.update(id, { assignedTo: accountId }));
  },

  /** Erledigt: Zeitstempel setzen und bei Wiederholung neu faellig machen. */
  async complete(id: string, byAccountId: string) {
    const chore = await db.chores.find(id);
    if (!chore) return undefined;
    const done = now();
    const next = nextDue(chore.repeat, new Date());
    return changed(
      await db.chores.update(id, {
        lastDoneAt: done,
        lastDoneBy: byAccountId,
        dueAt: next ? next.toISOString() : null,
      }),
    );
  },

  async update(id: string, patch: Partial<Omit<ChoreRow, 'id' | 'householdId'>>) {
    return changed(await db.chores.update(id, patch));
  },

  async remove(id: string) {
    await db.chores.remove(id);
    changed(null);
  },
};

function nextDue(repeat: ChoreRepeat, from: Date): Date | null {
  if (repeat === 'once') return null;
  const next = new Date(from);
  next.setHours(0, 0, 0, 0);
  if (repeat === 'daily') next.setDate(next.getDate() + 1);
  if (repeat === 'weekly') next.setDate(next.getDate() + 7);
  if (repeat === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
}

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
