/**
 * Trainingsplaene, Termine, Saetze und Fortschritt — reine Rechnung.
 *
 * - `buildSchedule`: aus Vorlage, Wochentagen und Ausstattung die Termine
 *   der naechsten Wochen, Uebungen passend ersetzt.
 * - `rescheduleCheck`: was dagegen spricht, ein Training zu verschieben
 *   (schon ein Training am Zieltag, dieselben Muskeln an zwei Tagen hinter-
 *   einander, Termine im Kalender) — die App zeigt es vor der Bestaetigung.
 * - `records`, `weeklyVolume`, `nextTarget`: Rekorde (geschaetztes 1RM nach
 *   Epley), Volumen und eine vorsichtige Steigerung.
 */
const { EXERCISES, TEMPLATES, equipmentSet, exerciseFor } = require('./templates.js');

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

function shiftDay(day, delta) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
}
const weekdayOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();

/**
 * Die Vorlage, die zu Ziel, Erfahrung, Tagen und Ausstattung passt.
 * Nur Maschinen (etwa Kieser) -> der Geraete-Zirkel; ohne Hanteln, Maschinen
 * und Kabel -> die Vorlage fuer zuhause. Sechs Tage laufen als Drücken /
 * Ziehen / Beine zweimal, mehr als sechs gibt es nicht.
 */
function pickTemplate({ goal, experience, daysPerWeek, equipment }) {
  const tags = equipmentSet(equipment);
  const days = Math.max(2, Math.min(6, daysPerWeek));
  if (tags.has('machine') && !tags.has('barbell') && !tags.has('dumbbell') && !tags.has('cable'))
    return TEMPLATES.find((template) => template.id === 'machines-2');
  const bodyOnly =
    !tags.has('barbell') && !tags.has('machine') && !tags.has('cable') && !tags.has('dumbbell');
  const pool = TEMPLATES.filter(
    (template) => !template.machines && (bodyOnly || !template.id.startsWith('home')),
  );
  const wanted = days === 6 ? 3 : days;
  const fits = pool.filter(
    (template) =>
      template.daysPerWeek === wanted &&
      template.goals.includes(goal) &&
      template.experience.includes(experience),
  );
  if (bodyOnly) {
    const home =
      fits.find((template) => template.id.startsWith('home')) ??
      pool.find((template) => template.id.startsWith('home') && template.daysPerWeek === wanted);
    if (home) return home;
  }
  // Sechs Tage: zweimal Drücken / Ziehen / Beine, wer schon Erfahrung hat.
  if (days === 6)
    return (
      fits.find((template) => template.id === 'ppl-3') ??
      fits[0] ??
      pool.find((template) => template.daysPerWeek === 3) ??
      null
    );
  return (
    fits[0] ??
    pool.find(
      (template) => template.daysPerWeek === wanted && template.experience.includes(experience),
    ) ??
    pool.find((template) => template.daysPerWeek === wanted) ??
    null
  );
}

/** Die Einheiten einer Vorlage mit den Uebungen fuer die Ausstattung. */
function sessionsOf(template, equipment) {
  return template.sessions.map((session) => ({
    title: session.title,
    exercises: session.exercises
      .map((entry) => {
        const id = exerciseFor(entry.id, equipment);
        if (!id) return null;
        return {
          exerciseId: id,
          name: EXERCISES[id].name,
          groups: EXERCISES[id].groups,
          sets: entry.sets,
          reps: entry.reps,
          restSeconds: entry.restSeconds,
          replaced: id !== entry.id ? entry.id : null,
        };
      })
      .filter(Boolean),
  }));
}

const dayNumber = (day) => Math.round(Date.parse(`${day}T12:00:00Z`) / 86400000);
const mondayOf = (day) => shiftDay(day, -((weekdayOf(day) + 6) % 7));

/** Die wievielte Woche seit dem Planstart (0 = die erste); jede fuenfte ist leichter. */
const weekIndexOf = (day, planStart) =>
  Math.floor((dayNumber(mondayOf(day)) - dayNumber(mondayOf(planStart))) / 7);
const isDeloadWeek = (day, planStart) => weekIndexOf(day, planStart) % 5 === 4;

/**
 * Termine fuer `weeks` Wochen ab `startDay` (oder bis `until`), an den
 * Wochentagen `weekdays` (0 = Sonntag). Die Einheiten wechseln der Reihe nach
 * ab `sessionStart`; jede fuenfte Woche seit `planStart` ist eine leichtere
 * (`deload`).
 */
function buildSchedule({
  template,
  weekdays,
  equipment,
  startDay,
  weeks = 4,
  planStart = startDay,
  sessionStart = 0,
  until = null,
}) {
  const sessions = sessionsOf(template, equipment);
  const chosen = new Set(weekdays);
  const workouts = [];
  let next = sessionStart;
  const days = until ? dayNumber(until) - dayNumber(startDay) + 1 : weeks * 7;
  for (let offset = 0; offset < days; offset += 1) {
    const day = shiftDay(startDay, offset);
    if (!chosen.has(weekdayOf(day))) continue;
    const session = sessions[next % sessions.length];
    workouts.push({
      day,
      title: session.title,
      exercises: session.exercises,
      status: 'planned',
      movedFrom: null,
      sessionIndex: next,
      deload: isDeloadWeek(day, planStart),
    });
    next += 1;
  }
  return workouts;
}

/** So weit reicht der Plan immer: zwei Wochen ab heute. */
const HORIZON_DAYS = 14;

/**
 * Der Plan laeuft weiter: was bis heute + 14 Tage noch fehlt. Nie rueckwirkend,
 * die Einheiten wechseln dort weiter, wo sie aufgehoert haben — gleich
 * gerechnet gibt dasselbe (kein Zufall). `rows`: die Termine dieses Plans.
 */
function extensionFor({ plan, template, rows, today }) {
  if (!plan || !template) return { workouts: [], until: null };
  const horizon = shiftDay(today, HORIZON_DAYS);
  const last =
    plan.generatedUntil ??
    rows.reduce((max, row) => {
      const day = row.movedFrom ?? row.day;
      return day > max ? day : max;
    }, '');
  if (last && last >= horizon) return { workouts: [], until: null };
  const startDay = last && last >= today ? shiftDay(last, 1) : today;
  const sessionStart =
    rows.length === 0
      ? 0
      : Math.max(
          rows.length - 1,
          ...rows.map((row) => (Number.isInteger(row.sessionIndex) ? row.sessionIndex : -1)),
        ) + 1;
  const workouts = buildSchedule({
    template,
    weekdays: plan.weekdays,
    equipment: plan.equipment,
    startDay,
    planStart: plan.startDay ?? plan.createdAt?.slice(0, 10) ?? startDay,
    sessionStart,
    until: horizon,
  });
  return { workouts, until: horizon };
}

const groupsOf = (workout) =>
  new Set((workout.exercises ?? []).flatMap((entry) => entry.groups ?? []));

/**
 * Pruefung vor dem Verschieben. `workouts`: alle Termine der Person,
 * `events`: Kalendertermine am Zieltag (nur Anzahl und Titel).
 */
function rescheduleCheck(workouts, workoutId, toDay, events = []) {
  const workout = workouts.find((entry) => entry.id === workoutId);
  if (!workout) return { ok: false, error: 'workout_not_found' };
  if (workout.status === 'done') return { ok: false, error: 'workout_done' };
  if (workout.day === toDay) return { ok: false, error: 'same_day' };
  const warnings = [];
  const active = workouts.filter((entry) => entry.id !== workoutId && entry.status !== 'skipped');
  const onTarget = active.filter((entry) => entry.day === toDay);
  if (onTarget.length > 0)
    warnings.push({ kind: 'double_session', titles: onTarget.map((entry) => entry.title) });
  const groups = groupsOf(workout);
  for (const neighbour of active.filter(
    (entry) => entry.day === shiftDay(toDay, -1) || entry.day === shiftDay(toDay, 1),
  )) {
    const overlap = [...groupsOf(neighbour)].filter(
      (group) => groups.has(group) && group !== 'core',
    );
    if (overlap.length > 0)
      warnings.push({
        kind: 'recovery',
        day: neighbour.day,
        title: neighbour.title,
        groups: overlap,
      });
  }
  if (events.length > 0)
    warnings.push({ kind: 'calendar', count: events.length, titles: events.slice(0, 3) });
  return { ok: true, workout, warnings };
}

/** Geschaetztes Maximum nach Epley: Gewicht × (1 + Wiederholungen / 30). */
const e1rm = (weightKg, reps) => Math.round(weightKg * (1 + reps / 30) * 10) / 10;

/** Nur Langhantel-Kniebeuge und Kreuzheben steigen in 5-kg-Schritten, alles andere in 2.5 kg. */
const BIG_LIFTS = new Set(['squat', 'deadlift']);

/** `timed` (Sekunden), `bodyweight` (nur Wiederholungen) oder `weighted`. */
function kindOf(exerciseId) {
  const definition = EXERCISES[exerciseId];
  if (definition?.timed) return 'timed';
  if (definition?.equipment === 'none') return 'bodyweight';
  return 'weighted';
}

/**
 * Wie gut ein Satz war, in seiner Art: mit Gewicht das geschaetzte Maximum,
 * sonst Wiederholungen oder Sekunden. Null, wenn er nichts zaehlt.
 */
function scoreOf(set) {
  if (!set || set.warmup) return null;
  if (Number.isFinite(set.seconds) && set.seconds > 0) return { kind: 'seconds', value: set.seconds };
  if (Number.isFinite(set.weightKg) && set.weightKg > 0 && Number.isFinite(set.reps))
    return { kind: 'weight', value: e1rm(set.weightKg, set.reps) };
  if (Number.isFinite(set.reps) && set.reps > 0) return { kind: 'reps', value: set.reps };
  return null;
}

const KIND_RANK = { weight: 3, seconds: 2, reps: 1 };

/**
 * Die Bestleistung je Uebung ueber alle Saetze (ohne Aufwaermsaetze): mit
 * Gewicht nach dem geschaetzten Maximum, ohne Gewicht nach Wiederholungen,
 * Zeituebungen nach Sekunden.
 */
function records(sets) {
  const best = {};
  for (const set of sets) {
    const score = scoreOf(set);
    if (!score) continue;
    const current = best[set.exerciseId];
    const better =
      !current ||
      KIND_RANK[score.kind] > KIND_RANK[current.kind] ||
      (score.kind === current.kind && score.value > current.value);
    if (better)
      best[set.exerciseId] = {
        exerciseId: set.exerciseId,
        kind: score.kind,
        value: score.value,
        weightKg: score.kind === 'weight' ? set.weightKg : null,
        reps: score.kind === 'seconds' ? null : set.reps,
        seconds: score.kind === 'seconds' ? set.seconds : null,
        e1rm: score.kind === 'weight' ? score.value : null,
        day: set.day,
      };
  }
  return best;
}

/**
 * Welche Saetze eines Trainings einen neuen Rekord setzen — verglichen mit der
 * Bestleistung vor diesem Training. Ohne fruehere Saetze derselben Art gibt es
 * keinen Rekord (der erste Satz ist nur ein Anfang).
 */
function recordSetIds(workoutSets, priorSets) {
  const best = new Map();
  for (const entry of Object.values(records(priorSets)))
    best.set(`${entry.exerciseId}:${entry.kind}`, entry.value);
  const ids = new Set();
  for (const set of workoutSets) {
    const score = scoreOf(set);
    if (!score) continue;
    const key = `${set.exerciseId}:${score.kind}`;
    if (!best.has(key)) continue;
    if (score.value > best.get(key)) {
      ids.add(set.id);
      best.set(key, score.value);
    }
  }
  return ids;
}

/** Volumen (Gewicht × Wiederholungen) je Muskelgruppe in den Saetzen einer Woche. */
function weeklyVolume(sets) {
  const volume = {};
  for (const set of sets) {
    if (set.warmup) continue;
    const groups = EXERCISES[set.exerciseId]?.groups ?? ['other'];
    for (const group of groups)
      volume[group] = Math.round((volume[group] ?? 0) + (set.weightKg ?? 0) * (set.reps ?? 0));
  }
  return volume;
}

/**
 * Je Muskelgruppe: Arbeitssaetze und Volumen in kg. Saetze zaehlen auch ohne
 * Gewicht — so steht die Liegestuetz-Woche nicht bei null.
 */
function muscleWeek(sets) {
  const week = {};
  for (const set of sets) {
    if (set.warmup) continue;
    for (const group of EXERCISES[set.exerciseId]?.groups ?? ['other']) {
      const entry = week[group] ?? { sets: 0, volumeKg: 0 };
      week[group] = {
        sets: entry.sets + 1,
        volumeKg: Math.round(entry.volumeKg + (set.weightKg ?? 0) * (set.reps ?? 0)),
      };
    }
  }
  return week;
}

/** Das beste geschaetzte Maximum je Trainingstag, aelteste zuerst — fuer den Verlauf. */
function e1rmHistory(sets, exerciseId) {
  const byDay = new Map();
  for (const set of sets) {
    if (set.exerciseId !== exerciseId) continue;
    const score = scoreOf(set);
    if (score?.kind !== 'weight') continue;
    byDay.set(set.day, Math.max(byDay.get(set.day) ?? 0, score.value));
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day, e1rm: value }));
}

/** „8-10“ -> { low: 8, high: 10 }, „30s“ -> { seconds: 30 }. */
function rangeOf(reps) {
  const text = String(reps ?? '');
  const seconds = /^(\d+)\s*s$/.exec(text);
  if (seconds) return { low: null, high: null, seconds: Number(seconds[1]) };
  const [low, high] = text.split('-').map(Number);
  return {
    low: Number.isFinite(low) ? low : null,
    high: Number.isFinite(high) ? high : Number.isFinite(low) ? low : null,
    seconds: null,
  };
}

const roundPlate = (value) => Math.round(value / 2.5) * 2.5;

/**
 * Das Ziel fuers naechste Mal aus der letzten Einheit (und der davor):
 *
 * - Zeituebung: 5 Sekunden mehr als die beste Zeit, hoechstens 600.
 * - Ohne Gewicht: eine Wiederholung mehr als der beste Satz.
 * - Mit Gewicht: alle Arbeitssaetze am oberen Ende mit mindestens 2 Reserve
 *   (unbekannte Reserve zaehlt nicht dagegen) -> +2.5 kg, bei Kniebeuge und
 *   Kreuzheben +5 kg. Zweimal hintereinander unter dem Bereich -> 10 % leichter.
 *   Sonst gleiches Gewicht.
 */
function nextTarget(exerciseId, lastSets, reps, previousSets = []) {
  const workOf = (sets) => sets.filter((set) => !set.warmup && set.exerciseId === exerciseId);
  const work = workOf(lastSets);
  if (work.length === 0) return null;
  const kind = kindOf(exerciseId);
  const range = rangeOf(reps);
  if (kind === 'timed' || work.every((set) => Number.isFinite(set.seconds))) {
    const best = Math.max(...work.map((set) => set.seconds ?? 0));
    return best > 0
      ? { weightKg: null, reps: null, seconds: Math.min(600, best + 5), reason: 'time' }
      : null;
  }
  const weight = Math.max(...work.map((set) => set.weightKg ?? 0));
  if (kind === 'bodyweight' || weight <= 0) {
    const best = Math.max(...work.map((set) => set.reps ?? 0));
    return { weightKg: null, reps: Math.min(100, best + 1), seconds: null, reason: 'reps' };
  }
  const below = (sets) =>
    range.low !== null && sets.length > 0 && sets.every((set) => (set.reps ?? 0) < range.low);
  if (below(work) && below(workOf(previousSets)))
    return { weightKg: roundPlate(weight * 0.9), reps: null, seconds: null, reason: 'reduce' };
  const known = (rir) => rir !== null && rir !== undefined;
  const allTop =
    range.high !== null &&
    work.every((set) => set.reps >= range.high && (!known(set.rir) || set.rir >= 2));
  if (!allTop) return { weightKg: weight, reps: null, seconds: null, reason: 'repeat' };
  return {
    weightKg: weight + (BIG_LIFTS.has(exerciseId) ? 5 : 2.5),
    reps: null,
    seconds: null,
    reason: 'progress',
  };
}

/** In der leichten Woche: 10 % weniger Gewicht, ein Satz weniger (mindestens zwei). */
function deloadOf(target, sets) {
  return {
    sets: Math.max(2, sets - 1),
    target:
      target && Number.isFinite(target.weightKg) && target.weightKg > 0
        ? { ...target, weightKg: roundPlate(target.weightKg * 0.9), reason: 'deload' }
        : target,
  };
}

/** Aufwaermsaetze vor dem ersten Arbeitssatz: 50 % × 8, 70 % × 5, 85 % × 2. */
function warmupSets(workWeightKg) {
  if (!Number.isFinite(workWeightKg) || workWeightKg < 30) return [];
  const round = (value) => Math.round(value / 2.5) * 2.5;
  return [
    { weightKg: round(workWeightKg * 0.5), reps: 8 },
    { weightKg: round(workWeightKg * 0.7), reps: 5 },
    { weightKg: round(workWeightKg * 0.85), reps: 2 },
  ];
}

module.exports = {
  BIG_LIFTS,
  HORIZON_DAYS,
  WEEKDAYS,
  buildSchedule,
  deloadOf,
  e1rm,
  e1rmHistory,
  extensionFor,
  isDeloadWeek,
  kindOf,
  mondayOf,
  muscleWeek,
  nextTarget,
  pickTemplate,
  rangeOf,
  recordSetIds,
  records,
  rescheduleCheck,
  scoreOf,
  sessionsOf,
  shiftDay,
  warmupSets,
  weeklyVolume,
};
