/**
 * Werkzeuge fuer Training und Gewicht. Die Lese-Werkzeuge stehen in `reads.js`.
 */
const { goalsOf } = require('../diary.js');
const { EQUIPMENT_TAGS, GYMS } = require('../training/templates.js');
const { buildSchedule, pickTemplate, rescheduleCheck } = require('../training/training.js');
const { readTools } = require('./reads.js');

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const fail = (error, details) => ({ ok: false, error, details });

/** Ziel eines Tages je nach Trainings- oder Ruhetag — fuer die Auswirkung einer Verschiebung. */
function targetKcal(env, kind) {
  if (!env.profileRow) return null;
  const goals = goalsOf(env.ctx, env.profileRow, env.today, env.own);
  return kind === 'training' ? goals.trainingDay.kcal : goals.restDay.kcal;
}

const trainingTools = [
  {
    name: 'create_workout_plan',
    kind: 'write',
    validate(args) {
      const goals = ['strength', 'muscle', 'fitness', 'fatloss'];
      const levels = ['beginner', 'intermediate', 'advanced'];
      const presets = ['gym', 'dumbbells', 'bodyweight', 'bar_bodyweight'];
      const weekdays = Array.isArray(args.weekdays)
        ? [...new Set(args.weekdays.map(Number))].filter(
            (day) => Number.isInteger(day) && day >= 0 && day <= 6,
          )
        : [];
      // Ausstattung: ein alter Name oder eine Liste von Marken (Studio mit abgewaehlten Geraeten).
      const equipment = Array.isArray(args.equipment)
        ? [...new Set(args.equipment.map(String))].filter((tag) => EQUIPMENT_TAGS.includes(tag))
        : args.equipment;
      const equipmentOk = Array.isArray(equipment)
        ? equipment.length > 0 && equipment.length === new Set(args.equipment).size
        : presets.includes(equipment);
      if (!goals.includes(args.goal) || !levels.includes(args.experience) || !equipmentOk)
        return fail('args_invalid');
      if (args.gym !== undefined && args.gym !== null && !GYMS.some((gym) => gym.id === args.gym))
        return fail('args_invalid');
      if (weekdays.length < 2 || weekdays.length > 6) return fail('weekdays_invalid');
      if (args.startDay !== undefined && !DAY.test(String(args.startDay)))
        return fail('day_invalid');
      return {
        ok: true,
        args: {
          goal: args.goal,
          experience: args.experience,
          equipment,
          gym: args.gym ?? null,
          weekdays: weekdays.sort(),
          startDay: args.startDay ?? null,
          weeks: Math.min(8, Math.max(1, Number(args.weeks) || 4)),
        },
      };
    },
    preview(env, args) {
      const template = pickTemplate({
        goal: args.goal,
        experience: args.experience,
        daysPerWeek: args.weekdays.length,
        equipment: args.equipment,
      });
      if (!template) return fail('no_template');
      const startDay = args.startDay ?? env.today;
      const workouts = buildSchedule({
        template,
        weekdays: args.weekdays,
        equipment: args.equipment,
        startDay,
        weeks: args.weeks,
      });
      // Was vom alten Plan noch kommt, faellt weg — Erledigtes, Vergangenes und
      // Angefangenes (mit Saetzen) bleibt.
      const started = new Set(env.own.list('workoutLogs').map((row) => row.workoutId));
      const replaced = env.own
        .list(
          'scheduledWorkouts',
          (row) =>
            row.status === 'planned' && row.day >= startDay && row.planId && !started.has(row.id),
        )
        .map((row) => row.id);
      const kept = env.own.list(
        'scheduledWorkouts',
        (row) => row.status === 'planned' && row.day >= startDay && started.has(row.id),
      ).length;
      // Jede Einheit einmal, mit ihren Uebungen — so sieht man vor dem Bestaetigen, was kommt.
      const seen = new Set();
      const sessions = workouts
        .filter((workout) => !seen.has(workout.title) && seen.add(workout.title))
        .map((workout) => ({
          title: workout.title,
          exercises: workout.exercises.map((entry) => ({
            exerciseId: entry.exerciseId,
            name: entry.name,
            sets: entry.sets,
            reps: entry.reps,
          })),
        }));
      return {
        ok: true,
        summary: {
          kind: 'workout_plan',
          templateId: template.id,
          template: template.name,
          sessions: template.sessions.map((session) => session.title),
          sessionDetails: sessions,
          weekdays: args.weekdays,
          count: workouts.length,
          first: workouts[0]?.day ?? null,
          replaces: replaced.length,
          keeps: kept,
        },
        changes: [
          { op: 'add', templateId: template.id, name: template.name, workouts, replaced, startDay },
        ],
      };
    },
    apply(env, args, preview) {
      const [change] = preview.changes;
      const now = env.ctx.now().toISOString();
      for (const id of change.replaced)
        env.own.remove('scheduledWorkouts', id, { reason: 'create_workout_plan' });
      for (const old of env.own.list('workoutPlans', (row) => row.active))
        env.own.update('workoutPlans', old.id, { active: false });
      const plan = env.own.insert(
        'workoutPlans',
        {
          name: change.name,
          templateId: change.templateId,
          goal: args.goal,
          experience: args.experience,
          equipment: args.equipment,
          gym: args.gym,
          weekdays: args.weekdays,
          active: true,
          startDay: change.startDay,
          // Danach verlaengert sich der Plan selbst (`extensionFor`), immer bis heute + 14 Tage.
          generatedUntil: change.workouts.at(-1)?.day ?? change.startDay,
          createdAt: now,
        },
        { reason: 'create_workout_plan' },
      );
      for (const workout of change.workouts)
        env.own.insert(
          'scheduledWorkouts',
          { ...workout, planId: plan.id, createdAt: now },
          { reason: 'create_workout_plan' },
        );
      return {
        ok: true,
        result: {
          kind: 'workout_plan_saved',
          planId: plan.id,
          templateId: change.templateId,
          name: change.name,
          count: change.workouts.length,
        },
      };
    },
  },
  {
    name: 'reschedule_workout',
    kind: 'write',
    validate(args) {
      const toDay = String(args.toDay ?? '');
      if (!DAY.test(toDay)) return fail('day_invalid');
      if (typeof args.workoutId === 'string')
        return { ok: true, args: { workoutId: args.workoutId, toDay } };
      if (DAY.test(String(args.fromDay ?? '')))
        return { ok: true, args: { fromDay: args.fromDay, toDay } };
      return fail('workout_missing');
    },
    async preview(env, args) {
      const workouts = env.own.list('scheduledWorkouts');
      const workout = args.workoutId
        ? workouts.find((row) => row.id === args.workoutId)
        : workouts.find((row) => row.day === args.fromDay && row.status === 'planned');
      if (!workout) return fail('workout_not_found');
      const events = env.ctx.calendar ? await env.ctx.calendar(env.accountId, args.toDay) : [];
      const check = rescheduleCheck(workouts, workout.id, args.toDay, events);
      if (!check.ok) return fail(check.error);
      // Saetze gehoeren zu dem Tag, an dem sie gemacht wurden — ein angefangenes Training bleibt.
      if (env.own.list('workoutLogs', (row) => row.workoutId === workout.id).length > 0)
        return fail('workout_started');
      // Nach dem Verschieben zaehlen nur noch geplante Einheiten — mit Plan gibt es kein Muster mehr.
      const others = (day) =>
        workouts.some(
          (row) => row.id !== workout.id && row.day === day && row.status !== 'skipped',
        );
      // Das Training wandert — mit ihm das hoehere Tagesziel.
      const nutrition = [
        {
          day: workout.day,
          before: targetKcal(env, 'training'),
          after: targetKcal(env, others(workout.day) ? 'training' : 'rest'),
        },
        {
          day: args.toDay,
          before: targetKcal(env, others(args.toDay) ? 'training' : 'rest'),
          after: targetKcal(env, 'training'),
        },
      ];
      return {
        ok: true,
        summary: {
          kind: 'reschedule',
          title: workout.title,
          fromDay: workout.day,
          toDay: args.toDay,
          warnings: check.warnings,
          nutrition,
        },
        changes: [{ op: 'move', id: workout.id, fromDay: workout.day, toDay: args.toDay }],
      };
    },
    apply(env, args, preview) {
      const [change] = preview.changes;
      const row = env.own.update(
        'scheduledWorkouts',
        change.id,
        {
          day: change.toDay,
          movedFrom: change.fromDay,
          status: 'planned',
          updatedAt: env.ctx.now().toISOString(),
        },
        { reason: 'reschedule_workout' },
      );
      return {
        ok: true,
        result: {
          kind: 'workout_moved',
          workoutId: row.id,
          title: row.title,
          fromDay: change.fromDay,
          toDay: row.day,
        },
      };
    },
  },
  {
    // „Ich lasse das Training heute aus“: als Vorschlag, mit dem, was es fuers Essen heisst.
    name: 'skip_workout',
    kind: 'write',
    validate(args) {
      if (typeof args.workoutId === 'string')
        return { ok: true, args: { workoutId: args.workoutId } };
      if (args.day !== undefined && !DAY.test(String(args.day))) return fail('day_invalid');
      return { ok: true, args: { day: args.day ?? null } };
    },
    preview(env, args) {
      const day = args.day ?? env.today;
      const workouts = env.own.list('scheduledWorkouts');
      const workout = args.workoutId
        ? workouts.find((row) => row.id === args.workoutId)
        : workouts.find((row) => row.day === day && row.status === 'planned');
      if (!workout) return fail('workout_not_found');
      if (workout.status === 'done') return fail('workout_done');
      if (workout.status === 'skipped') return fail('no_changes');
      if (env.own.list('workoutLogs', (row) => row.workoutId === workout.id).length > 0)
        return fail('workout_started');
      const others = workouts.some(
        (row) => row.id !== workout.id && row.day === workout.day && row.status !== 'skipped',
      );
      return {
        ok: true,
        summary: {
          kind: 'skip',
          title: workout.title,
          day: workout.day,
          nutrition: [
            {
              day: workout.day,
              before: targetKcal(env, 'training'),
              after: targetKcal(env, others ? 'training' : 'rest'),
            },
          ],
        },
        changes: [{ op: 'skip', id: workout.id, day: workout.day }],
      };
    },
    apply(env, args, preview) {
      const [change] = preview.changes;
      const row = env.own.update(
        'scheduledWorkouts',
        change.id,
        { status: 'skipped', updatedAt: env.ctx.now().toISOString() },
        { reason: 'skip_workout' },
      );
      return {
        ok: true,
        result: { kind: 'workout_skipped', workoutId: row.id, title: row.title, day: row.day },
      };
    },
  },
  {
    name: 'log_weight',
    kind: 'write',
    validate(args) {
      const weightKg = Number(args.weightKg);
      if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 350)
        return fail('weight_invalid');
      if (args.day !== undefined && !DAY.test(String(args.day))) return fail('day_invalid');
      return {
        ok: true,
        args: { weightKg: Math.round(weightKg * 10) / 10, day: args.day ?? null },
      };
    },
    preview(env, args) {
      const day = args.day ?? env.today;
      const existing = env.own.list('weightEntries', (row) => row.day === day)[0];
      return {
        ok: true,
        summary: {
          kind: 'weight',
          day,
          weightKg: args.weightKg,
          replaces: existing?.weightKg ?? null,
        },
        changes: [
          {
            op: existing ? 'update' : 'add',
            id: existing?.id ?? null,
            day,
            weightKg: args.weightKg,
          },
        ],
      };
    },
    apply(env, args, preview) {
      const [change] = preview.changes;
      if (change.op === 'update')
        env.own.update(
          'weightEntries',
          change.id,
          { weightKg: change.weightKg },
          { reason: 'log_weight' },
        );
      else
        env.own.insert(
          'weightEntries',
          { day: change.day, weightKg: change.weightKg, createdAt: env.ctx.now().toISOString() },
          { reason: 'log_weight' },
        );
      return {
        ok: true,
        result: { kind: 'weight_saved', day: change.day, weightKg: change.weightKg },
      };
    },
  },
];

module.exports = { readTools, trainingTools };
