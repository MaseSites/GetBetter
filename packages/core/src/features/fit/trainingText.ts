/**
 * Zahlen und kurze Zeilen fuers Training — rein, ohne Oberflaeche, getestet.
 * Zahlen gehen immer durch `Intl` in der Sprache des Kontos: 62.5 kg auf
 * Deutsch (Schweiz), 62,5 kg auf Franzoesisch.
 */

export type TrainingFormats = {
  /** Gewicht: bis zwei Stellen (1.25-kg-Scheiben), ohne unnoetige Nullen. */
  kg: Intl.NumberFormat;
  whole: Intl.NumberFormat;
  /** Mit Vorzeichen, eine Stelle: +2.5, −1.0 wird −1. */
  signed: Pick<Intl.NumberFormat, 'format'>;
  oneDecimal: Intl.NumberFormat;
};

/** Das echte Minuszeichen (U+2212) statt des Bindestrichs, den `Intl` für de-CH setzt. */
function typographicMinus(format: Intl.NumberFormat): Pick<Intl.NumberFormat, 'format'> {
  return { format: (value: number | bigint) => format.format(value).replace('-', '−') };
}

export function formatsOf(language: string): TrainingFormats {
  const locale = `${language}-CH`;
  return {
    kg: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    whole: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    signed: typographicMinus(
      new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }),
    ),
    oneDecimal: new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  };
}

/** 90 -> „1:30“, 5 -> „0:05“. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type SetLike = { weightKg: number | null; reps: number | null; seconds: number | null };

/**
 * Mehrere Saetze in einer Zeile: „60 kg × 8 · 8 · 7“; wechselt das Gewicht,
 * steht es neu davor („60 kg × 8 · 62.5 kg × 6“). Ohne Gewicht nur die
 * Wiederholungen, Zeituebungen in Sekunden.
 */
export function describeSets(
  sets: readonly SetLike[],
  formats: TrainingFormats,
  units: { kg: string; seconds: string },
): string {
  const parts: string[] = [];
  let weight: number | null | undefined;
  for (const set of sets) {
    if (set.seconds !== null && set.seconds > 0) {
      parts.push(`${formats.whole.format(set.seconds)} ${units.seconds}`);
      weight = undefined;
      continue;
    }
    const reps = formats.whole.format(set.reps ?? 0);
    const kg = set.weightKg !== null && set.weightKg > 0 ? set.weightKg : null;
    if (kg === null) {
      parts.push(reps);
      weight = null;
    } else if (kg === weight) {
      parts.push(reps);
    } else {
      parts.push(`${formats.kg.format(kg)} ${units.kg} × ${reps}`);
      weight = kg;
    }
  }
  return parts.join(' · ');
}

/** Grob je Satz: 45 s Arbeit plus die Pause — fuer die Minuten der Woche. */
const WORK_SECONDS = 45;

/** Wie lange das Training ungefaehr dauerte: Arbeitssaetze × (Arbeit + Pause), mindestens 10 Minuten. */
export function minutesOf(workout: {
  exercises: readonly { exerciseId: string; restSeconds: number }[];
  sets: readonly { exerciseId: string; warmup: boolean; seconds?: number | null }[];
}): number {
  const seconds = workout.sets
    .filter((set) => !set.warmup)
    .reduce(
      (sum, set) =>
        sum +
        (set.seconds && set.seconds > 0 ? set.seconds : WORK_SECONDS) +
        (workout.exercises.find((entry) => entry.exerciseId === set.exerciseId)?.restSeconds ?? 90),
      0,
    );
  return Math.max(10, Math.round(seconds / 60));
}

/** Muskelgruppen in fester Reihenfolge — so springen die Balken nicht von Woche zu Woche. */
export const MUSCLE_GROUPS = ['legs', 'chest', 'back', 'shoulders', 'arms', 'core'] as const;

/** Die Balken der Woche: diese und letzte Woche je Gruppe, nur Gruppen mit Saetzen. */
export function weekBars(
  groups: Readonly<Record<string, { sets: number }>>,
  lastGroups: Readonly<Record<string, { sets: number }>>,
): { group: string; sets: number; last: number; share: number; lastShare: number }[] {
  const known: string[] = [...MUSCLE_GROUPS];
  const extra = [...Object.keys(groups), ...Object.keys(lastGroups)].filter(
    (group) => !known.includes(group),
  );
  const rows = [...known, ...new Set(extra)]
    .map((group) => ({ group, sets: groups[group]?.sets ?? 0, last: lastGroups[group]?.sets ?? 0 }))
    .filter((row) => row.sets > 0 || row.last > 0);
  const peak = Math.max(1, ...rows.flatMap((row) => [row.sets, row.last]));
  return rows.map((row) => ({ ...row, share: row.sets / peak, lastShare: row.last / peak }));
}

/** `2026-09` -> Wochen (Montag zuerst) mit den Tagen des Monats, leere Felder als null. */
export function monthGrid(month: string): (string | null)[][] {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** Der Monat davor oder danach: `2026-01`, -1 -> `2025-12`. */
export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Der letzte Tag eines Monats als `YYYY-MM-DD`. */
export function monthEnd(month: string): string {
  const [year, number] = month.split('-').map(Number) as [number, number];
  return `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, '0')}`;
}

/** „6-8“ -> „6–8“: ein Bereich steht mit Halbgeviertstrich. */
export function dashRange(reps: string): string {
  return reps.replace(/(\d)\s*-\s*(\d)/g, '$1–$2');
}

/** Kurz fuer eine Zeile: „Kniebeuge mit Langhantel“ -> „Kniebeuge“ (Trenner je Sprache). */
export function shortName(name: string, separator: string): string {
  const cut = separator.trim() ? name.split(separator)[0] : name;
  return (cut ?? name).trim() || name;
}

/** Grob je Satz im Plan: 40 s Arbeit plus die Pause. */
const PLAN_WORK_SECONDS = 40;
const PLAN_ROUND_MINUTES = 5;

/** Wie lange ein geplantes Training dauert, auf 5 Minuten gerundet: „≈ 45 Min“. */
export function plannedMinutes(
  exercises: readonly { sets: number; restSeconds: number }[],
): number {
  const seconds = exercises.reduce(
    (sum, exercise) => sum + exercise.sets * (exercise.restSeconds + PLAN_WORK_SECONDS),
    0,
  );
  return Math.max(
    PLAN_ROUND_MINUTES,
    Math.round(seconds / 60 / PLAN_ROUND_MINUTES) * PLAN_ROUND_MINUTES,
  );
}
