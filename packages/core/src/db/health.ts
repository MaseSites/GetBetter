import { notifyDataChanged } from './events';
import { db, newId } from './store';
import type { MedRow, MedSlot, MedTakeRow, MoodRow, SleepRow, VitalKind, VitalRow } from './types';

function now(): string {
  return new Date().toISOString();
}

export { sleepMinutes } from './pure';

function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

// ---------------------------------------------------------------- Schlaf

/** Schlaf, Medikamente, Werte, Kopf frei — die Gesundheit in BetterGym. */
export const sleeps = {
  list(accountId: string, limit = 30) {
    return db.sleeps.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => b.day.localeCompare(a.day),
      limit,
    });
  },

  /** Eine Nacht je Morgen — ein zweiter Eintrag ersetzt den ersten. */
  async save(input: {
    accountId: string;
    day: string;
    bedtime: string;
    wakeTime: string;
    quality: number;
  }): Promise<SleepRow> {
    const existing = await db.sleeps.findBy(
      (row) => row.accountId === input.accountId && row.day === input.day,
    );
    const quality = Math.min(3, Math.max(1, Math.round(input.quality)));
    if (existing) {
      const updated = await db.sleeps.update(existing.id, {
        bedtime: input.bedtime,
        wakeTime: input.wakeTime,
        quality,
      });
      return changed(updated ?? existing);
    }
    const row: SleepRow = {
      id: newId('sl'),
      accountId: input.accountId,
      day: input.day,
      bedtime: input.bedtime,
      wakeTime: input.wakeTime,
      quality,
      createdAt: now(),
    };
    return changed(await db.sleeps.insert(row));
  },

  async remove(id: string) {
    await db.sleeps.remove(id);
    changed(null);
  },
};

// ---------------------------------------------------------- Medikamente

export const meds = {
  list(accountId: string) {
    return db.meds.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  takes(accountId: string, day: string) {
    return db.medTakes.list({ where: (row) => row.accountId === accountId && row.day === day });
  },

  async add(input: {
    accountId: string;
    name: string;
    dose?: string | null;
    slots: readonly MedSlot[];
    stock?: number | null;
  }): Promise<MedRow> {
    const row: MedRow = {
      id: newId('md'),
      accountId: input.accountId,
      name: input.name.trim(),
      dose: input.dose?.trim() || null,
      slots: [...input.slots],
      stock: input.stock ?? null,
      createdAt: now(),
    };
    return changed(await db.meds.insert(row));
  },

  /**
   * Genommen oder doch nicht — ein Tipp auf dieselbe Zeit. Der Vorrat geht
   * mit: eins runter beim Nehmen, eins rauf beim Zuruecknehmen.
   */
  async toggle(medId: string, accountId: string, day: string, slot: MedSlot): Promise<void> {
    const med = await db.meds.find(medId);
    const existing = await db.medTakes.findBy(
      (row) => row.medId === medId && row.day === day && row.slot === slot,
    );
    if (existing) {
      await db.medTakes.remove(existing.id);
      if (med && med.stock !== null) await db.meds.update(medId, { stock: med.stock + 1 });
    } else {
      const row: MedTakeRow = { id: newId('mt'), medId, accountId, day, slot, createdAt: now() };
      await db.medTakes.insert(row);
      if (med && med.stock !== null) {
        await db.meds.update(medId, { stock: Math.max(0, med.stock - 1) });
      }
    }
    changed(null);
  },

  async setStock(id: string, stock: number | null) {
    return changed(await db.meds.update(id, { stock }));
  },

  async remove(id: string) {
    const takes = await db.medTakes.list({ where: (row) => row.medId === id });
    for (const take of takes) await db.medTakes.remove(take.id);
    await db.meds.remove(id);
    changed(null);
  },
};

// ----------------------------------------------------------------- Werte

export const vitals = {
  list(accountId: string, kind: VitalKind, limit = 30) {
    return db.vitals.list({
      where: (row) => row.accountId === accountId && row.kind === kind,
      sort: (a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt),
      limit,
    });
  },

  async add(input: {
    accountId: string;
    kind: VitalKind;
    day: string;
    value: number;
    value2?: number | null;
  }): Promise<VitalRow> {
    const row: VitalRow = {
      id: newId('vt'),
      accountId: input.accountId,
      kind: input.kind,
      day: input.day,
      value: Math.round(input.value * 10) / 10,
      value2: input.value2 === null || input.value2 === undefined ? null : Math.round(input.value2),
      createdAt: now(),
    };
    return changed(await db.vitals.insert(row));
  },

  async remove(id: string) {
    await db.vitals.remove(id);
    changed(null);
  },
};

// ------------------------------------------------------------- Kopf frei

export const moods = {
  list(accountId: string, limit = 30) {
    return db.moods.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => b.day.localeCompare(a.day),
      limit,
    });
  },

  /** Ein Satz pro Tag — wer nochmal schreibt, ersetzt ihn. */
  async save(input: {
    accountId: string;
    day: string;
    mood: number;
    note?: string | null;
  }): Promise<MoodRow> {
    const existing = await db.moods.findBy(
      (row) => row.accountId === input.accountId && row.day === input.day,
    );
    const mood = Math.min(5, Math.max(1, Math.round(input.mood)));
    const note = input.note?.trim() || null;
    if (existing) {
      const updated = await db.moods.update(existing.id, { mood, note });
      return changed(updated ?? existing);
    }
    const row: MoodRow = {
      id: newId('mo'),
      accountId: input.accountId,
      day: input.day,
      mood,
      note,
      createdAt: now(),
    };
    return changed(await db.moods.insert(row));
  },

  async remove(id: string) {
    await db.moods.remove(id);
    changed(null);
  },
};
