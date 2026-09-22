/**
 * Trainingstag oder Ruhetag — eine Regel fuer Tagebuch, Tagesziel und Wochenplan.
 *
 * Gibt es geplante Einheiten, zaehlen nur sie. Ohne jeden Trainingsplan gilt
 * ein Muster aus dem Profil (z. B. drei Tage: Mo, Mi, Fr), damit Ziele und
 * Wochenplan schon vor dem ersten Plan zusammenpassen.
 */

/** Wochentage (1 = Montag … 0 = Sonntag) je Anzahl Trainingstage. */
const PATTERNS = { 0: [], 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

function dayKindOf(own, day) {
  const workouts = own.list('scheduledWorkouts');
  if (workouts.length > 0) return workouts.some((row) => row.day === day && row.status !== 'skipped') ? 'training' : 'rest';
  const count = own.list('profiles')[0]?.profile?.trainingDaysPerWeek ?? 0;
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return (PATTERNS[count] ?? []).includes(weekday) ? 'training' : 'rest';
}

module.exports = { PATTERNS, dayKindOf };
