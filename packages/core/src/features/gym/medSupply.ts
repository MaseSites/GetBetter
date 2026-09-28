/**
 * Medikamente: wie lange der Vorrat reicht und was jetzt offen ist — reine
 * Rechnung, ohne Speicher.
 */
import type { MedSlot } from '../../db/types';

/** Ab so wenigen Tagen steht „Nachschub“ da — Medisafe erinnert aehnlich frueh. */
export const LOW_SUPPLY_DAYS = 7;

/** Ab dieser Stunde ist eine Einnahmezeit dran. */
export const SLOT_HOURS: Readonly<Record<MedSlot, number>> = {
  morning: 5,
  noon: 11,
  evening: 17,
  night: 21,
};

/** Wie viele volle Tage der Vorrat noch reicht; ohne Vorrat oder Zeiten `null`. */
export function daysLeftOf(med: { stock: number | null; slots: readonly MedSlot[] }): number | null {
  if (med.stock === null || med.slots.length === 0) return null;
  return Math.floor(Math.max(0, med.stock) / med.slots.length);
}

export type OpenTake = { medId: string; slot: MedSlot };

export type MedPick =
  | { kind: 'take'; medId: string; slot: MedSlot }
  | { kind: 'already'; medId: string; slot: MedSlot }
  | { kind: 'which'; names: string[] }
  | { kind: 'none' };

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Welche Einnahme „Tablette genommen“ meint. Mit Name: das Medikament, dessen
 * Name passt; ohne: das einzige, das jetzt offen ist. Ohne Tageszeit die
 * erste offene, die dran ist, sonst die erste offene ueberhaupt. Passen
 * mehrere, wird nachgefragt — nie geraten.
 */
export function pickMedTake(
  meds: readonly { id: string; name: string; slots: readonly MedSlot[] }[],
  takes: readonly { medId: string; slot: MedSlot }[],
  query: { med: string | null; slot: MedSlot | null },
  hour: number,
): MedPick {
  const done = new Set(takes.map((take) => `${take.medId}|${take.slot}`));
  const isOpen = (medId: string, slot: MedSlot) => !done.has(`${medId}|${slot}`);
  let candidates = [...meds];
  if (query.med) {
    const wanted = fold(query.med);
    const exact = meds.filter((med) => fold(med.name) === wanted);
    candidates =
      exact.length > 0
        ? exact
        : meds.filter((med) => fold(med.name).includes(wanted) || wanted.includes(fold(med.name)));
  }
  if (query.slot) {
    const slot = query.slot;
    candidates = candidates.filter((med) => med.slots.includes(slot));
  }
  if (candidates.length === 0) return { kind: 'none' };

  const slotFor = (med: (typeof candidates)[number]): MedSlot | null => {
    if (query.slot) return query.slot;
    const open = med.slots.filter((slot) => isOpen(med.id, slot));
    return open.find((slot) => SLOT_HOURS[slot] <= hour) ?? open[0] ?? null;
  };

  // Passen mehrere, entscheidet, wer noch etwas offen hat — genau einer, sonst nachfragen.
  const withOpen = candidates.filter((med) => {
    const slot = slotFor(med);
    return slot !== null && isOpen(med.id, slot);
  });
  const withDue = withOpen.filter((med) => {
    const slot = slotFor(med);
    return slot !== null && SLOT_HOURS[slot] <= hour;
  });
  const med =
    candidates.length === 1
      ? candidates[0]
      : withDue.length === 1
        ? withDue[0]
        : withOpen.length === 1
          ? withOpen[0]
          : undefined;
  if (!med) {
    const asked = withOpen.length > 1 ? withOpen : candidates;
    return { kind: 'which', names: asked.map((entry) => entry.name) };
  }
  const slot = slotFor(med) ?? med.slots[0];
  if (!slot) return { kind: 'none' };
  return isOpen(med.id, slot) ? { kind: 'take', medId: med.id, slot } : { kind: 'already', medId: med.id, slot };
}

/**
 * Was jetzt offen ist: jede Einnahmezeit, deren Stunde erreicht ist und die
 * heute noch nicht abgehakt wurde — in der Reihenfolge der Medikamente.
 */
export function openDueTakes(
  meds: readonly { id: string; slots: readonly MedSlot[] }[],
  takes: readonly { medId: string; slot: MedSlot }[],
  hour: number,
): OpenTake[] {
  const done = new Set(takes.map((take) => `${take.medId}|${take.slot}`));
  return meds.flatMap((med) =>
    med.slots
      .filter((slot) => SLOT_HOURS[slot] <= hour && !done.has(`${med.id}|${slot}`))
      .map((slot) => ({ medId: med.id, slot })),
  );
}
