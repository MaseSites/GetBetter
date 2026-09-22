/**
 * Uebungen, Vorlagen und Einheiten in Franzoesisch, Italienisch und Englisch.
 * Deutsch steht in `templates.js`; gespeichert werden nur Ids und der deutsche
 * Titel einer Einheit. Uebersetzt wird erst beim Antworten, in der Sprache der
 * Anfrage (`language` jedes Handlers).
 *
 * Je Uebung `[Name, Anleitung]`.
 */
const { pick } = require('../lang.js');
const { EXERCISES, TEMPLATES } = require('./templates.js');

const EXERCISE_TEXTS = {
  squat: {
    fr: ['Squat à la barre', 'Barre sur le haut du dos, genoux dans l’axe des pieds, descends jusqu’à ce que les cuisses soient parallèles au sol.'],
    it: ['Squat con bilanciere', 'Bilanciere sulla parte alta della schiena, ginocchia in linea con le punte, scendi finché le cosce sono parallele al pavimento.'],
    en: ['Barbell back squat', 'Bar on your upper back, knees track over your toes, go down until your thighs are parallel to the floor.'],
  },
  goblet_squat: {
    fr: ['Goblet squat', 'Tiens l’haltère contre la poitrine, descends bien droit en position accroupie.'],
    it: ['Goblet squat', 'Tieni il manubrio davanti al petto e scendi in accosciata con il busto dritto.'],
    en: ['Goblet squat', 'Hold the dumbbell at your chest and sit down deep with an upright torso.'],
  },
  bodyweight_squat: {
    fr: ['Squat au poids du corps', 'Pieds à largeur d’épaules, fesses vers l’arrière, la poitrine reste haute.'],
    it: ['Squat a corpo libero', 'Piedi alla larghezza delle spalle, glutei indietro, petto alto.'],
    en: ['Bodyweight squat', 'Feet shoulder-width apart, hips back, chest stays up.'],
  },
  leg_press: {
    fr: ['Presse à cuisses', 'Pieds à largeur d’épaules sur la plateforme, ne verrouille pas complètement les genoux.'],
    it: ['Leg press', 'Piedi alla larghezza delle spalle sulla pedana, non stendere del tutto le ginocchia.'],
    en: ['Leg press', 'Feet shoulder-width on the platform, don’t lock your knees out fully.'],
  },
  leg_curl: {
    fr: ['Leg curl à la machine', 'Fléchis lentement, marque un temps en haut, reviens sous contrôle.'],
    it: ['Leg curl alla macchina', 'Fletti lentamente, tieni un attimo in alto, torna controllato.'],
    en: ['Machine leg curl', 'Curl slowly, pause at the top, lower under control.'],
  },
  leg_extension: {
    fr: ['Leg extension à la machine', 'Genoux à hauteur de l’axe de rotation, contracte brièvement en haut.'],
    it: ['Leg extension alla macchina', 'Ginocchia all’altezza del perno, contrai un attimo in alto.'],
    en: ['Machine leg extension', 'Knees in line with the pivot, squeeze briefly at the top.'],
  },
  lunge: {
    fr: ['Fentes', 'Grand pas en avant, le genou arrière descend vers le sol.'],
    it: ['Affondi', 'Passo lungo in avanti, il ginocchio dietro scende verso il pavimento.'],
    en: ['Lunges', 'Take a long step forward, lower your back knee towards the floor.'],
  },
  hip_thrust: {
    fr: ['Hip thrust à la barre', 'Haut du dos sur le banc, monte les hanches jusqu’à ce que le corps soit droit.'],
    it: ['Hip thrust con bilanciere', 'Parte alta della schiena sulla panca, spingi le anche finché il corpo è dritto.'],
    en: ['Barbell hip thrust', 'Upper back on the bench, drive your hips up until your body is straight.'],
  },
  hip_bridge: {
    fr: ['Pont fessier', 'Sur le dos, pieds posés, monte les hanches et serre les fessiers.'],
    it: ['Ponte glutei', 'Supino, piedi appoggiati, solleva le anche e contrai i glutei.'],
    en: ['Glute bridge', 'On your back, feet planted, lift your hips and squeeze your glutes.'],
  },
  calf_raise: {
    fr: ['Mollets à la machine', 'Monte tout en haut sur la pointe des pieds, redescends lentement et bas.'],
    it: ['Calf raise alla macchina', 'Sali del tutto sulle punte, scendi lentamente in basso.'],
    en: ['Machine calf raise', 'Rise all the way onto your toes, lower slowly and deep.'],
  },
  calf_raise_bw: {
    fr: ['Mollets sur une marche', 'Laisse descendre les talons sous la marche, puis monte tout en haut.'],
    it: ['Polpacci su un gradino', 'Lascia scendere i talloni sotto il gradino, poi sali del tutto.'],
    en: ['Calf raise on a step', 'Let your heels sink below the step, then rise all the way up.'],
  },
  deadlift: {
    fr: ['Soulevé de terre', 'Dos droit, barre près du corps, pousse avec les jambes.'],
    it: ['Stacco da terra', 'Schiena dritta, bilanciere vicino al corpo, spingi con le gambe.'],
    en: ['Deadlift', 'Flat back, bar close to your body, push up through your legs.'],
  },
  romanian_deadlift_db: {
    fr: ['Soulevé de terre roumain aux haltères', 'Genoux légèrement fléchis, hanches vers l’arrière jusqu’à sentir l’étirement derrière la jambe.'],
    it: ['Stacco rumeno con manubri', 'Ginocchia leggermente flesse, anche indietro finché senti tirare dietro la gamba.'],
    en: ['Dumbbell Romanian deadlift', 'Soft knees, push your hips back until you feel a stretch in your hamstrings.'],
  },
  kettlebell_swing: {
    fr: ['Swing kettlebell', 'L’élan vient des hanches, pas des bras.'],
    it: ['Kettlebell swing', 'La spinta viene dalle anche, non dalle braccia.'],
    en: ['Kettlebell swing', 'The swing comes from your hips, not your arms.'],
  },
  bench_press: {
    fr: ['Développé couché', 'Omoplates serrées, barre vers le bas de la poitrine, remonte sous contrôle.'],
    it: ['Panca piana', 'Scapole addotte, bilanciere verso la parte bassa del petto, risali controllato.'],
    en: ['Bench press', 'Shoulder blades pinched, bar to your lower chest, press up under control.'],
  },
  db_bench_press: {
    fr: ['Développé couché aux haltères', 'Haltères sur les côtés de la poitrine, pousse droit vers le haut.'],
    it: ['Panca piana con manubri', 'Manubri ai lati del petto, spingi dritto verso l’alto.'],
    en: ['Dumbbell bench press', 'Dumbbells beside your chest, press straight up.'],
  },
  chest_press_machine: {
    fr: ['Presse pectorale à la machine', 'Poignées à hauteur de poitrine, pousse vers l’avant, coudes légèrement fléchis.'],
    it: ['Chest press alla macchina', 'Maniglie all’altezza del petto, spingi in avanti, gomiti leggermente flessi.'],
    en: ['Machine chest press', 'Handles at chest height, press forward, keep a slight bend in the elbows.'],
  },
  cable_fly: {
    fr: ['Écartés à la poulie', 'Bras légèrement fléchis, rapproche-les en arc devant la poitrine.'],
    it: ['Croci ai cavi', 'Braccia leggermente flesse, chiudile ad arco davanti al petto.'],
    en: ['Cable fly', 'Slightly bent arms, bring them together in an arc in front of your chest.'],
  },
  push_up: {
    fr: ['Pompes', 'Corps gainé comme une planche ; trop dur ? Genoux au sol.'],
    it: ['Piegamenti', 'Corpo dritto come un’asse; troppo difficile? Ginocchia a terra.'],
    en: ['Push-up', 'Body straight like a plank; too hard? Knees on the floor.'],
  },
  overhead_press: {
    fr: ['Développé militaire', 'Abdos serrés, pousse la barre droit au-dessus de la tête.'],
    it: ['Military press', 'Addome contratto, spingi il bilanciere dritto sopra la testa.'],
    en: ['Overhead press', 'Brace your core, press the bar straight overhead.'],
  },
  db_shoulder_press: {
    fr: ['Développé épaules aux haltères', 'Assis, haltères à hauteur des oreilles, pousse vers le haut.'],
    it: ['Lento avanti con manubri', 'Seduto, manubri all’altezza delle orecchie, spingi verso l’alto.'],
    en: ['Dumbbell shoulder press', 'Seated, dumbbells at ear height, press up.'],
  },
  shoulder_press_machine: {
    fr: ['Presse épaules à la machine', 'Poignées à hauteur d’épaules, pousse vers le haut.'],
    it: ['Shoulder press alla macchina', 'Maniglie all’altezza delle spalle, spingi verso l’alto.'],
    en: ['Machine shoulder press', 'Handles at shoulder height, press up.'],
  },
  lateral_raise: {
    fr: ['Élévations latérales', 'Haltères légers sur les côtés jusqu’à hauteur d’épaules, redescends lentement.'],
    it: ['Alzate laterali', 'Manubri leggeri di lato fino all’altezza delle spalle, scendi lentamente.'],
    en: ['Lateral raise', 'Raise light dumbbells out to shoulder height, lower slowly.'],
  },
  face_pull: {
    fr: ['Face pull à la poulie', 'Tire la corde vers le front, coudes hauts et vers l’extérieur.'],
    it: ['Face pull ai cavi', 'Tira la corda verso la fronte, gomiti alti e in fuori.'],
    en: ['Cable face pull', 'Pull the rope towards your forehead, elbows high and wide.'],
  },
  y_raise: {
    fr: ['Élévations en Y au sol', 'À plat ventre, lève les bras en Y, pouces vers le haut.'],
    it: ['Alzate a Y a terra', 'Prono, solleva le braccia a Y, pollici in su.'],
    en: ['Floor Y raise', 'Lying face down, lift your arms in a Y, thumbs up.'],
  },
  pike_push_up: {
    fr: ['Pompes piquées', 'Hanches hautes comme un toit, descends la tête vers le sol.'],
    it: ['Pike push-up', 'Anche alte come un tetto, abbassa la testa verso il pavimento.'],
    en: ['Pike push-up', 'Hips high like a roof, lower your head towards the floor.'],
  },
  row: {
    fr: ['Rowing à la barre', 'Buste penché, tire la barre vers le nombril.'],
    it: ['Rematore con bilanciere', 'Busto inclinato, tira il bilanciere verso l’ombelico.'],
    en: ['Barbell row', 'Torso leaning forward, pull the bar to your belly button.'],
  },
  db_row: {
    fr: ['Rowing haltère', 'Une main sur le banc, tire l’haltère vers la hanche.'],
    it: ['Rematore con manubrio', 'Una mano sulla panca, tira il manubrio verso l’anca.'],
    en: ['Dumbbell row', 'One hand on the bench, pull the dumbbell to your hip.'],
  },
  cable_row: {
    fr: ['Tirage horizontal à la poulie', 'Assis bien droit, tire la poignée vers le ventre, omoplates serrées.'],
    it: ['Pulley basso', 'Seduto dritto, tira la maniglia verso la pancia, scapole addotte.'],
    en: ['Seated cable row', 'Sit tall, pull the handle to your stomach, squeeze your shoulder blades.'],
  },
  machine_row: {
    fr: ['Rowing à la machine', 'Poitrine contre le coussin, tire les poignées vers toi.'],
    it: ['Rematore alla macchina', 'Petto contro il cuscino, tira le maniglie verso di te.'],
    en: ['Machine row', 'Chest against the pad, pull the handles towards you.'],
  },
  lat_pulldown: {
    fr: ['Tirage vertical', 'Tire la barre vers le haut de la poitrine, jamais derrière la nuque.'],
    it: ['Lat machine', 'Tira la barra verso la parte alta del petto, mai dietro la nuca.'],
    en: ['Lat pulldown', 'Pull the bar to your upper chest, never behind your head.'],
  },
  pull_up: {
    fr: ['Tractions', 'Depuis la suspension, monte jusqu’à ce que le menton passe la barre.'],
    it: ['Trazioni alla sbarra', 'Dalla sospensione, sali finché il mento supera la sbarra.'],
    en: ['Pull-up', 'From a dead hang, pull up until your chin clears the bar.'],
  },
  inverted_row: {
    fr: ['Rowing inversé sous une table', 'Allongé sous une table solide, tire la poitrine vers le bord.'],
    it: ['Rematore inverso sotto il tavolo', 'Sdraiato sotto un tavolo robusto, tira il petto verso il bordo.'],
    en: ['Table row', 'Lie under a sturdy table and pull your chest to the edge.'],
  },
  back_extension: {
    fr: ['Extensions lombaires', 'Hanches contre le coussin, descends le buste lentement et remonte droit.'],
    it: ['Hyperextension', 'Anche contro il cuscino, abbassa il busto lentamente e risali dritto.'],
    en: ['Back extension', 'Hips on the pad, lower your torso slowly and raise it straight.'],
  },
  superman: {
    fr: ['Superman', 'À plat ventre, lève légèrement bras et jambes en même temps.'],
    it: ['Superman', 'Prono, solleva leggermente braccia e gambe insieme.'],
    en: ['Superman', 'Face down, lift your arms and legs slightly at the same time.'],
  },
  curl: {
    fr: ['Curl biceps', 'Coudes collés au corps, monte et descends les haltères lentement.'],
    it: ['Curl bicipiti', 'Gomiti vicino al corpo, sali e scendi lentamente con i manubri.'],
    en: ['Biceps curl', 'Elbows by your sides, curl the dumbbells up and down slowly.'],
  },
  cable_curl: {
    fr: ['Curl biceps à la poulie', 'Les coudes restent collés, seul l’avant-bras bouge.'],
    it: ['Curl bicipiti ai cavi', 'I gomiti restano fermi, si muove solo l’avambraccio.'],
    en: ['Cable biceps curl', 'Elbows stay pinned, only your forearms move.'],
  },
  triceps_pushdown: {
    fr: ['Extension triceps à la poulie', 'Coudes collés au corps, tends la corde vers le bas.'],
    it: ['Pushdown tricipiti ai cavi', 'Gomiti vicino al corpo, distendi la corda verso il basso.'],
    en: ['Cable triceps pushdown', 'Elbows by your sides, push the rope down to full extension.'],
  },
  bench_dip: {
    fr: ['Dips sur banc', 'Mains derrière toi sur le banc, fléchis les coudes vers l’arrière.'],
    it: ['Dip su panca', 'Mani dietro di te sulla panca, fletti i gomiti all’indietro.'],
    en: ['Bench dip', 'Hands behind you on the bench, bend your elbows straight back.'],
  },
  plank: {
    fr: ['Gainage', 'Corps droit, abdos et fessiers serrés.'],
    it: ['Plank', 'Corpo dritto, addome e glutei contratti.'],
    en: ['Plank', 'Body straight, brace your abs and glutes.'],
  },
  dead_bug: {
    fr: ['Dead bug', 'Sur le dos, tends lentement un bras et la jambe opposée.'],
    it: ['Dead bug', 'Supino, distendi lentamente un braccio e la gamba opposta.'],
    en: ['Dead bug', 'On your back, slowly extend one arm and the opposite leg.'],
  },
  ab_machine: {
    fr: ['Machine à abdominaux', 'Enroule le buste, ne tire pas avec les bras.'],
    it: ['Crunch alla macchina', 'Arrotola il busto, non tirare con le braccia.'],
    en: ['Ab crunch machine', 'Curl your torso in, don’t pull with your arms.'],
  },
};

const TEMPLATE_NAMES = {
  'fullbody-2': { fr: 'Full body, 2 jours', it: 'Total body, 2 giorni', en: 'Full body, 2 days' },
  'fullbody-3': { fr: 'Full body, 3 jours', it: 'Total body, 3 giorni', en: 'Full body, 3 days' },
  'ppl-3': { fr: 'Poussée / Tirage / Jambes', it: 'Spinta / Tirata / Gambe', en: 'Push / Pull / Legs' },
  'upper-lower-4': { fr: 'Haut / Bas du corps, 4 jours', it: 'Parte alta / bassa, 4 giorni', en: 'Upper / Lower, 4 days' },
  'ppl-ul-5': {
    fr: 'Poussée / Tirage / Jambes + Haut / Bas, 5 jours',
    it: 'Spinta / Tirata / Gambe + Alta / Bassa, 5 giorni',
    en: 'Push / Pull / Legs + Upper / Lower, 5 days',
  },
  'machines-2': { fr: 'Circuit machines, 2 jours', it: 'Circuito macchine, 2 giorni', en: 'Machine circuit, 2 days' },
  'home-3': { fr: 'À la maison sans matériel, 3 jours', it: 'A casa senza attrezzi, 3 giorni', en: 'At home, no equipment, 3 days' },
};

/** Einheiten nach ihrem deutschen Titel — so steht er in jedem Termin. */
const SESSION_TITLES = {
  'Ganzkörper A': { fr: 'Full body A', it: 'Total body A', en: 'Full body A' },
  'Ganzkörper B': { fr: 'Full body B', it: 'Total body B', en: 'Full body B' },
  'Ganzkörper C': { fr: 'Full body C', it: 'Total body C', en: 'Full body C' },
  Drücken: { fr: 'Poussée', it: 'Spinta', en: 'Push' },
  Ziehen: { fr: 'Tirage', it: 'Tirata', en: 'Pull' },
  Beine: { fr: 'Jambes', it: 'Gambe', en: 'Legs' },
  'Oberkörper schwer': { fr: 'Haut du corps lourd', it: 'Parte alta pesante', en: 'Upper body heavy' },
  'Unterkörper schwer': { fr: 'Bas du corps lourd', it: 'Parte bassa pesante', en: 'Lower body heavy' },
  'Oberkörper Volumen': { fr: 'Haut du corps volume', it: 'Parte alta volume', en: 'Upper body volume' },
  'Unterkörper Volumen': { fr: 'Bas du corps volume', it: 'Parte bassa volume', en: 'Lower body volume' },
  Oberkörper: { fr: 'Haut du corps', it: 'Parte alta', en: 'Upper body' },
  Unterkörper: { fr: 'Bas du corps', it: 'Parte bassa', en: 'Lower body' },
  'Geräte A': { fr: 'Machines A', it: 'Macchine A', en: 'Machines A' },
  'Geräte B': { fr: 'Machines B', it: 'Macchine B', en: 'Machines B' },
  'Zuhause A': { fr: 'Maison A', it: 'Casa A', en: 'Home A' },
  'Zuhause B': { fr: 'Maison B', it: 'Casa B', en: 'Home B' },
  'Zuhause C': { fr: 'Maison C', it: 'Casa C', en: 'Home C' },
};

const isDe = (language) => !language || language === 'de';

function exerciseName(id, language) {
  const german = EXERCISES[id]?.name ?? id;
  if (isDe(language)) return german;
  return EXERCISE_TEXTS[id]?.[language]?.[0] ?? german;
}

function exerciseHint(id, language) {
  const german = EXERCISES[id]?.hint ?? null;
  if (isDe(language) || german === null) return german;
  return EXERCISE_TEXTS[id]?.[language]?.[1] ?? german;
}

function templateName(id, language) {
  const german = TEMPLATES.find((template) => template.id === id)?.name ?? null;
  if (isDe(language) || !german) return german;
  return pick({ de: german, ...TEMPLATE_NAMES[id] }, language);
}

/** Der Titel einer Einheit — unbekannte (eigene) Titel bleiben, wie sie sind. */
function sessionTitle(title, language) {
  if (isDe(language) || typeof title !== 'string') return title;
  return SESSION_TITLES[title]?.[language] ?? title;
}

/**
 * Vorschlag oder Ergebnis eines Trainings-Werkzeugs in der Sprache der Anfrage.
 * Alles andere kommt unveraendert zurueck.
 */
function localizeData(data, language) {
  if (!data || typeof data !== 'object' || isDe(language)) return data;
  const next = { ...data };
  if (typeof data.title === 'string') next.title = sessionTitle(data.title, language);
  if (data.kind === 'workout_plan' || data.kind === 'workout_plan_saved') {
    const name = data.templateId ? templateName(data.templateId, language) : null;
    if (data.kind === 'workout_plan' && name) next.template = name;
    if (data.kind === 'workout_plan_saved' && name) next.name = name;
    if (Array.isArray(data.sessions))
      next.sessions = data.sessions.map((title) => sessionTitle(title, language));
    if (Array.isArray(data.sessionDetails))
      next.sessionDetails = data.sessionDetails.map((session) => ({
        ...session,
        title: sessionTitle(session.title, language),
        exercises: (session.exercises ?? []).map((entry) => ({
          ...entry,
          name: entry.exerciseId ? exerciseName(entry.exerciseId, language) : entry.name,
        })),
      }));
  }
  if (Array.isArray(data.workouts))
    next.workouts = data.workouts.map((row) => ({ ...row, title: sessionTitle(row.title, language) }));
  if (Array.isArray(data.records))
    next.records = data.records.map((row) => ({ ...row, name: exerciseName(row.exerciseId, language) }));
  return next;
}

/** Eine gespeicherte Aktion: Vorschau und Ergebnis uebersetzt, Angaben und Aenderungen unberuehrt. */
function localizeAction(action, language) {
  if (!action || isDe(language)) return action;
  return {
    ...action,
    preview: action.preview
      ? { ...action.preview, summary: localizeData(action.preview.summary, language) }
      : action.preview,
    result: localizeData(action.result, language),
  };
}

module.exports = {
  EXERCISE_TEXTS,
  SESSION_TITLES,
  TEMPLATE_NAMES,
  exerciseHint,
  exerciseName,
  localizeAction,
  localizeData,
  sessionTitle,
  templateName,
};
