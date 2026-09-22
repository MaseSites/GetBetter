import type { deFit7 } from './de-fit7';

/** Better Fit: Querschnitt (Einheiten, Fehler, Hinweise). Complete: a missing key is a type error. */
export const enFit7: Readonly<Record<keyof typeof deFit7, string>> = {
  'fit.count.portionOne': '1 serving',
  'fit.count.workoutOne': '1 workout',
  'fit.count.workouts': '{count} workouts',
  'fit.action.line.skip': 'Skip: “{title}” on {day}',
  'fit.action.done.skipped': 'Saved: “{title}” on {day} is skipped.',
};
