/**
 * Training: Vorlagen, Termine, Saetze, Fortschritt.
 *
 * Einen Plan anlegen, ein Training verschieben oder auslassen laufen als
 * Vorschlag (`create_workout_plan`, `reschedule_workout`, `skip_workout`).
 * Direkt gehen die eigenen Handgriffe im Training: Satz eintragen oder
 * loeschen, erledigt, ausgelassen, wieder oeffnen — mit festen Regeln:
 *
 *   geplant  -> erledigt (nur mit mindestens einem Arbeitssatz) | ausgelassen
 *   erledigt | ausgelassen -> geplant (wieder oeffnen)
 *   Saetze nur, solange das Training geplant ist; hoechstens 60 je Uebung.
 *
 * Namen, Anleitungen und Titel kommen in der Sprache der Anfrage
 * (`training/texts.js`); gespeichert sind nur Ids und der deutsche Titel.
 */
const { weightTrend } = require('../goals.js');
const { EQUIPMENT_TAGS, EXERCISES, GYMS, TEMPLATES, swapsFor } = require('../training/templates.js');
const {
  exerciseHint,
  exerciseName,
  localizeAction,
  sessionTitle,
  templateName,
} = require('../training/texts.js');
const {
  deloadOf,
  e1rmHistory,
  extensionFor,
  kindOf,
  mondayOf,
  muscleWeek,
  nextTarget,
  recordSetIds,
  records,
  shiftDay,
  warmupSets,
} = require('../training/training.js');

const MAX_SETS_PER_EXERCISE = 60;
const MAX_RANGE_DAYS = 400;
/** Verpasst heisst: geplant, vorbei, aber nicht laenger als zwei Wochen her. */
const MISSED_DAYS = 14;

const isWork = (set) => !set.warmup;
const blank = (value) => value === null || value === undefined || value === '';

function trainingRoutes(ctx, engine) {
  const { ok, store } = ctx;
  const todayOf = (own) => ctx.todayIn(own.list('profiles')[0]?.profile?.timezone, ctx.now());
  const templateOf = (plan) => TEMPLATES.find((template) => template.id === plan?.templateId) ?? null;

  /** Der Plan laeuft weiter: fehlt etwas bis heute + 14 Tage, wird es angelegt (einmal, in einer Transaktion). */
  async function extend(accountId) {
    const needed = await store.read((tx) => {
      const own = tx.forOwner(accountId);
      const plan = own.list('workoutPlans', (row) => row.active)[0];
      if (!plan) return false;
      const rows = own.list('scheduledWorkouts', (row) => row.planId === plan.id);
      return extensionFor({ plan, template: templateOf(plan), rows, today: todayOf(own) }).workouts.length > 0;
    });
    if (!needed) return;
    await store.transact((tx) => {
      const own = tx.forOwner(accountId);
      const plan = own.list('workoutPlans', (row) => row.active)[0];
      if (!plan) return;
      const rows = own.list('scheduledWorkouts', (row) => row.planId === plan.id);
      const { workouts, until } = extensionFor({ plan, template: templateOf(plan), rows, today: todayOf(own) });
      if (workouts.length === 0) return;
      const now = ctx.now().toISOString();
      for (const workout of workouts)
        own.insert('scheduledWorkouts', { ...workout, planId: plan.id, createdAt: now }, { reason: 'plan_extend' });
      own.update('workoutPlans', plan.id, { generatedUntil: until }, { reason: 'plan_extend' });
    });
  }

  function detail(own, workout, language) {
    const sets = own
      .list('workoutLogs', (row) => row.workoutId === workout.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // Alles vor diesem Training: fuer Rekord, „Letztes Mal“ und das Ziel.
    const prior = own.list(
      'workoutLogs',
      (row) => row.workoutId !== workout.id && row.day <= workout.day,
    );
    const recordIds = recordSetIds(sets, prior);
    const best = records(prior);
    // Getauscht wird nur gegen, was die Ausstattung des Plans hergibt.
    const equipment =
      (workout.planId ? own.get('workoutPlans', workout.planId)?.equipment : null) ?? 'gym';
    return {
      ...workout,
      title: sessionTitle(workout.title, language),
      deload: workout.deload === true,
      sets: sets.map((set) => ({
        id: set.id,
        exerciseId: set.exerciseId,
        reps: set.reps ?? null,
        weightKg: set.weightKg ?? null,
        seconds: set.seconds ?? null,
        rir: set.rir ?? null,
        warmup: set.warmup === true,
        isRecord: recordIds.has(set.id),
      })),
      workSets: sets.filter(isWork).length,
      // Wann der erste Satz kam — fuer „seit 18 Minuten“ im Heft.
      startedAt: sets[0]?.createdAt ?? null,
      exercises: workout.exercises.map((exercise) => {
        const earlier = prior
          .filter((set) => set.exerciseId === exercise.exerciseId && isWork(set))
          .sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));
        const sessionIds = [...new Set(earlier.map((set) => set.workoutId))];
        const ofSession = (id) =>
          earlier
            .filter((set) => set.workoutId === id)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const lastSets = sessionIds[0] ? ofSession(sessionIds[0]) : [];
        const previousSets = sessionIds[1] ? ofSession(sessionIds[1]) : [];
        const kind = kindOf(exercise.exerciseId);
        const planned = nextTarget(exercise.exerciseId, lastSets, exercise.reps, previousSets);
        const { sets: count, target } = workout.deload
          ? deloadOf(planned, exercise.sets)
          : { sets: exercise.sets, target: planned };
        const swaps = swapsFor(exercise.exerciseId, equipment).map((id) => ({
          exerciseId: id,
          name: exerciseName(id, language),
        }));
        return {
          ...exercise,
          sets: count,
          name: exerciseName(exercise.exerciseId, language),
          hint: exerciseHint(exercise.exerciseId, language),
          kind,
          timed: kind === 'timed',
          bodyweight: kind === 'bodyweight',
          barbell: EXERCISES[exercise.exerciseId]?.equipment === 'barbell',
          swaps,
          target,
          last: lastSets.length
            ? {
                day: lastSets[0].day,
                sets: lastSets.map((set) => ({
                  weightKg: set.weightKg ?? null,
                  reps: set.reps ?? null,
                  seconds: set.seconds ?? null,
                })),
              }
            : null,
          warmup: kind === 'weighted' && target?.weightKg ? warmupSets(target.weightKg) : [],
          record: best[exercise.exerciseId] ?? null,
        };
      }),
    };
  }

  const summaryOf = (own, language) => (row) => ({
    id: row.id,
    day: row.day,
    title: sessionTitle(row.title, language),
    status: row.status,
    movedFrom: row.movedFrom ?? null,
    exercises: row.exercises.length,
    deload: row.deload === true,
    sets: own.list('workoutLogs', (set) => set.workoutId === row.id && isWork(set)).length,
  });

  /** Ein Handgriff am Training: nur wenn der Zustand passt. */
  const TRANSITIONS = {
    complete: { from: ['planned'], to: 'done' },
    skip: { from: ['planned'], to: 'skipped' },
    reopen: { from: ['done', 'skipped'], to: 'planned' },
  };

  return [
    {
      method: 'GET',
      path: /^\/v1\/fit\/workout-templates$/,
      handler: async ({ language }) =>
        ok(200, {
          templates: TEMPLATES.map((template) => ({
            id: template.id,
            name: templateName(template.id, language),
            daysPerWeek: template.daysPerWeek,
            goals: template.goals,
            experience: template.experience,
            sessions: template.sessions.map((session) => ({
              title: sessionTitle(session.title, language),
              exercises: session.exercises.map((entry) => ({
                ...entry,
                name: exerciseName(entry.id, language),
              })),
            })),
          })),
        }),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/workout-plans$/,
      body: true,
      handler: async ({ auth, body, language }) => {
        const result = await engine.propose(auth.accountId, 'create_workout_plan', body);
        return result.body?.action
          ? ok(result.status, { ...result.body, action: localizeAction(result.body.action, language) })
          : result;
      },
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/gyms$/,
      handler: async () =>
        ok(200, { gyms: GYMS, equipment: EQUIPMENT_TAGS.filter((tag) => tag !== 'none') }),
    },
    {
      // Geraet besetzt oder fehlt: eine Uebung in diesem einen Training tauschen — ein eigener Handgriff wie ein Satz.
      method: 'POST',
      path: /^\/v1\/fit\/workouts\/([^/]+)\/swap$/,
      body: true,
      handler: ({ auth, params: [id], body, language }) =>
        store.transact((tx) => {
          const own = tx.forOwner(auth.accountId);
          const workout = own.get('scheduledWorkouts', id);
          if (!workout) return ok(404, { error: 'not_found' });
          if (workout.status !== 'planned') return ok(409, { error: 'workout_closed' });
          const index = workout.exercises.findIndex((exercise) => exercise.exerciseId === body.from);
          const to = Object.hasOwn(EXERCISES, String(body.to)) ? EXERCISES[body.to] : null;
          if (index < 0 || !to || workout.exercises.some((exercise) => exercise.exerciseId === body.to))
            return ok(400, { error: 'exercise_invalid' });
          if (own.list('workoutLogs', (row) => row.workoutId === id && row.exerciseId === body.from).length > 0)
            return ok(409, { error: 'exercise_started' });
          const exercises = workout.exercises.map((exercise, at) =>
            at === index
              ? {
                  ...exercise,
                  exerciseId: body.to,
                  name: to.name,
                  groups: to.groups,
                  replaced: exercise.replaced ?? exercise.exerciseId,
                }
              : exercise,
          );
          const next = own.update(
            'scheduledWorkouts',
            id,
            { exercises, updatedAt: ctx.now().toISOString() },
            { reason: 'workout_swap' },
          );
          return ok(200, { workout: detail(own, next, language) });
        }),
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/workouts$/,
      handler: async ({ auth, url, language }) => {
        await extend(auth.accountId);
        return store.read((tx) => {
          const own = tx.forOwner(auth.accountId);
          const today = todayOf(own);
          const asked = (name) => (ctx.isDay(url.searchParams.get(name)) ? url.searchParams.get(name) : null);
          const from = asked('from') ?? shiftDay(today, -7);
          let to = asked('to') ?? shiftDay(today, 21);
          if (to < from) return ok(400, { error: 'range_invalid' });
          if (to > shiftDay(from, MAX_RANGE_DAYS)) to = shiftDay(from, MAX_RANGE_DAYS);
          const summary = summaryOf(own, language);
          const workouts = own
            .list('scheduledWorkouts', (row) => row.day >= from && row.day <= to)
            .sort((a, b) => a.day.localeCompare(b.day));
          const missed = own
            .list(
              'scheduledWorkouts',
              (row) => row.status === 'planned' && row.day < today && row.day >= shiftDay(today, -MISSED_DAYS),
            )
            .sort((a, b) => b.day.localeCompare(a.day));
          const plan = own.list('workoutPlans', (row) => row.active)[0] ?? null;
          return ok(200, {
            from,
            to,
            today,
            plan: plan ? { ...plan, name: templateName(plan.templateId, language) ?? plan.name } : null,
            workouts: workouts.map(summary),
            missed: missed.map(summary),
          });
        });
      },
    },
    {
      method: 'GET',
      path: /^\/v1\/fit\/workouts\/([^/]+)$/,
      handler: ({ auth, params: [id], language }) =>
        store.read((tx) => {
          const own = tx.forOwner(auth.accountId);
          const workout = own.get('scheduledWorkouts', id);
          return workout ? ok(200, { workout: detail(own, workout, language) }) : ok(404, { error: 'not_found' });
        }),
    },
    {
      method: 'POST',
      path: /^\/v1\/fit\/workouts\/([^/]+)\/sets$/,
      body: true,
      handler: ({ auth, params: [id], body, language }) =>
        store.transact((tx) => {
          const own = tx.forOwner(auth.accountId);
          const workout = own.get('scheduledWorkouts', id);
          if (!workout) return ok(404, { error: 'not_found' });
          if (workout.status !== 'planned') return ok(409, { error: 'workout_closed' });
          // Ein Satz an einem Training, das erst naechste Woche ansteht, gibt es
          // nicht — sonst steht es danach als „erledigt“ mit Zukunftsdatum im
          // Verlauf. Wer heute trainiert, holt die Einheit auf heute vor
          // („Heute nachholen“), statt in der Zukunft zu buchen.
          if (workout.day > todayOf(own)) return ok(409, { error: 'workout_future' });
          if (!workout.exercises.some((exercise) => exercise.exerciseId === body.exerciseId))
            return ok(400, { error: 'exercise_invalid' });
          const count = own.list(
            'workoutLogs',
            (row) => row.workoutId === id && row.exerciseId === body.exerciseId,
          ).length;
          if (count >= MAX_SETS_PER_EXERCISE) return ok(409, { error: 'too_many_sets' });
          const timed = kindOf(body.exerciseId) === 'timed';
          const seconds = timed ? Number(body.seconds) : null;
          const reps = timed ? null : Number(body.reps);
          const weightKg = timed || blank(body.weightKg) ? null : Number(body.weightKg);
          const rir = timed || blank(body.rir) ? null : Number(body.rir);
          if (timed && (!Number.isInteger(seconds) || seconds < 1 || seconds > 600))
            return ok(400, { error: 'seconds_invalid' });
          if (!timed && (!Number.isInteger(reps) || reps < 1 || reps > 100))
            return ok(400, { error: 'reps_invalid' });
          if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 1000))
            return ok(400, { error: 'weight_invalid' });
          if (rir !== null && (!Number.isInteger(rir) || rir < 0 || rir > 10))
            return ok(400, { error: 'rir_invalid' });
          const set = own.insert('workoutLogs', {
            workoutId: id,
            day: workout.day,
            exerciseId: body.exerciseId,
            reps,
            seconds,
            weightKg: weightKg === null ? null : Math.round(weightKg * 4) / 4,
            rir,
            warmup: body.warmup === true,
            createdAt: ctx.now().toISOString(),
          });
          const next = detail(own, own.get('scheduledWorkouts', id), language);
          const saved = next.sets.find((entry) => entry.id === set.id) ?? null;
          return ok(201, { workout: next, set: saved });
        }),
    },
    {
      method: 'DELETE',
      path: /^\/v1\/fit\/workouts\/([^/]+)\/sets\/([^/]+)$/,
      handler: ({ auth, params: [id, setId], language }) =>
        store.transact((tx) => {
          const own = tx.forOwner(auth.accountId);
          const set = own.get('workoutLogs', setId);
          if (!set || set.workoutId !== id) return ok(404, { error: 'not_found' });
          if (own.get('scheduledWorkouts', id)?.status !== 'planned')
            return ok(409, { error: 'workout_closed' });
          own.remove('workoutLogs', setId);
          return ok(200, { workout: detail(own, own.get('scheduledWorkouts', id), language) });
        }),
    },
    ...Object.entries(TRANSITIONS).map(([action, rule]) => ({
      method: 'POST',
      path: new RegExp(`^/v1/fit/workouts/([^/]+)/${action}$`),
      handler: ({ auth, params: [id], language }) =>
        store.transact((tx) => {
          const own = tx.forOwner(auth.accountId);
          const workout = own.get('scheduledWorkouts', id);
          if (!workout) return ok(404, { error: 'not_found' });
          if (!rule.from.includes(workout.status)) return ok(409, { error: 'status_invalid' });
          if (
            action === 'complete' &&
            own.list('workoutLogs', (row) => row.workoutId === id && isWork(row)).length === 0
          )
            return ok(409, { error: 'no_sets' });
          const next = own.update(
            'scheduledWorkouts',
            id,
            { status: rule.to, updatedAt: ctx.now().toISOString() },
            { reason: `workout_${action}` },
          );
          return ok(200, { workout: detail(own, next, language) });
        }),
    })),
    {
      method: 'GET',
      path: /^\/v1\/fit\/progress$/,
      handler: ({ auth, language }) =>
        store.read((tx) => {
          const own = tx.forOwner(auth.accountId);
          const today = todayOf(own);
          const sets = own.list('workoutLogs');
          const since = shiftDay(today, -55);
          const best = Object.values(records(sets)).map((entry) => {
            const history = e1rmHistory(sets, entry.exerciseId).filter((point) => point.day >= since);
            const change =
              history.length > 1 ? Math.round((history.at(-1).e1rm - history[0].e1rm) * 10) / 10 : null;
            return { ...entry, name: exerciseName(entry.exerciseId, language), history: history.slice(-8), change };
          });
          const done = own.list('scheduledWorkouts', (row) => row.status === 'done');
          const doneIds = new Set(done.map((row) => row.id));
          const weekStart = mondayOf(today);
          const lastWeekStart = shiftDay(weekStart, -7);
          const inWeek = (start) =>
            sets.filter((set) => doneIds.has(set.workoutId) && set.day >= start && set.day <= shiftDay(start, 6));
          const doneIn = (start) => done.filter((row) => row.day >= start && row.day <= shiftDay(start, 6)).length;
          // Zuerst mit Gewicht (nach geschaetztem Maximum), dann Wiederholungen und Sekunden.
          const rank = (entry) => (entry.kind === 'weight' ? 0 : 1);
          return ok(200, {
            records: best.sort((a, b) => rank(a) - rank(b) || (b.e1rm ?? b.value) - (a.e1rm ?? a.value)),
            volume: muscleWeek(inWeek(weekStart)),
            week: {
              start: weekStart,
              groups: muscleWeek(inWeek(weekStart)),
              lastGroups: muscleWeek(inWeek(lastWeekStart)),
              workouts: doneIn(weekStart),
              lastWorkouts: doneIn(lastWeekStart),
            },
            workoutsDone28: done.filter((row) => row.day >= shiftDay(today, -27)).length,
            weight: weightTrend(own.list('weightEntries')).slice(-60),
          });
        }),
    },
  ];
}

module.exports = { trainingRoutes };
