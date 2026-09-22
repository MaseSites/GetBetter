/**
 * Gepruefte Trainingsvorlagen — bewaehrte Aufteilungen, keine KI-Erfindung.
 *
 * Jede Uebung nennt ihre Muskelgruppen (fuer die Erholung), das noetige
 * Geraet, Alternativen fuer andere Ausstattung und einen Satz, wie sie geht.
 * Saetze und Wiederholungen sind Startwerte; gesteigert wird im Verlauf.
 *
 * Ausstattung sind Marken (`EQUIPMENT_TAGS`). Ein Studio (`GYMS`) bringt eine
 * typische Auswahl mit; welche Geraete eine Filiale wirklich hat, weiss nur
 * die Person — sie kann jede Marke ab- oder anwaehlen.
 */

/** Was es zum Trainieren geben kann. `none` ist immer da: der eigene Koerper. */
const EQUIPMENT_TAGS = ['barbell', 'dumbbell', 'machine', 'cable', 'bar', 'kettlebell', 'none'];

const ex = (name, groups, equipment, alternatives, hint, extra = {}) => ({
  name,
  groups,
  equipment,
  alternatives,
  hint,
  ...extra,
});

const EXERCISES = {
  // Beine
  squat: ex(
    'Kniebeuge mit Langhantel',
    ['legs'],
    'barbell',
    ['leg_press', 'goblet_squat', 'bodyweight_squat'],
    'Stange auf dem oberen Rücken, Knie über die Zehen, tief bis die Oberschenkel waagrecht sind.',
  ),
  goblet_squat: ex(
    'Goblet Squat',
    ['legs'],
    'dumbbell',
    ['bodyweight_squat'],
    'Kurzhantel vor der Brust halten, aufrecht tief in die Hocke.',
  ),
  bodyweight_squat: ex(
    'Kniebeuge ohne Gewicht',
    ['legs'],
    'none',
    [],
    'Füsse schulterbreit, Gesäss nach hinten, Brust bleibt oben.',
  ),
  leg_press: ex(
    'Beinpresse',
    ['legs'],
    'machine',
    ['goblet_squat', 'bodyweight_squat'],
    'Füsse schulterbreit auf der Platte, Knie nicht ganz durchstrecken.',
  ),
  leg_curl: ex(
    'Beinbeuger an der Maschine',
    ['legs'],
    'machine',
    ['romanian_deadlift_db', 'hip_bridge'],
    'Langsam beugen, oben kurz halten, kontrolliert zurück.',
  ),
  leg_extension: ex(
    'Beinstrecker an der Maschine',
    ['legs'],
    'machine',
    ['goblet_squat', 'bodyweight_squat'],
    'Knie auf Höhe der Drehachse, oben kurz anspannen.',
  ),
  lunge: ex(
    'Ausfallschritte',
    ['legs'],
    'none',
    [],
    'Grosser Schritt nach vorne, hinteres Knie Richtung Boden.',
  ),
  hip_thrust: ex(
    'Hip Thrust mit Langhantel',
    ['legs'],
    'barbell',
    ['hip_bridge'],
    'Oberer Rücken auf der Bank, Hüfte hoch bis der Körper gerade ist.',
  ),
  hip_bridge: ex(
    'Hüftheben',
    ['legs'],
    'none',
    [],
    'Auf dem Rücken, Füsse aufgestellt, Hüfte hoch und Gesäss anspannen.',
  ),
  calf_raise: ex(
    'Wadenheben an der Maschine',
    ['legs'],
    'machine',
    ['calf_raise_bw'],
    'Ganz nach oben auf die Zehen, langsam tief ablassen.',
  ),
  calf_raise_bw: ex(
    'Wadenheben auf einer Stufe',
    ['legs'],
    'none',
    [],
    'Fersen unter die Stufe sinken lassen, dann ganz hoch.',
  ),
  deadlift: ex(
    'Kreuzheben',
    ['legs', 'back'],
    'barbell',
    ['romanian_deadlift_db', 'kettlebell_swing', 'hip_bridge'],
    'Rücken gerade, Stange nah am Körper, aus den Beinen hochdrücken.',
  ),
  romanian_deadlift_db: ex(
    'Rumänisches Kreuzheben mit Kurzhanteln',
    ['legs', 'back'],
    'dumbbell',
    ['hip_bridge'],
    'Knie leicht gebeugt, Hüfte nach hinten, bis es hinten im Bein zieht.',
  ),
  kettlebell_swing: ex(
    'Kettlebell Swing',
    ['legs', 'back'],
    'kettlebell',
    ['romanian_deadlift_db', 'hip_bridge'],
    'Schwung kommt aus der Hüfte, nicht aus den Armen.',
  ),
  // Brust
  bench_press: ex(
    'Bankdrücken',
    ['chest', 'arms'],
    'barbell',
    ['db_bench_press', 'chest_press_machine', 'push_up'],
    'Schulterblätter zusammen, Stange zur unteren Brust, kontrolliert hoch.',
  ),
  db_bench_press: ex(
    'Kurzhantel-Bankdrücken',
    ['chest', 'arms'],
    'dumbbell',
    ['chest_press_machine', 'push_up'],
    'Hanteln seitlich der Brust, gerade nach oben drücken.',
  ),
  chest_press_machine: ex(
    'Brustpresse an der Maschine',
    ['chest', 'arms'],
    'machine',
    ['db_bench_press', 'push_up'],
    'Griffe auf Brusthöhe, nach vorne drücken, Ellbogen leicht gebeugt lassen.',
  ),
  cable_fly: ex(
    'Kabelzug-Flys',
    ['chest'],
    'cable',
    ['db_bench_press', 'push_up'],
    'Arme leicht gebeugt, in einem Bogen vor der Brust zusammenführen.',
  ),
  push_up: ex(
    'Liegestütz',
    ['chest', 'arms'],
    'none',
    [],
    'Körper gerade wie ein Brett; zu schwer? Knie auf den Boden.',
  ),
  // Schultern
  overhead_press: ex(
    'Schulterdrücken',
    ['shoulders', 'arms'],
    'barbell',
    ['db_shoulder_press', 'shoulder_press_machine', 'pike_push_up'],
    'Bauch fest, Stange gerade über den Kopf drücken.',
  ),
  db_shoulder_press: ex(
    'Kurzhantel-Schulterdrücken',
    ['shoulders', 'arms'],
    'dumbbell',
    ['shoulder_press_machine', 'pike_push_up'],
    'Sitzend, Hanteln auf Ohrhöhe, nach oben drücken.',
  ),
  shoulder_press_machine: ex(
    'Schulterpresse an der Maschine',
    ['shoulders', 'arms'],
    'machine',
    ['db_shoulder_press', 'pike_push_up'],
    'Griffe auf Schulterhöhe, nach oben drücken.',
  ),
  lateral_raise: ex(
    'Seitheben',
    ['shoulders'],
    'dumbbell',
    ['pike_push_up'],
    'Leichte Hanteln seitlich bis Schulterhöhe heben, langsam senken.',
  ),
  face_pull: ex(
    'Face Pulls am Kabelzug',
    ['shoulders', 'back'],
    'cable',
    ['y_raise'],
    'Seil Richtung Stirn ziehen, Ellbogen hoch und aussen.',
  ),
  y_raise: ex(
    'Y-Heben am Boden',
    ['shoulders', 'back'],
    'none',
    [],
    'Bauchlage, Arme in Y-Form heben, Daumen nach oben.',
  ),
  pike_push_up: ex(
    'Pike Push-up',
    ['shoulders', 'arms'],
    'none',
    [],
    'Hüfte hoch wie ein Dach, Kopf Richtung Boden senken.',
  ),
  // Ruecken
  row: ex(
    'Rudern mit Langhantel',
    ['back', 'arms'],
    'barbell',
    ['db_row', 'cable_row', 'machine_row', 'inverted_row'],
    'Oberkörper vorgebeugt, Stange zum Bauchnabel ziehen.',
  ),
  db_row: ex(
    'Kurzhantel-Rudern',
    ['back', 'arms'],
    'dumbbell',
    ['cable_row', 'inverted_row'],
    'Eine Hand auf der Bank, Hantel zur Hüfte ziehen.',
  ),
  cable_row: ex(
    'Rudern am Kabelzug',
    ['back', 'arms'],
    'cable',
    ['machine_row', 'db_row', 'inverted_row'],
    'Aufrecht sitzen, Griff zum Bauch ziehen, Schulterblätter zusammen.',
  ),
  machine_row: ex(
    'Rudern an der Maschine',
    ['back', 'arms'],
    'machine',
    ['cable_row', 'db_row', 'inverted_row'],
    'Brust ans Polster, Griffe zu dir ziehen.',
  ),
  lat_pulldown: ex(
    'Latzug',
    ['back', 'arms'],
    'machine',
    ['pull_up', 'cable_row', 'db_row'],
    'Stange zur oberen Brust ziehen, nicht hinter den Kopf.',
  ),
  pull_up: ex(
    'Klimmzug',
    ['back', 'arms'],
    'bar',
    ['lat_pulldown', 'inverted_row'],
    'Aus dem Hang hochziehen, bis das Kinn über der Stange ist.',
  ),
  inverted_row: ex(
    'Rudern am Tisch',
    ['back', 'arms'],
    'none',
    [],
    'Unter einem stabilen Tisch liegen, Brust zur Kante ziehen.',
  ),
  back_extension: ex(
    'Rückenstrecker',
    ['back'],
    'machine',
    ['superman'],
    'Hüfte am Polster, Oberkörper langsam senken und gerade heben.',
  ),
  superman: ex(
    'Superman',
    ['back'],
    'none',
    [],
    'Bauchlage, Arme und Beine gleichzeitig leicht anheben.',
  ),
  // Arme
  curl: ex(
    'Bizepscurl',
    ['arms'],
    'dumbbell',
    ['cable_curl', 'inverted_row'],
    'Ellbogen am Körper, Hanteln langsam hoch und runter.',
  ),
  cable_curl: ex(
    'Bizepscurl am Kabelzug',
    ['arms'],
    'cable',
    ['curl', 'inverted_row'],
    'Ellbogen bleiben am Körper, nur der Unterarm bewegt sich.',
  ),
  triceps_pushdown: ex(
    'Trizepsdrücken am Kabelzug',
    ['arms'],
    'cable',
    ['bench_dip'],
    'Ellbogen am Körper, Seil nach unten strecken.',
  ),
  bench_dip: ex(
    'Dips an der Bank',
    ['arms', 'chest'],
    'none',
    [],
    'Hände hinter dir auf der Bank, Ellbogen nach hinten beugen.',
  ),
  // Rumpf
  plank: ex('Unterarmstütz', ['core'], 'none', [], 'Körper gerade, Bauch und Gesäss fest.', {
    timed: true,
  }),
  dead_bug: ex(
    'Dead Bug',
    ['core'],
    'none',
    [],
    'Rückenlage, Arm und gegenüberliegendes Bein langsam strecken.',
  ),
  ab_machine: ex(
    'Bauchmaschine',
    ['core'],
    'machine',
    ['dead_bug'],
    'Oberkörper einrollen, nicht mit den Armen ziehen.',
  ),
};

const exercise = (id, sets, reps, restSeconds) => ({ id, sets, reps, restSeconds });

const TEMPLATES = [
  {
    id: 'fullbody-2',
    name: 'Ganzkörper, 2 Tage',
    goals: ['strength', 'muscle', 'fitness'],
    experience: ['beginner'],
    daysPerWeek: 2,
    sessions: [
      {
        title: 'Ganzkörper A',
        exercises: [
          exercise('squat', 3, '8-10', 120),
          exercise('bench_press', 3, '8-10', 120),
          exercise('row', 3, '8-10', 90),
          exercise('plank', 3, '30s', 60),
        ],
      },
      {
        title: 'Ganzkörper B',
        exercises: [
          exercise('deadlift', 3, '6-8', 150),
          exercise('overhead_press', 3, '8-10', 120),
          exercise('lat_pulldown', 3, '10-12', 90),
          exercise('lunge', 2, '10-12', 60),
        ],
      },
    ],
  },
  {
    id: 'fullbody-3',
    name: 'Ganzkörper, 3 Tage',
    goals: ['strength', 'muscle', 'fitness', 'fatloss'],
    experience: ['beginner', 'intermediate'],
    daysPerWeek: 3,
    sessions: [
      {
        title: 'Ganzkörper A',
        exercises: [
          exercise('squat', 3, '6-8', 150),
          exercise('bench_press', 3, '6-8', 120),
          exercise('row', 3, '8-10', 90),
          exercise('plank', 3, '30s', 60),
        ],
      },
      {
        title: 'Ganzkörper B',
        exercises: [
          exercise('deadlift', 3, '5-6', 180),
          exercise('overhead_press', 3, '8-10', 120),
          exercise('lat_pulldown', 3, '10-12', 90),
          exercise('curl', 2, '10-12', 60),
        ],
      },
      {
        title: 'Ganzkörper C',
        exercises: [
          exercise('leg_press', 3, '10-12', 120),
          exercise('db_bench_press', 3, '10-12', 90),
          exercise('db_row', 3, '10-12', 90),
          exercise('lunge', 2, '10-12', 60),
        ],
      },
    ],
  },
  {
    id: 'ppl-3',
    name: 'Drücken / Ziehen / Beine',
    goals: ['muscle', 'strength'],
    experience: ['intermediate', 'advanced'],
    daysPerWeek: 3,
    sessions: [
      {
        title: 'Drücken',
        exercises: [
          exercise('bench_press', 4, '6-8', 150),
          exercise('overhead_press', 3, '8-10', 120),
          exercise('cable_fly', 3, '12-15', 60),
          exercise('lateral_raise', 3, '12-15', 60),
          exercise('triceps_pushdown', 3, '10-12', 60),
        ],
      },
      {
        title: 'Ziehen',
        exercises: [
          exercise('pull_up', 3, '6-10', 120),
          exercise('row', 3, '8-10', 120),
          exercise('face_pull', 3, '12-15', 60),
          exercise('curl', 3, '10-12', 60),
          exercise('back_extension', 2, '12-15', 60),
        ],
      },
      {
        title: 'Beine',
        exercises: [
          exercise('squat', 4, '6-8', 180),
          exercise('romanian_deadlift_db', 3, '8-10', 120),
          exercise('leg_curl', 3, '10-12', 90),
          exercise('calf_raise', 3, '12-15', 60),
          exercise('plank', 3, '45s', 60),
        ],
      },
    ],
  },
  {
    id: 'upper-lower-4',
    name: 'Oberkörper / Unterkörper, 4 Tage',
    goals: ['strength', 'muscle', 'fitness', 'fatloss'],
    experience: ['beginner', 'intermediate', 'advanced'],
    daysPerWeek: 4,
    sessions: [
      {
        title: 'Oberkörper schwer',
        exercises: [
          exercise('bench_press', 4, '5-6', 150),
          exercise('row', 4, '6-8', 120),
          exercise('overhead_press', 3, '6-8', 120),
          exercise('pull_up', 3, '6-10', 120),
        ],
      },
      {
        title: 'Unterkörper schwer',
        exercises: [
          exercise('squat', 4, '5-6', 180),
          exercise('romanian_deadlift_db', 3, '8-10', 120),
          exercise('lunge', 3, '10-12', 90),
          exercise('plank', 3, '45s', 60),
        ],
      },
      {
        title: 'Oberkörper Volumen',
        exercises: [
          exercise('db_bench_press', 3, '10-12', 90),
          exercise('lat_pulldown', 3, '10-12', 90),
          exercise('db_shoulder_press', 3, '10-12', 90),
          exercise('curl', 3, '12-15', 60),
        ],
      },
      {
        title: 'Unterkörper Volumen',
        exercises: [
          exercise('deadlift', 3, '6-8', 180),
          exercise('leg_press', 3, '12-15', 120),
          exercise('hip_bridge', 3, '12-15', 60),
        ],
      },
    ],
  },
  {
    id: 'ppl-ul-5',
    name: 'Drücken / Ziehen / Beine + Ober- / Unterkörper, 5 Tage',
    goals: ['muscle', 'strength'],
    experience: ['intermediate', 'advanced'],
    daysPerWeek: 5,
    sessions: [
      {
        title: 'Drücken',
        exercises: [
          exercise('bench_press', 4, '6-8', 150),
          exercise('overhead_press', 3, '8-10', 120),
          exercise('lateral_raise', 3, '12-15', 60),
          exercise('triceps_pushdown', 3, '10-12', 60),
        ],
      },
      {
        title: 'Ziehen',
        exercises: [
          exercise('pull_up', 3, '6-10', 120),
          exercise('cable_row', 3, '10-12', 90),
          exercise('face_pull', 3, '12-15', 60),
          exercise('curl', 3, '10-12', 60),
        ],
      },
      {
        title: 'Beine',
        exercises: [
          exercise('squat', 4, '6-8', 180),
          exercise('leg_curl', 3, '10-12', 90),
          exercise('leg_extension', 3, '12-15', 60),
          exercise('calf_raise', 3, '12-15', 60),
        ],
      },
      {
        title: 'Oberkörper',
        exercises: [
          exercise('db_bench_press', 3, '8-10', 90),
          exercise('lat_pulldown', 3, '10-12', 90),
          exercise('db_shoulder_press', 3, '10-12', 90),
          exercise('cable_curl', 2, '12-15', 60),
        ],
      },
      {
        title: 'Unterkörper',
        exercises: [
          exercise('deadlift', 3, '5-6', 180),
          exercise('leg_press', 3, '10-12', 120),
          exercise('hip_thrust', 3, '8-12', 90),
          exercise('plank', 3, '45s', 60),
        ],
      },
    ],
  },
  {
    id: 'machines-2',
    name: 'Geräte-Zirkel, 2 Tage',
    goals: ['strength', 'muscle', 'fitness', 'fatloss'],
    experience: ['beginner', 'intermediate', 'advanced'],
    daysPerWeek: 2,
    machines: true,
    sessions: [
      {
        title: 'Geräte A',
        exercises: [
          exercise('leg_press', 2, '8-12', 90),
          exercise('chest_press_machine', 2, '8-12', 90),
          exercise('lat_pulldown', 2, '8-12', 90),
          exercise('leg_curl', 2, '8-12', 90),
          exercise('ab_machine', 2, '10-15', 60),
        ],
      },
      {
        title: 'Geräte B',
        exercises: [
          exercise('leg_extension', 2, '8-12', 90),
          exercise('shoulder_press_machine', 2, '8-12', 90),
          exercise('machine_row', 2, '8-12', 90),
          exercise('back_extension', 2, '10-15', 60),
          exercise('calf_raise', 2, '12-15', 60),
        ],
      },
    ],
  },
  {
    id: 'home-3',
    name: 'Zuhause ohne Geräte, 3 Tage',
    goals: ['fitness', 'fatloss', 'muscle'],
    experience: ['beginner', 'intermediate'],
    daysPerWeek: 3,
    sessions: [
      {
        title: 'Zuhause A',
        exercises: [
          exercise('bodyweight_squat', 3, '15-20', 60),
          exercise('push_up', 3, '8-15', 90),
          exercise('inverted_row', 3, '8-12', 90),
          exercise('plank', 3, '30s', 60),
        ],
      },
      {
        title: 'Zuhause B',
        exercises: [
          exercise('lunge', 3, '10-12', 60),
          exercise('pike_push_up', 3, '6-10', 90),
          exercise('hip_bridge', 3, '15-20', 60),
          exercise('dead_bug', 3, '10-12', 60),
        ],
      },
      {
        title: 'Zuhause C',
        exercises: [
          exercise('bodyweight_squat', 4, '15-20', 60),
          exercise('push_up', 4, '8-15', 90),
          exercise('inverted_row', 4, '8-12', 90),
          exercise('superman', 3, '12-15', 60),
        ],
      },
    ],
  },
];

/** Die alten Ausstattungs-Namen, wie der Plan sie bis 09/2026 kannte. */
const EQUIPMENT_SETS = {
  gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bar', 'kettlebell', 'none'],
  dumbbells: ['dumbbell', 'none'],
  bodyweight: ['none'],
  bar_bodyweight: ['bar', 'none'],
};

/**
 * Studios und Orte mit ihrer typischen Ausstattung. Das ist eine Vorauswahl,
 * keine Liste der Filiale — die App sagt das und laesst jede Marke aendern.
 */
const GYMS = [
  { id: 'activ', name: 'Activ Fitness', kind: 'gym', equipment: EQUIPMENT_SETS.gym },
  { id: 'fitnesspark', name: 'Migros Fitnesspark', kind: 'gym', equipment: EQUIPMENT_SETS.gym },
  { id: 'update', name: 'Update Fitness', kind: 'gym', equipment: EQUIPMENT_SETS.gym },
  { id: 'basefit', name: 'Basefit.swiss', kind: 'gym', equipment: EQUIPMENT_SETS.gym },
  { id: 'wellcomefit', name: 'Well come FiT', kind: 'gym', equipment: EQUIPMENT_SETS.gym },
  { id: 'kieser', name: 'Kieser Training', kind: 'gym', equipment: ['machine', 'none'] },
  { id: 'other_gym', name: null, kind: 'gym', equipment: EQUIPMENT_SETS.gym },
  { id: 'home', name: null, kind: 'home', equipment: ['none'] },
  { id: 'home_dumbbells', name: null, kind: 'home', equipment: ['dumbbell', 'none'] },
  { id: 'outdoor', name: null, kind: 'outdoor', equipment: ['bar', 'none'] },
];

/** Aus einem alten Namen oder einer Liste von Marken die erlaubten Geraete — `none` ist immer dabei. */
function equipmentSet(equipment) {
  const list = Array.isArray(equipment)
    ? equipment
    : (EQUIPMENT_SETS[equipment] ?? EQUIPMENT_SETS.gym);
  return new Set([...list.filter((tag) => EQUIPMENT_TAGS.includes(tag)), 'none']);
}

/** Eine Uebung fuer die vorhandene Ausstattung — sie selbst oder die erste passende Alternative. */
function exerciseFor(id, equipment) {
  const allowed = equipmentSet(equipment);
  const queue = [id];
  const seen = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    const definition = EXERCISES[current];
    if (!definition) continue;
    if (allowed.has(definition.equipment)) return current;
    queue.push(...definition.alternatives);
  }
  return null;
}

/** Alle Uebungen, die fuer dieselben Muskeln taugen und mit der Ausstattung gehen — zum Tauschen im Training. */
function swapsFor(id, equipment) {
  const allowed = equipmentSet(equipment);
  const groups = EXERCISES[id]?.groups ?? [];
  const main = groups[0];
  return Object.entries(EXERCISES)
    .filter(
      ([other, definition]) =>
        other !== id && allowed.has(definition.equipment) && definition.groups[0] === main,
    )
    .map(([other]) => other);
}

module.exports = {
  EQUIPMENT_SETS,
  EQUIPMENT_TAGS,
  EXERCISES,
  GYMS,
  TEMPLATES,
  equipmentSet,
  exerciseFor,
  swapsFor,
};
