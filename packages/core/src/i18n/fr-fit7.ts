import type { deFit7 } from './de-fit7';

/** Better Fit: Querschnitt (Einheiten, Fehler, Hinweise). Complete: a missing key is a type error. */
export const frFit7: Readonly<Record<keyof typeof deFit7, string>> = {
  'fit.count.portionOne': '1 portion',
  'fit.count.workoutOne': '1 entraînement',
  'fit.count.workouts': '{count} entraînements',
  'fit.action.line.skip': 'Sauter : « {title} » le {day}',
  'fit.action.done.skipped': 'Enregistré : « {title} » du {day} est annulé.',
};
