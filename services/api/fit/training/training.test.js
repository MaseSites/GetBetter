const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { TEMPLATES, exerciseFor } = require('./templates.js');
const {
  buildSchedule,
  e1rm,
  e1rmHistory,
  extensionFor,
  muscleWeek,
  recordSetIds,
  nextTarget,
  pickTemplate,
  records,
  rescheduleCheck,
  warmupSets,
  weeklyVolume,
} = require('./training.js');

describe('Training', () => {
  test('Vorlage nach Ziel, Erfahrung, Tagen; zuhause ohne Geraete', () => {
    assert.equal(
      pickTemplate({ goal: 'muscle', experience: 'beginner', daysPerWeek: 3, equipment: 'gym' }).id,
      'fullbody-3',
    );
    assert.equal(
      pickTemplate({
        goal: 'fitness',
        experience: 'beginner',
        daysPerWeek: 3,
        equipment: 'bodyweight',
      }).id,
      'home-3',
    );
    assert.equal(
      pickTemplate({ goal: 'strength', experience: 'advanced', daysPerWeek: 4, equipment: 'gym' })
        .id,
      'upper-lower-4',
    );
  });

  test('Uebungen werden fuer die Ausstattung ersetzt', () => {
    assert.equal(exerciseFor('squat', 'gym'), 'squat');
    assert.equal(exerciseFor('squat', 'dumbbells'), 'goblet_squat');
    assert.equal(exerciseFor('bench_press', 'bodyweight'), 'push_up');
    assert.equal(exerciseFor('lat_pulldown', 'bodyweight'), 'inverted_row');
    for (const template of TEMPLATES)
      for (const session of template.sessions)
        for (const entry of session.exercises)
          assert.ok(exerciseFor(entry.id, 'bodyweight'), `${entry.id} ohne Ersatz`);
  });

  test('Termine an den gewaehlten Wochentagen, Einheiten im Wechsel', () => {
    const schedule = buildSchedule({
      template: TEMPLATES[1],
      weekdays: [1, 3, 5],
      equipment: 'dumbbells',
      startDay: '2026-09-21',
      weeks: 2,
    });
    assert.deepEqual(
      schedule.map((entry) => entry.day),
      ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30', '2026-10-02'],
    );
    assert.deepEqual(
      schedule.slice(0, 4).map((entry) => entry.title),
      ['Ganzkörper A', 'Ganzkörper B', 'Ganzkörper C', 'Ganzkörper A'],
    );
    assert.equal(schedule[0].exercises[0].exerciseId, 'goblet_squat');
    assert.equal(schedule[0].exercises[0].replaced, 'squat');
  });

  test('Verschieben: doppelt, Erholung und Kalender werden gemeldet', () => {
    const schedule = buildSchedule({
      template: TEMPLATES[1],
      weekdays: [1, 3, 5],
      equipment: 'gym',
      startDay: '2026-09-21',
      weeks: 1,
    }).map((entry, index) => ({ ...entry, id: `w${index}` }));
    const clean = rescheduleCheck(schedule, 'w0', '2026-09-27');
    assert.equal(clean.ok, true);
    assert.deepEqual(clean.warnings, []);
    const tomorrow = rescheduleCheck(schedule, 'w0', '2026-09-22', ['Zahnarzt']);
    assert.deepEqual(
      tomorrow.warnings.map((warning) => warning.kind),
      ['recovery', 'calendar'],
    );
    assert.deepEqual(
      rescheduleCheck(schedule, 'w0', '2026-09-23').warnings[0].kind,
      'double_session',
    );
    assert.equal(rescheduleCheck(schedule, 'nix', '2026-09-23').error, 'workout_not_found');
  });

  test('Rekorde, Volumen, Steigerung und Aufwaermen', () => {
    assert.equal(e1rm(100, 5), 116.7);
    const sets = [
      { exerciseId: 'bench_press', weightKg: 40, reps: 8, warmup: true },
      { exerciseId: 'bench_press', weightKg: 80, reps: 8, rir: 2 },
      { exerciseId: 'bench_press', weightKg: 85, reps: 5, rir: 1 },
      { exerciseId: 'squat', weightKg: 100, reps: 10, rir: 2 },
    ];
    // 80 kg × 8 (1RM 101.3) schlaegt 85 kg × 5 (99.2).
    assert.deepEqual(
      [records(sets).bench_press.weightKg, records(sets).bench_press.e1rm],
      [80, 101.3],
    );
    assert.deepEqual(weeklyVolume(sets), { chest: 1065, arms: 1065, legs: 1000 });
    assert.deepEqual(nextTarget('squat', sets, '8-10'), { weightKg: 105, reps: null, seconds: null, reason: 'progress' });
    assert.deepEqual(nextTarget('bench_press', sets, '8-10'), { weightKg: 85, reps: null, seconds: null, reason: 'repeat' });
    assert.deepEqual(warmupSets(100), [
      { weightKg: 50, reps: 8 },
      { weightKg: 70, reps: 5 },
      { weightKg: 85, reps: 2 },
    ]);
  });
});

describe('Training nach Studio und Geraeten', () => {
  const { GYMS, swapsFor } = require('./templates.js');
  const gym = (id) => GYMS.find((entry) => entry.id === id).equipment;

  test('Kieser hat nur Maschinen: Geraete-Zirkel, Kniebeuge wird Beinpresse', () => {
    assert.equal(
      pickTemplate({
        goal: 'muscle',
        experience: 'beginner',
        daysPerWeek: 3,
        equipment: gym('kieser'),
      }).id,
      'machines-2',
    );
    assert.equal(exerciseFor('squat', gym('kieser')), 'leg_press');
    assert.equal(exerciseFor('bench_press', gym('kieser')), 'chest_press_machine');
  });

  test('fuenf und sechs Tage; ohne Hanteln nach Hause', () => {
    assert.equal(
      pickTemplate({
        goal: 'muscle',
        experience: 'intermediate',
        daysPerWeek: 5,
        equipment: gym('activ'),
      }).id,
      'ppl-ul-5',
    );
    assert.equal(
      pickTemplate({
        goal: 'muscle',
        experience: 'advanced',
        daysPerWeek: 6,
        equipment: gym('activ'),
      }).id,
      'ppl-3',
    );
    assert.equal(
      pickTemplate({
        goal: 'fitness',
        experience: 'beginner',
        daysPerWeek: 3,
        equipment: gym('outdoor'),
      }).id,
      'home-3',
    );
    assert.equal(
      pickTemplate({
        goal: 'muscle',
        experience: 'beginner',
        daysPerWeek: 4,
        equipment: gym('activ'),
      }).id,
      'upper-lower-4',
    );
  });

  test('abgewaehlte Geraete werden ersetzt, jede Uebung geht irgendwie', () => {
    // Studio ohne Langhantel: Bankdruecken mit Kurzhanteln.
    const noBarbell = gym('activ').filter((tag) => tag !== 'barbell');
    assert.equal(exerciseFor('bench_press', noBarbell), 'db_bench_press');
    assert.equal(exerciseFor('face_pull', ['none']), 'y_raise');
    for (const template of TEMPLATES)
      for (const session of template.sessions)
        for (const entry of session.exercises)
          assert.ok(exerciseFor(entry.id, ['none']), `${entry.id} ohne Ersatz`);
  });

  test('Tauschen: gleiche Muskeln, nur was da ist', () => {
    const swaps = swapsFor('bench_press', ['dumbbell', 'none']);
    assert.ok(swaps.includes('db_bench_press') && swaps.includes('push_up'));
    assert.ok(!swaps.includes('chest_press_machine'));
  });
});

describe('Training, genauer', () => {
  const work = (exerciseId, weightKg, reps, extra = {}) => ({ exerciseId, weightKg, reps, rir: null, ...extra });

  test('Steigerung: +5 kg nur Kniebeuge und Kreuzheben, unbekannte Reserve zaehlt nicht dagegen', () => {
    assert.equal(nextTarget('deadlift', [work('deadlift', 100, 8)], '6-8').weightKg, 105);
    // Rumaenisches Kreuzheben ist Beine und Ruecken, aber keine grosse Langhantel-Uebung.
    assert.equal(nextTarget('romanian_deadlift_db', [work('romanian_deadlift_db', 20, 10)], '8-10').weightKg, 22.5);
    assert.equal(nextTarget('bench_press', [work('bench_press', 60, 10, { rir: 1 })], '8-10').reason, 'repeat');
  });

  test('zweimal unter dem Bereich: 10 % leichter; einmal: gleich', () => {
    const last = [work('bench_press', 80, 5), work('bench_press', 80, 4)];
    const before = [work('bench_press', 80, 6)];
    assert.deepEqual(nextTarget('bench_press', last, '8-10', before), { weightKg: 72.5, reps: null, seconds: null, reason: 'reduce' });
    assert.equal(nextTarget('bench_press', last, '8-10', [work('bench_press', 80, 8)]).reason, 'repeat');
  });

  test('ohne Gewicht: eine Wiederholung mehr; Zeituebung: 5 s mehr', () => {
    assert.deepEqual(nextTarget('push_up', [work('push_up', null, 12), work('push_up', null, 10)], '8-15'), { weightKg: null, reps: 13, seconds: null, reason: 'reps' });
    assert.deepEqual(nextTarget('plank', [{ exerciseId: 'plank', seconds: 40 }], '30s'), { weightKg: null, reps: null, seconds: 45, reason: 'time' });
  });

  test('Rekorde nach Art: Gewicht, Wiederholungen, Sekunden; neuer Rekord nur gegen Frueheres', () => {
    const prior = [work('bench_press', 80, 5, { day: '2026-09-01' }), work('push_up', null, 12, { day: '2026-09-01' })];
    const best = records(prior);
    assert.equal(best.push_up.kind, 'reps');
    assert.equal(best.push_up.reps, 12);
    const today = [
      { id: 'a', ...work('bench_press', 80, 5) },
      { id: 'b', ...work('bench_press', 80, 6) },
      { id: 'c', ...work('bench_press', 82.5, 6) },
      { id: 'd', ...work('push_up', null, 13) },
      { id: 'e', ...work('squat', 100, 5) },
      { id: 'w', ...work('bench_press', 100, 5, { warmup: true }) },
    ];
    assert.deepEqual([...recordSetIds(today, prior)], ['b', 'c', 'd']);
  });

  test('Muskelgruppen der Woche zaehlen Saetze auch ohne Gewicht; 1RM je Tag', () => {
    const week = muscleWeek([work('push_up', null, 10), work('bench_press', 50, 10), work('bench_press', 20, 8, { warmup: true })]);
    assert.deepEqual(week.chest, { sets: 2, volumeKg: 500 });
    const history = e1rmHistory([work('squat', 100, 5, { day: '2026-09-02' }), work('squat', 90, 5, { day: '2026-09-02' }), work('squat', 105, 5, { day: '2026-09-09' })], 'squat');
    assert.deepEqual(history, [{ day: '2026-09-02', e1rm: 116.7 }, { day: '2026-09-09', e1rm: 122.5 }]);
  });

  test('jede fuenfte Woche leichter; der Plan verlaengert sich selbst bis heute + 14 Tage', () => {
    const schedule = buildSchedule({ template: TEMPLATES[1], weekdays: [1], equipment: 'gym', startDay: '2026-09-21', weeks: 6 });
    assert.deepEqual(schedule.map((entry) => entry.deload), [false, false, false, false, true, false]);
    const plan = { weekdays: [1, 3, 5], equipment: 'gym', startDay: '2026-09-21', generatedUntil: '2026-10-18' };
    const rows = buildSchedule({ template: TEMPLATES[1], weekdays: [1, 3, 5], equipment: 'gym', startDay: '2026-09-21', weeks: 4 });
    assert.equal(extensionFor({ plan, template: TEMPLATES[1], rows, today: '2026-09-30' }).workouts.length, 0);
    const later = extensionFor({ plan, template: TEMPLATES[1], rows, today: '2026-10-12' });
    assert.equal(later.until, '2026-10-26');
    assert.deepEqual(later.workouts.map((entry) => entry.day), ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26']);
    // Zwoelf Einheiten vorher: es geht mit der dreizehnten weiter (A, B, C, A …) — gleich gerechnet, gleich.
    assert.deepEqual(later.workouts.map((entry) => entry.sessionIndex), [12, 13, 14, 15]);
    assert.equal(later.workouts[0].title, 'Ganzkörper A');
    assert.equal(later.workouts[0].deload, true, 'Woche 5 seit dem Start');
    assert.deepEqual(extensionFor({ plan, template: TEMPLATES[1], rows, today: '2026-10-12' }), later);
  });
});
