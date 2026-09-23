/**
 * Training gegen den echten Dienst: Regeln fuer Zustand und Saetze, Rekorde,
 * Zeituebungen, Auslassen als Vorschlag, angefangene Trainings bleiben, der
 * Plan verlaengert sich selbst, Uebungen in der Sprache der Anfrage.
 */
const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');

const { startFitServer } = require('./fitHarness.js');

const PROFILE = { birthDate: '1990-03-14', heightCm: 180, weightKg: 80, sex: 'male', activity: 'moderate', trainingDaysPerWeek: 3, goal: 'maintain', diet: 'omnivore', allergies: [], maxCookMinutes: 45, equipment: ['stove'] };
const EVERY_DAY = [0, 1, 2, 3, 4, 5];

describe('Better Fit: Training', () => {
  let server;
  let token;
  const call = (method, route, body, headers) => server.call(method, route, { token, ...(body === undefined ? {} : { body }), ...(headers ? { headers } : {}) });
  const confirm = (action) => call('POST', `/v1/fit/actions/${action.id}/confirm`);
  let today;

  before(async () => {
    server = await startFitServer();
    token = (await server.signUp('training')).token;
    assert.equal((await call('PUT', '/v1/fit/profile', PROFILE)).status, 200);
    today = (await call('GET', '/v1/fit/day')).body.day;
    const created = await call('POST', '/v1/fit/workout-plans', { goal: 'fitness', experience: 'beginner', equipment: 'bodyweight', weekdays: EVERY_DAY, weeks: 1 });
    assert.equal(created.status, 201);
    assert.equal((await confirm(created.body.action)).status, 200);
  });
  after(() => server.stop());

  const workoutOn = async (day) => (await call('GET', '/v1/fit/workouts')).body.workouts.find((row) => row.day === day);

  test('der Plan reicht immer bis heute + 14 Tage', async () => {
    const list = (await call('GET', '/v1/fit/workouts')).body;
    const last = list.workouts.at(-1).day;
    assert.ok(last >= new Date(Date.parse(`${today}T12:00:00Z`) + 13 * 86400000).toISOString().slice(0, 10), last);
    const again = (await call('GET', '/v1/fit/workouts')).body;
    assert.equal(again.workouts.length, list.workouts.length, 'zweimal laden legt nichts doppelt an');
  });

  test('ohne Satz nicht abschliessen; Saetze nur solange geplant; Zeituebung in Sekunden', async () => {
    const summary = await workoutOn(today);
    const workout = (await call('GET', `/v1/fit/workouts/${summary.id}`)).body.workout;
    assert.equal((await call('POST', `/v1/fit/workouts/${summary.id}/complete`)).body.error, 'no_sets');
    const first = workout.exercises[0];
    assert.equal(first.bodyweight, true);
    const plank = workout.exercises.find((exercise) => exercise.timed);
    if (plank) {
      assert.equal((await call('POST', `/v1/fit/workouts/${summary.id}/sets`, { exerciseId: plank.exerciseId, seconds: 900 })).body.error, 'seconds_invalid');
      const timed = await call('POST', `/v1/fit/workouts/${summary.id}/sets`, { exerciseId: plank.exerciseId, seconds: 45 });
      assert.equal(timed.body.set.seconds, 45);
      assert.equal(timed.body.set.reps, null);
    }
    const warm = await call('POST', `/v1/fit/workouts/${summary.id}/sets`, { exerciseId: first.exerciseId, reps: 5, warmup: true });
    assert.equal(warm.status, 201);
    const onlyWarm = plank ? 1 : 0;
    assert.equal(warm.body.workout.workSets, onlyWarm, 'Aufwaermen zaehlt nicht als Arbeitssatz');
    const set = await call('POST', `/v1/fit/workouts/${summary.id}/sets`, { exerciseId: first.exerciseId, reps: 12, weightKg: null, rir: null });
    assert.equal(set.status, 201);
    assert.equal(set.body.set.isRecord, false, 'der erste Satz ist kein Rekord');
    assert.equal((await call('POST', `/v1/fit/workouts/${summary.id}/complete`)).status, 200);
    assert.equal((await call('POST', `/v1/fit/workouts/${summary.id}/complete`)).body.error, 'status_invalid');
    assert.equal((await call('POST', `/v1/fit/workouts/${summary.id}/sets`, { exerciseId: first.exerciseId, reps: 12 })).body.error, 'workout_closed');
    assert.equal((await call('POST', `/v1/fit/workouts/${summary.id}/skip`)).body.error, 'status_invalid');
    assert.equal((await call('POST', `/v1/fit/workouts/${summary.id}/reopen`)).status, 200);
    assert.equal((await call('POST', `/v1/fit/workouts/${summary.id}/reopen`)).body.error, 'status_invalid');
    assert.equal((await call('POST', `/v1/fit/workouts/${summary.id}/complete`)).status, 200);
  });

  // Gefunden beim Durchspielen des Testkontos: der Dienst nahm einen Satz fuer
  // ein Training in einer Woche an (HTTP 201) und setzte `startedAt` auf heute.
  // Danach stand es als „erledigt“ mit Zukunftsdatum im Verlauf.
  test('kein Satz auf einem Training, das erst spaeter ansteht', async () => {
    const list = (await call('GET', '/v1/fit/workouts')).body.workouts;
    const later = list.find((row) => row.day > today && row.status === 'planned');
    assert.ok(later, 'der Plan reicht in die Zukunft');
    const full = (await call('GET', `/v1/fit/workouts/${later.id}`)).body.workout;
    const attempt = await call('POST', `/v1/fit/workouts/${later.id}/sets`, {
      exerciseId: full.exercises[0].exerciseId,
      reps: 8,
    });
    assert.equal(attempt.status, 409);
    assert.equal(attempt.body.error, 'workout_future');
    // Und es bleibt dabei: nichts gezaehlt, nichts gestartet.
    const after = (await call('GET', `/v1/fit/workouts/${later.id}`)).body.workout;
    assert.equal(after.status, 'planned');
    assert.equal(after.sets.length, 0);
  });

  test('am naechsten Tag: letztes Mal, +1 Wiederholung, neuer Rekord nach Wiederholungen', async () => {
    const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const list = (await call('GET', '/v1/fit/workouts')).body.workouts;
    const done = list.find((row) => row.day === today);
    const detailDone = (await call('GET', `/v1/fit/workouts/${done.id}`)).body.workout;
    const exerciseId = detailDone.exercises[0].exerciseId;
    const next = list.find((row) => row.day > today && row.status === 'planned');
    // Dieselbe Uebung in einer spaeteren Einheit suchen — die Vorlage wechselt ab.
    let target = null;
    for (const row of list.filter((entry) => entry.day > today)) {
      const detail = (await call('GET', `/v1/fit/workouts/${row.id}`)).body.workout;
      if (detail.exercises.some((exercise) => exercise.exerciseId === exerciseId)) {
        target = detail;
        break;
      }
    }
    assert.ok(next && target, 'eine spaetere Einheit mit derselben Uebung');
    const exercise = target.exercises.find((entry) => entry.exerciseId === exerciseId);
    assert.deepEqual(exercise.last.sets, [{ weightKg: null, reps: 12, seconds: null }]);
    assert.equal(exercise.target.reps, 13);
    assert.equal(exercise.record.kind, 'reps');
    // Auf einem Training in der Zukunft laesst sich nichts eintragen (siehe
    // `workout_future`). Wer heute trainiert, holt die Einheit vor — genau das
    // tut die App mit „Heute nachholen“.
    const pull = await call('POST', '/v1/fit/actions', {
      tool: 'reschedule_workout',
      args: { workoutId: target.id, toDay: today },
    });
    await confirm(pull.body.action);
    const logged = await call('POST', `/v1/fit/workouts/${target.id}/sets`, { exerciseId, reps: 13 });
    assert.equal(logged.body.set.isRecord, true);
    assert.ok(tomorrow);
  });

  test('angefangenes Training: nicht verschieben, nicht auslassen, bleibt beim neuen Plan', async () => {
    const started = (await call('GET', '/v1/fit/workouts')).body.workouts.find((row) => row.status === 'planned' && row.sets > 0);
    assert.ok(started);
    const toDay = new Date(Date.parse(`${started.day}T12:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10);
    const move = await call('POST', '/v1/fit/actions', { tool: 'reschedule_workout', args: { workoutId: started.id, toDay } });
    assert.equal(move.body.error, 'workout_started');
    const skip = await call('POST', '/v1/fit/actions', { tool: 'skip_workout', args: { workoutId: started.id } });
    assert.equal(skip.body.error, 'workout_started');
    const plan = await call('POST', '/v1/fit/workout-plans', { goal: 'fitness', experience: 'beginner', equipment: 'bodyweight', weekdays: [1, 3, 5] });
    assert.equal(plan.body.action.preview.summary.keeps, 1);
    await confirm(plan.body.action);
    const after = (await call('GET', '/v1/fit/workouts')).body.workouts;
    assert.ok(after.some((row) => row.id === started.id), 'das angefangene Training ist noch da');
  });

  test('auslassen als Vorschlag, dann verpasst und Hinweise des Tages', async () => {
    const planned = (await call('GET', '/v1/fit/workouts')).body.workouts.find((row) => row.status === 'planned' && row.sets === 0 && row.day >= today);
    const proposal = await call('POST', '/v1/fit/actions', { tool: 'skip_workout', args: { workoutId: planned.id } });
    assert.equal(proposal.status, 201);
    assert.equal(proposal.body.action.preview.summary.kind, 'skip');
    const confirmed = await confirm(proposal.body.action);
    assert.equal(confirmed.body.action.result.kind, 'workout_skipped');
    const cards = (await call('GET', '/v1/fit/coach/today')).body.cards;
    assert.ok(Array.isArray(cards));
    const coach = await call('POST', '/v1/fit/coach/message', { text: 'Was sind meine Rekorde?' });
    const reply = coach.body.messages.find((message) => message.kind === 'get_records');
    assert.ok(reply.data.records.length > 0);
  });

  test('Uebungen, Titel und Vorlagen in der Sprache der Anfrage', async () => {
    const fr = { 'Accept-Language': 'fr-CH' };
    const list = (await call('GET', '/v1/fit/workouts', undefined, fr)).body;
    assert.ok(list.workouts.every((row) => !row.title.startsWith('Zuhause')), 'Maison statt Zuhause');
    const detail = (await call('GET', `/v1/fit/workouts/${list.workouts[0].id}`, undefined, fr)).body.workout;
    assert.ok(detail.exercises.some((exercise) => /Squat|Pompes|Fentes|Pont|Gainage|Rowing|Dead bug|Superman/.test(exercise.name)));
    const templates = (await call('GET', '/v1/fit/workout-templates', undefined, { 'Accept-Language': 'it' })).body.templates;
    assert.equal(templates.find((template) => template.id === 'home-3').name, 'A casa senza attrezzi, 3 giorni');
    const progress = (await call('GET', '/v1/fit/progress', undefined, { 'Accept-Language': 'en' })).body;
    assert.ok(progress.records.length > 0 && progress.week.groups);
  });
});
