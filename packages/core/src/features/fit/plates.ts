/**
 * Scheibenrechner: welche Scheiben je Seite auf die Langhantel gehoeren.
 * Stange 20 kg, Scheiben 25 · 20 · 15 · 10 · 5 · 2.5 · 1.25 kg — so wie sie in
 * den meisten Studios haengen. Rein gerechnet, ohne Oberflaeche.
 */

export const BAR_KG = 20;
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export type PlateLoad = {
  /** Scheiben je Seite, schwerste zuerst. */
  perSide: number[];
  /** Was damit wirklich auf der Stange ist. */
  totalKg: number;
  /** Was fehlt, weil es keine passende kleine Scheibe gibt (0 = genau). */
  restKg: number;
  /** Weniger als die leere Stange. */
  belowBar: boolean;
};

/** In Hundertsteln rechnen, damit 2.5 + 1.25 nicht zu 3.7499… wird. */
const cents = (kg: number) => Math.round(kg * 100);

export function platesFor(targetKg: number, barKg: number = BAR_KG): PlateLoad {
  if (!Number.isFinite(targetKg) || targetKg <= barKg) {
    return { perSide: [], totalKg: barKg, restKg: 0, belowBar: targetKg < barKg };
  }
  let side = Math.floor((cents(targetKg) - cents(barKg)) / 2);
  const perSide: number[] = [];
  for (const plate of PLATES_KG) {
    const size = cents(plate);
    while (side >= size) {
      perSide.push(plate);
      side -= size;
    }
  }
  const totalCents = cents(barKg) + 2 * perSide.reduce((sum, plate) => sum + cents(plate), 0);
  return {
    perSide,
    totalKg: totalCents / 100,
    restKg: (cents(targetKg) - totalCents) / 100,
    belowBar: false,
  };
}

/** Gleiche Scheiben zusammengefasst: [20, 20, 5] -> [{ kg: 20, count: 2 }, { kg: 5, count: 1 }]. */
export function groupPlates(perSide: readonly number[]): { kg: number; count: number }[] {
  const groups: { kg: number; count: number }[] = [];
  for (const plate of perSide) {
    const last = groups.at(-1);
    if (last && last.kg === plate) groups[groups.length - 1] = { kg: plate, count: last.count + 1 };
    else groups.push({ kg: plate, count: 1 });
  }
  return groups;
}
