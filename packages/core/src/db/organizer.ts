import { notifyDataChanged } from './events';
import { db, newId } from './store';
import type {
  ContactRow,
  DocumentCategory,
  DocumentRow,
  HabitRow,
  HabitTickRow,
  PackingItemRow,
  TripRow,
} from './types';

function now(): string {
  return new Date().toISOString();
}

function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

// ------------------------------------------------------------- Dokumente

/** Dokumente, Gewohnheiten, Reisen, Kontakte — der Rest von GetBetter. */
export const documents = {
  list(accountId: string) {
    return db.documents.list({
      where: (row) => row.accountId === accountId,
      // Was ablaeuft, zuerst; was nie ablaeuft, alphabetisch dahinter.
      sort: (a, b) => {
        if (a.expiresOn && b.expiresOn) return a.expiresOn.localeCompare(b.expiresOn);
        if (a.expiresOn) return -1;
        if (b.expiresOn) return 1;
        return a.title.localeCompare(b.title);
      },
    });
  },

  async add(input: {
    accountId: string;
    title: string;
    category: DocumentCategory;
    expiresOn: string | null;
    note?: string | null;
  }): Promise<DocumentRow> {
    const row: DocumentRow = {
      id: newId('dc'),
      accountId: input.accountId,
      title: input.title.trim(),
      category: input.category,
      expiresOn: input.expiresOn,
      note: clean(input.note),
      createdAt: now(),
    };
    return changed(await db.documents.insert(row));
  },

  async update(
    id: string,
    patch: {
      title?: string;
      category?: DocumentCategory;
      expiresOn?: string | null;
      note?: string | null;
    },
  ) {
    return changed(
      await db.documents.update(id, {
        ...patch,
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.note !== undefined ? { note: clean(patch.note) } : {}),
      }),
    );
  },

  async remove(id: string) {
    await db.documents.remove(id);
    changed(null);
  },
};

// ---------------------------------------------------------- Gewohnheiten

export const habits = {
  list(accountId: string) {
    return db.habits.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  /** Alle Haken eines Kontos — klein genug, um sie am Stueck zu halten. */
  ticks(accountId: string) {
    return db.habitTicks.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => b.day.localeCompare(a.day),
    });
  },

  async add(input: { accountId: string; name: string; targetPerWeek: number }): Promise<HabitRow> {
    const row: HabitRow = {
      id: newId('hb'),
      accountId: input.accountId,
      name: input.name.trim(),
      targetPerWeek: Math.min(7, Math.max(1, Math.round(input.targetPerWeek))),
      createdAt: now(),
    };
    return changed(await db.habits.insert(row));
  },

  /** Haken setzen oder wegnehmen — ein Tipp auf denselben Tag. */
  async toggle(habitId: string, accountId: string, day: string): Promise<void> {
    const existing = await db.habitTicks.findBy(
      (row) => row.habitId === habitId && row.day === day,
    );
    if (existing) {
      await db.habitTicks.remove(existing.id);
    } else {
      const row: HabitTickRow = { id: newId('ht'), habitId, accountId, day };
      await db.habitTicks.insert(row);
    }
    changed(null);
  },

  async remove(id: string) {
    const ticks = await db.habitTicks.list({ where: (row) => row.habitId === id });
    for (const tick of ticks) await db.habitTicks.remove(tick.id);
    await db.habits.remove(id);
    changed(null);
  },
};

// ---------------------------------------------------------------- Reisen

export const trips = {
  list(accountId: string) {
    return db.trips.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.startDay.localeCompare(b.startDay),
    });
  },

  items(tripId: string) {
    return db.packingItems.list({
      where: (row) => row.tripId === tripId,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  /** Alle Packlisten eines Kontos, fuer den Stand auf der Karte. */
  allItems(accountId: string) {
    return db.packingItems.list({ where: (row) => row.accountId === accountId });
  },

  async add(input: {
    accountId: string;
    name: string;
    destination?: string | null;
    startDay: string;
    endDay: string;
  }): Promise<TripRow> {
    const row: TripRow = {
      id: newId('tr'),
      accountId: input.accountId,
      name: input.name.trim(),
      destination: clean(input.destination),
      startDay: input.startDay,
      endDay: input.endDay < input.startDay ? input.startDay : input.endDay,
      createdAt: now(),
    };
    return changed(await db.trips.insert(row));
  },

  async addItem(tripId: string, accountId: string, name: string): Promise<PackingItemRow> {
    const row: PackingItemRow = {
      id: newId('pk'),
      tripId,
      accountId,
      name: name.trim(),
      packed: false,
      createdAt: now(),
    };
    return changed(await db.packingItems.insert(row));
  },

  async setPacked(id: string, packed: boolean) {
    return changed(await db.packingItems.update(id, { packed }));
  },

  async removeItem(id: string) {
    await db.packingItems.remove(id);
    changed(null);
  },

  async remove(id: string) {
    const items = await db.packingItems.list({ where: (row) => row.tripId === id });
    for (const item of items) await db.packingItems.remove(item.id);
    await db.trips.remove(id);
    changed(null);
  },
};

// -------------------------------------------------------------- Kontakte

export const contacts = {
  list(accountId: string) {
    return db.contacts.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.name.localeCompare(b.name),
    });
  },

  async add(input: {
    accountId: string;
    name: string;
    birthday?: string | null;
    phone?: string | null;
    note?: string | null;
  }): Promise<ContactRow> {
    const row: ContactRow = {
      id: newId('ct'),
      accountId: input.accountId,
      name: input.name.trim(),
      birthday: input.birthday ?? null,
      phone: clean(input.phone),
      note: clean(input.note),
      lastSeenOn: null,
      createdAt: now(),
    };
    return changed(await db.contacts.insert(row));
  },

  async update(
    id: string,
    patch: {
      name?: string;
      birthday?: string | null;
      phone?: string | null;
      note?: string | null;
      lastSeenOn?: string | null;
    },
  ) {
    return changed(
      await db.contacts.update(id, {
        ...patch,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.phone !== undefined ? { phone: clean(patch.phone) } : {}),
        ...(patch.note !== undefined ? { note: clean(patch.note) } : {}),
      }),
    );
  },

  async remove(id: string) {
    await db.contacts.remove(id);
    changed(null);
  },

  /**
   * Einen Geburtstag loeschen. Wer nur wegen des Geburtstags eingetragen war,
   * geht ganz; wer Telefon, Notiz oder ein Treffen hat, bleibt als Kontakt.
   */
  async removeBirthday(id: string) {
    const row = await db.contacts.find(id);
    if (!row) return;
    if (row.phone === null && row.note === null && row.lastSeenOn === null) {
      await db.contacts.remove(id);
    } else {
      await db.contacts.update(id, { birthday: null });
    }
    changed(null);
  },
};
