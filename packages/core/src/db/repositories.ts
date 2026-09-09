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
 * Eine einzelne Quelle im Kalender. Angezeigt wird die Vereinigung der
 * angehakten Quellen — deshalb eine Liste statt eines einzelnen Filters.
 * `house:<id>` ist der Kalender eines Haushalts, `cal:<id>` ein selbst
 * angelegter, `member:<id>` der persoenliche Kalender einer Person.
 */
export type CalendarSource = 'personal' | `house:${string}` | `cal:${string}` | `member:${string}`;

/** Wer fragt, in welchen Haushalten, und was er sonst sehen darf. */
export type CalendarAccess = {
  accountId: string;
  /** Alle Haushalte, in denen das Konto ist. */
  householdIds: readonly string[];
  /** Ids der angenommenen eigenen Kalender. */
  calendarIds: readonly string[];
  /**
   * Konten, deren persoenlichen Kalender man sehen darf: gemeinsamer
   * Haushalt oder angenommene Anfrage. Private Termine bleiben trotzdem weg.
   */
  canSee: readonly string[];
};

/** Kopien desselben Termins gehoeren zusammen; alte Zeilen stehen fuer sich. */
export function groupOf(row: EventRow): string {
  return row.groupId ?? row.id;
}

/** Wohin eine Kopie gehoert. Ein Termin kann in mehreren Kalendern liegen. */
export type EventTarget = {
  calendar: CalendarScope;
  calendarId: string | null;
  householdId: string | null;
};

/** Aeltere Zeilen kennen die neuen Felder noch nicht — die gelten als persoenlich. */
function calendarOf(row: EventRow): CalendarScope {
  if (row.calendar === 'family') return 'family';
  if (row.calendar === 'custom') return 'custom';
  return 'personal';
}

/** Passt ein Termin zu genau dieser Quelle? */
function matchesSource(row: EventRow, access: CalendarAccess, source: CalendarSource): boolean {
  const scope = calendarOf(row);

  if (source === 'personal') return row.accountId === access.accountId && scope === 'personal';

  if (source.startsWith('house:')) {
    const householdId = source.slice('house:'.length);
    return (
      scope === 'family' &&
      row.householdId === householdId &&
      access.householdIds.includes(householdId)
    );
  }

  if (source.startsWith('cal:')) {
    const calendarId = source.slice('cal:'.length);
    return row.calendarId === calendarId && access.calendarIds.includes(calendarId);
  }

  const memberId = source.slice('member:'.length);
  if (row.accountId !== memberId || scope !== 'personal') return false;
  // Den eigenen Kalender sieht man ganz, fremde nur ohne die privaten Termine.
  if (memberId === access.accountId) return true;
  return !row.isPrivate && access.canSee.includes(memberId);
}

function isVisible(
  row: EventRow,
  access: CalendarAccess,
  sources: readonly CalendarSource[],
): boolean {
  return sources.some((source) => matchesSource(row, access, source));
}

/** Liegt ein Termin in mehreren angezeigten Kalendern, steht er trotzdem einmal da. */
function dedupe(rows: readonly EventRow[]): EventRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const group = groupOf(row);
    if (seen.has(group)) return false;
    seen.add(group);
    return true;
  });
}

export const events = {
  find(id: string) {
    return db.events.find(id);
  },

  listBetween(
    access: CalendarAccess,
    fromIso: string,
    toIso: string,
    sources: readonly CalendarSource[],
  ) {
    return db.events
      .list({
        where: (row) =>
          row.startsAt >= fromIso && row.startsAt < toIso && isVisible(row, access, sources),
        sort: (a, b) => a.startsAt.localeCompare(b.startsAt),
      })
      .then(dedupe);
  },

  /** Fuer die Startseite: alles Eigene, quer ueber die eigenen Kalender. */
  listUpcoming(access: CalendarAccess, fromIso: string, limit?: number) {
    const own: CalendarSource[] = [
      'personal',
      ...access.householdIds.map((id) => `house:${id}` as const),
      ...access.calendarIds.map((id) => `cal:${id}` as const),
    ];
    return db.events
      .list({
        where: (row) =>
          (row.endsAt ?? row.startsAt) >= fromIso &&
          row.accountId === access.accountId &&
          isVisible(row, access, own),
        sort: (a, b) => a.startsAt.localeCompare(b.startsAt),
      })
      .then((rows) => {
        const unique = dedupe(rows);
        return limit === undefined ? unique : unique.slice(0, limit);
      });
  },

  /** Alle Kopien eines Termins, damit der Editor die Kalender vorwaehlen kann. */
  group(groupId: string) {
    return db.events.list({ where: (row) => groupOf(row) === groupId });
  },

  async create(
    input: EventFields & { accountId: string },
    targets: readonly EventTarget[],
  ): Promise<void> {
    const groupId = newId('evg');
    for (const target of targets) {
      await db.events.insert({
        id: newId('ev'),
        groupId,
        accountId: input.accountId,
        ...fieldsFor(input, target),
        createdAt: now(),
      });
    }
    changed(null);
  },

  /**
   * Speichert einen bestehenden Termin samt seiner Kopien: was wegfaellt wird
   * geloescht, was bleibt aktualisiert, was dazukommt angelegt.
   */
  async save(
    groupId: string,
    accountId: string,
    input: EventFields,
    targets: readonly EventTarget[],
  ) {
    const rows = await db.events.list({ where: (row) => groupOf(row) === groupId });
    const keep = new Set<string>();

    for (const target of targets) {
      const key = targetKey(target);
      keep.add(key);
      const existing = rows.find((row) => targetKey(targetOf(row)) === key);
      if (existing) {
        await db.events.update(existing.id, { groupId, ...fieldsFor(input, target) });
      } else {
        await db.events.insert({
          id: newId('ev'),
          groupId,
          accountId,
          ...fieldsFor(input, target),
          createdAt: now(),
        });
      }
    }

    for (const row of rows) {
      if (!keep.has(targetKey(targetOf(row)))) await db.events.remove(row.id);
    }
    changed(null);
  },

  /** Loescht den Termin in allen Kalendern, in denen er liegt. */
  async remove(groupId: string) {
    await db.events.removeWhere((row) => groupOf(row) === groupId);
    changed(null);
  },
};

/** Die Felder, die alle Kopien eines Termins gemeinsam haben. */
export type EventFields = {
  isPrivate: boolean;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  notes?: string | null;
  allDay?: boolean;
  color?: string | null;
};

export function targetOf(row: EventRow): EventTarget {
  return {
    calendar: calendarOf(row),
    calendarId: row.calendarId ?? null,
    householdId: row.householdId ?? null,
  };
}

function targetKey(target: EventTarget): string {
  return `${target.calendar}:${target.calendarId ?? ''}:${target.householdId ?? ''}`;
}

function fieldsFor(input: EventFields, target: EventTarget) {
  return {
    householdId: target.householdId,
    calendar: target.calendar,
    calendarId: target.calendarId,
    isPrivate: target.calendar === 'personal' ? input.isPrivate : false,
    title: input.title.trim(),
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
    allDay: input.allDay ?? false,
    color: input.color ?? null,
  };
}

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
        // Was eine Frist hat, steht oben; bei gleicher Frist die Fahne zuerst,
        // danach das Aelteste.
        if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt && !b.dueAt) return -1;
        if (b.dueAt && !a.dueAt) return 1;
        const flag = Number(b.priority ?? false) - Number(a.priority ?? false);
        if (flag !== 0) return flag;
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
    priority?: boolean;
    notes?: string | null;
  }): Promise<TaskRow> {
    const row: TaskRow = {
      id: newId('tk'),
      accountId: input.accountId,
      householdId: input.householdId,
      title: input.title.trim(),
      done: false,
      dueAt: input.dueAt ?? null,
      shared: input.shared ?? false,
      priority: input.priority ?? false,
      notes: input.notes?.trim() || null,
      createdAt: now(),
      completedAt: null,
    };
    return changed(await db.tasks.insert(row));
  },

  async setDone(id: string, done: boolean) {
    return changed(await db.tasks.update(id, { done, completedAt: done ? now() : null }));
  },

  async update(
    id: string,
    patch: { title?: string; dueAt?: string | null; priority?: boolean; notes?: string | null },
  ) {
    return changed(
      await db.tasks.update(id, {
        ...patch,
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      }),
    );
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
      // Angeheftete zuerst, sonst das zuletzt Bearbeitete.
      sort: (a, b) =>
        Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
        b.updatedAt.localeCompare(a.updatedAt),
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

  async save(id: string, patch: { title?: string; body?: string; pinned?: boolean }) {
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
