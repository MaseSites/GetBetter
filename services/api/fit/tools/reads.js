/**
 * Werkzeuge, die nur lesen — dieselben fuer die App und fuer den Coach.
 */
const { weightTrend } = require('../goals.js');
const { suggestRecipes } = require('../kitchen/suggest.js');
const { daySummary } = require('../routes/diary.js');
const { records, shiftDay } = require('../training/training.js');
const { lookups, pantryOf } = require('./kitchen.js');

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const noArgs = () => ({ ok: true, args: {} });
const slotArgs = (args) => ({
  ok: true,
  args: { slot: ['breakfast', 'lunch', 'dinner', 'snack'].includes(args.slot) ? args.slot : null },
});

const readTools = [
  {
    name: 'get_today_summary',
    kind: 'read',
    validate: noArgs,
    run: (env) => ({ ok: true, data: daySummary(env.ctx, env.own, env.today) }),
  },
  {
    name: 'get_remaining_macros',
    kind: 'read',
    validate: noArgs,
    run(env) {
      const summary = daySummary(env.ctx, env.own, env.today);
      return {
        ok: true,
        data: {
          day: summary.day,
          kind: summary.kind,
          target: summary.target,
          eaten: summary.total,
          remaining: summary.remaining,
        },
      };
    },
  },
  {
    name: 'get_workout_schedule',
    kind: 'read',
    validate: (args) => ({
      ok: true,
      args: {
        from: DAY.test(String(args.from ?? '')) ? args.from : null,
        days: Math.min(28, Math.max(1, Number(args.days) || 7)),
      },
    }),
    run(env, args) {
      const from = args.from ?? env.today;
      const to = shiftDay(from, args.days - 1);
      const workouts = env.own
        .list('scheduledWorkouts', (row) => row.day >= from && row.day <= to)
        .sort((a, b) => a.day.localeCompare(b.day));
      return {
        ok: true,
        data: {
          from,
          to,
          workouts: workouts.map((row) => ({
            id: row.id,
            day: row.day,
            title: row.title,
            status: row.status,
          })),
        },
      };
    },
  },
  {
    // Die Bestleistungen, mit Gewicht zuerst — fuer „Was sind meine Rekorde?“.
    name: 'get_records',
    kind: 'read',
    validate: noArgs,
    run(env) {
      const rank = (entry) => (entry.kind === 'weight' ? 0 : 1);
      const best = Object.values(records(env.own.list('workoutLogs')))
        .sort((a, b) => rank(a) - rank(b) || (b.e1rm ?? b.value) - (a.e1rm ?? a.value))
        .slice(0, 5);
      return { ok: true, data: { records: best } };
    },
  },
  {
    name: 'get_pantry_items',
    kind: 'read',
    validate: noArgs,
    run: (env) => ({ ok: true, data: { items: pantryOf(env) } }),
  },
  {
    name: 'suggest_recipes_from_pantry',
    kind: 'read',
    validate: slotArgs,
    run(env, args) {
      const { customFoods } = lookups(env);
      const summary = daySummary(env.ctx, env.own, env.today);
      const pantry = pantryOf(env);
      if (pantry.length === 0)
        return { ok: true, data: { suggestions: [], rejected: [], emptyPantry: true } };
      return {
        ok: true,
        data: suggestRecipes({
          catalog: env.ctx.catalog,
          profile: env.profile ?? {},
          pantry,
          remaining: summary.remaining,
          userRecipes: env.own.list('recipes'),
          customFoods,
          slot: args.slot,
          today: env.today,
        }),
      };
    },
  },
  {
    name: 'find_meals_for_remaining_macros',
    kind: 'read',
    validate: slotArgs,
    run(env, args) {
      const { customFoods } = lookups(env);
      const summary = daySummary(env.ctx, env.own, env.today);
      return {
        ok: true,
        data: suggestRecipes({
          catalog: env.ctx.catalog,
          profile: env.profile ?? {},
          pantry: [],
          remaining: summary.remaining,
          userRecipes: env.own.list('recipes'),
          customFoods,
          slot: args.slot,
          today: env.today,
          limit: 4,
        }),
      };
    },
  },
  {
    name: 'explain_progress',
    kind: 'read',
    validate: noArgs,
    run(env) {
      const trend = weightTrend(env.own.list('weightEntries')).filter(
        (entry) => entry.day >= shiftDay(env.today, -30),
      );
      const workouts = env.own.list(
        'scheduledWorkouts',
        (row) => row.day >= shiftDay(env.today, -13) && row.day <= env.today,
      );
      const days = Array.from({ length: 7 }, (_, index) =>
        daySummary(env.ctx, env.own, shiftDay(env.today, -index - 1)),
      );
      const logged = days.filter((day) => day.meals.length > 0);
      const averageKcal =
        logged.length > 0
          ? Math.round(logged.reduce((sum, day) => sum + day.total.kcal, 0) / logged.length)
          : null;
      const averageTarget =
        logged.length > 0 && logged[0].target
          ? Math.round(
              logged.reduce((sum, day) => sum + (day.target?.kcal ?? 0), 0) / logged.length,
            )
          : null;
      return {
        ok: true,
        data: {
          weight:
            trend.length > 1
              ? { from: trend[0].trendKg, to: trend.at(-1).trendKg, days: trend.length }
              : null,
          workouts: {
            done: workouts.filter((row) => row.status === 'done').length,
            planned: workouts.length,
          },
          nutrition: { loggedDays: logged.length, averageKcal, averageTarget },
        },
      };
    },
  },
];

module.exports = { readTools };
