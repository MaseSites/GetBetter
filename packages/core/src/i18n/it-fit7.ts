import type { deFit7 } from './de-fit7';

/** Better Fit: Querschnitt (Einheiten, Fehler, Hinweise). Complete: a missing key is a type error. */
export const itFit7: Readonly<Record<keyof typeof deFit7, string>> = {
  'fit.count.portionOne': '1 porzione',
  'fit.count.workoutOne': '1 allenamento',
  'fit.count.workouts': '{count} allenamenti',
  'fit.action.line.skip': 'Saltare: «{title}» il {day}',
  'fit.action.done.skipped': 'Salvato: «{title}» del {day} è saltato.',
};
