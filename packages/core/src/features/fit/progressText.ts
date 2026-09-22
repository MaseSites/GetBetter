/**
 * Kleine Rechnungen fuer den Fortschritt: wie das Tempo zum Plan steht und die
 * kurzen Namen der Uebungen („Kniebeuge“ statt „Kniebeuge mit Langhantel“).
 */

/** kg je Woche, wie der Dienst plant (`services/api/fit/goals.js`). */
const PACE_KG_PER_WEEK = {
  lose: { gentle: 0.25, moderate: 0.5 },
  gain: { gentle: 0.125, moderate: 0.25 },
} as const;
/** Darunter ist die Abweichung Rauschen — dieselbe Schwelle wie der Kalorien-Vorschlag. */
const NOISE_KG = 0.15;

export type Pace = 'onTrack' | 'faster' | 'slower' | 'off' | 'none';

export function plannedKgPerWeek(
  profile: { goal: 'lose' | 'maintain' | 'gain'; pace: 'gentle' | 'moderate' } | null,
): number | null {
  if (!profile) return null;
  if (profile.goal === 'lose') return -PACE_KG_PER_WEEK.lose[profile.pace];
  if (profile.goal === 'gain') return PACE_KG_PER_WEEK.gain[profile.pace];
  return 0;
}

/** Das Tempo des Trends gegen den Plan. Beim Halten gibt es kein schneller oder langsamer. */
export function paceOf(actualPerWeek: number, planned: number | null): Pace {
  if (planned === null) return 'none';
  const gap = actualPerWeek - planned;
  if (Math.abs(gap) < NOISE_KG) return 'onTrack';
  if (planned === 0) return 'off';
  // Beim Abnehmen ist „mehr minus“ schneller, beim Zunehmen „mehr plus“.
  return Math.sign(gap) === Math.sign(planned) ? 'faster' : 'slower';
}

const TAIL = /\s+(mit|am|an der|an|auf der|auf|im|with|on|avec|au|à la|con|al|alla)\s.+$/iu;

/** Der Kopf eines Uebungsnamens — ohne Geraet und Klammern. */
export function shortExerciseName(name: string): string {
  const head = (name.split(',')[0] ?? name)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(TAIL, '')
    .trim();
  return head.length > 0 ? head : name.trim();
}

/** Kurz, solange es eindeutig bleibt — zwei Mal „Rudern“ bleiben lang. */
export function shortExerciseNames(names: readonly string[]): string[] {
  const shorts = names.map(shortExerciseName);
  return shorts.map((short, index) =>
    shorts.filter((other) => other.toLocaleLowerCase() === short.toLocaleLowerCase()).length > 1
      ? (names[index] ?? short)
      : short,
  );
}
