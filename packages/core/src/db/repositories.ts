import { nextAssignee } from '../features/chores/rotation';
import { planAdd } from '../features/shopping/merge';

import { notifyDataChanged } from './live';
import { db, newId } from './store';
import type {
  AlarmRow,
  CalendarScope,
  ChoreRepeat,
  ChoreRow,
  EventRow,
  ShoppingItemRow,
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

/** Die eigenen Kalender: der private, die Haushalte, die selbst angelegten. */
function ownSources(access: CalendarAccess): CalendarSource[] {
  return [
    'personal',
    ...access.householdIds.map((id) => `house:${id}` as const),
    ...access.calendarIds.map((id) => `cal:${id}` as const),
  ];
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
  listUpcoming(
    access: CalendarAccess,
    fromIso: string,
    limit?: number,
    options: { timedOnly?: boolean } = {},
  ) {
    const own = ownSources(access);
    return db.events
      .list({
        where: (row) =>
          (!options.timedOnly || !row.allDay) &&
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

  /**
   * Ein ganzer Tag fuer das Tagesband: dasselbe Eigene wie `listUpcoming`, nur
   * auf einen Tag begrenzt — so zeigt das Band auch morgen und uebermorgen.
   */
  listDay(
    access: CalendarAccess,
    fromIso: string,
    toIso: string,
    options: { timedOnly?: boolean } = {},
  ) {
    const own = ownSources(access);
    return db.events
      .list({
        where: (row) =>
          (!options.timedOnly || !row.allDay) &&
          row.startsAt >= fromIso &&
          row.startsAt < toIso &&
          row.accountId === access.accountId &&
          isVisible(row, access, own),
        sort: (a, b) => a.startsAt.localeCompare(b.startsAt),
      })
      .then(dedupe);
  },

  /**
   * Das Ganztaegige eines Tages — fuer die Zeile oben am Tagesband. Ohne
   * Uhrzeit gehoert es nicht zwischen die Termine, sondern ueber sie.
   */
  listAllDay(access: CalendarAccess, fromIso: string, toIso: string) {
    const own = ownSources(access);
    return db.events
      .list({
        where: (row) =>
          row.allDay &&
          row.startsAt >= fromIso &&
          row.startsAt < toIso &&
          row.accountId === access.accountId &&
          isVisible(row, access, own),
        sort: (a, b) => a.title.localeCompare(b.title),
      })
      .then(dedupe);
  },

  /**
   * Eigene Termine, die noch kommen und eine Erinnerung tragen — fuer die
   * Mitteilungen des Handys (`features/calendar/reminders.ts`).
   */
  listWithReminder(accountId: string, fromIso: string) {
    return db.events
      .list({
        where: (row) =>
          row.accountId === accountId &&
          typeof row.reminderMinutes === 'number' &&
          row.startsAt >= fromIso,
        sort: (a, b) => a.startsAt.localeCompare(b.startsAt),
      })
      .then(dedupe);
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

  /** Rueckgaengig zu `remove`: die Zeilen genau so, wie sie vorher waren. */
  async restore(rows: readonly EventRow[]) {
    const all = await db.events.list();
    const missing = rows.filter((row) => !all.some((existing) => existing.id === row.id));
    for (const row of missing) await db.events.insert(row);
    if (missing.length > 0) changed(null);
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
  /** Fehlt es, bleibt die Erinnerung, wie sie ist. */
  reminderMinutes?: number | null;
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
    // Nur mitschreiben, wenn es gesetzt ist — sonst loeschte ein Verschieben
    // aus dem Assistenten die Erinnerung.
    ...(input.reminderMinutes !== undefined ? { reminderMinutes: input.reminderMinutes } : {}),
  };
}

// ------------------------------------------------------ Aufgaben, Notizen

// Beide liegen in eigenen Dateien (`tasks.ts`, `notes.ts`); hier bleiben sie
// unter demselben Namen erreichbar, damit kein Aufruf sich aendern muss.
export { tasks } from './tasks';
export { notes } from './notes';

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

/** Weggeräumtes zählt so lange für „Oft gekauft“, danach geht es ganz. */
const SHOPPING_HISTORY_DAYS = 180;

export type ShoppingAddResult = {
  row: ShoppingItemRow;
  /** Stand der Posten schon offen drauf? Dann ist nur die Menge gewachsen. */
  merged: boolean;
  /** Die Menge vor dem Zusammenführen — für „Rückgängig“. */
  previousQuantity: string | null;
};

export const shopping = {
  /** Die Liste, ohne Weggeräumtes. */
  list(viewerId: string, householdId: string | null) {
    return db.shoppingItems.list({
      where: (row) => !row.clearedAt && shoppingVisible(row, viewerId, householdId),
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

  /** Alles, was je auf der Liste stand, auch Weggeräumtes — für „Oft gekauft“. */
  history(viewerId: string, householdId: string | null) {
    return db.shoppingItems.list({
      where: (row) => shoppingVisible(row, viewerId, householdId),
    });
  },

  /**
   * Auf die Liste — steht der Posten schon offen drauf (gleicher Name, siehe
   * `itemKey`), wächst dort die Menge statt einer zweiten Zeile.
   */
  async add(input: {
    accountId: string;
    householdId: string | null;
    name: string;
    quantity?: string | null;
    category?: string;
  }): Promise<ShoppingItemRow> {
    return (await shopping.addMerging(input)).row;
  },

  /** Wie `add`, sagt aber, ob zusammengeführt wurde. */
  async addMerging(input: {
    accountId: string;
    householdId: string | null;
    name: string;
    quantity?: string | null;
    category?: string;
  }): Promise<ShoppingAddResult> {
    const open = await db.shoppingItems.list({
      where: (entry) =>
        !entry.done &&
        !entry.clearedAt &&
        shoppingVisible(entry, input.accountId, input.householdId),
    });
    const plan = planAdd(open, { name: input.name, quantity: input.quantity?.trim() || null });
    if (plan.kind === 'merge') {
      const updated = await db.shoppingItems.update(plan.row.id, { quantity: plan.quantity });
      return changed({
        row: updated ?? plan.row,
        merged: true,
        previousQuantity: plan.row.quantity,
      });
    }
    const row: ShoppingItemRow = {
      id: newId('sh'),
      accountId: input.accountId,
      householdId: input.householdId,
      name: input.name.trim(),
      quantity: input.quantity?.trim() || null,
      ...(input.category ? { category: input.category } : {}),
      done: false,
      createdAt: now(),
    };
    return changed({
      row: await db.shoppingItems.insert(row),
      merged: false,
      previousQuantity: null,
    });
  },

  /** Name, Menge oder Abteilung ändern. */
  async update(
    id: string,
    patch: Partial<Pick<ShoppingItemRow, 'name' | 'quantity' | 'category'>>,
  ) {
    const clean: Partial<ShoppingItemRow> = { ...patch };
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (name.length === 0) delete clean.name;
      else clean.name = name;
    }
    if (patch.quantity !== undefined) clean.quantity = patch.quantity?.trim() || null;
    return changed(await db.shoppingItems.update(id, clean));
  },

  async setDone(id: string, done: boolean) {
    return changed(await db.shoppingItems.update(id, { done }));
  },

  async remove(id: string) {
    await db.shoppingItems.remove(id);
    changed(null);
  },

  /**
   * Erledigtes wegräumen. Die Zeilen bleiben als Geschichte (`clearedAt`)
   * stehen, damit „Oft gekauft“ weiss, was man immer wieder kauft — der
   * einfachste sichere Weg: keine neue Sammlung, der Dienst sieht die Zeilen
   * schon nach `householdId`, und wer austritt, nimmt nichts Fremdes mit.
   * Nach `SHOPPING_HISTORY_DAYS` gehen sie ganz, damit nichts endlos wächst.
   */
  async clearDone(viewerId: string, householdId: string | null) {
    const at = now();
    const cutoff = new Date(Date.now() - SHOPPING_HISTORY_DAYS * 86_400_000).toISOString();
    await db.shoppingItems.removeWhere(
      (row) =>
        !!row.clearedAt && row.clearedAt < cutoff && shoppingVisible(row, viewerId, householdId),
    );
    const rows = await db.shoppingItems.list({
      where: (row) => row.done && !row.clearedAt && shoppingVisible(row, viewerId, householdId),
    });
    await Promise.all(rows.map((row) => db.shoppingItems.update(row.id, { clearedAt: at })));
    return changed(rows.length);
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
    /** Reihum: wer in welcher Reihenfolge; die erste Person beginnt. */
    rotation?: readonly string[];
  }): Promise<ChoreRow> {
    const rotation = input.rotation && input.rotation.length > 0 ? [...input.rotation] : null;
    const row: ChoreRow = {
      id: newId('ch'),
      householdId: input.householdId,
      title: input.title.trim(),
      assignedTo: input.assignedTo ?? rotation?.[0] ?? null,
      repeat: input.repeat ?? 'weekly',
      dueAt: input.dueAt ?? null,
      lastDoneAt: null,
      lastDoneBy: null,
      ...(rotation ? { rotation } : {}),
      createdAt: now(),
    };
    return changed(await db.chores.insert(row));
  },

  async assign(id: string, accountId: string | null) {
    return changed(await db.chores.update(id, { assignedTo: accountId }));
  },

  /**
   * Erledigt: Zeitstempel setzen, bei Wiederholung neu faellig machen und —
   * reihum — der naechsten Person im Haushalt zuteilen (`nextAssignee`).
   */
  async complete(id: string, byAccountId: string) {
    const chore = await db.chores.find(id);
    if (!chore) return undefined;
    const done = now();
    const next = nextDue(chore.repeat, new Date());
    const members = chore.rotation?.length
      ? await db.householdMembers.list({
          where: (row) => row.householdId === chore.householdId && row.status !== 'pending',
        })
      : [];
    const assignedTo =
      chore.repeat === 'once'
        ? chore.assignedTo
        : nextAssignee(
            chore,
            members.map((row) => row.accountId),
          );
    return changed(
      await db.chores.update(id, {
        assignedTo,
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
    sound?: string;
    snooze?: boolean;
    snoozeMinutes?: number;
  }): Promise<AlarmRow> {
    const row: AlarmRow = {
      id: newId('al'),
      accountId: input.accountId,
      time: input.time,
      label: input.label?.trim() ?? '',
      days: input.days ?? [],
      enabled: true,
      ...(input.sound ? { sound: input.sound } : {}),
      ...(input.snooze !== undefined ? { snooze: input.snooze } : {}),
      ...(input.snoozeMinutes !== undefined ? { snoozeMinutes: input.snoozeMinutes } : {}),
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
