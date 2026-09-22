/**
 * Was will die Person? Regeln in vier Sprachen — deterministisch, testbar und
 * ohne KI-Aufruf. Heraus kommt ein Werkzeug mit Angaben oder `general`
 * (dann darf die KI frei antworten, aber nichts aendern).
 *
 * „Ich will heute nicht trainieren. Verschiebe das Training auf morgen.“
 *   -> { tool: 'reschedule_workout', args: { fromDay: heute, toDay: morgen } }
 *
 * Woerter gelten ganz („oggi“ ist nicht „oggigiorno“); ein `*` am Ende heisst
 * Wortanfang („verschieb*“ trifft „verschiebe“ und „verschieben“).
 */
const { normalize } = require('../catalog/index.js');

const WEEKDAYS = {
  sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  domenica: 0, lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6,
};

const escape = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patternOf = (word) =>
  word.endsWith('*')
    ? new RegExp(`(^| )${escape(word.slice(0, -1))}`)
    : new RegExp(`(^| )${escape(word)}($| )`);
const has = (text, words) => words.some((word) => patternOf(word).test(text));

function shiftDay(day, delta) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
}

const TODAY_WORDS = ['heute', 'today', 'aujourd hui', 'oggi'];

/** „morgen“, „übermorgen“, „am Freitag“ … -> Tag, oder null. */
function dayFrom(text, today) {
  if (has(text, ['ubermorgen', 'day after tomorrow', 'apres demain', 'dopodomani'])) return shiftDay(today, 2);
  if (has(text, ['morgen', 'tomorrow', 'demain', 'domani'])) return shiftDay(today, 1);
  if (has(text, TODAY_WORDS)) return today;
  const weekday = Object.entries(WEEKDAYS).find(([word]) => has(text, [word]));
  if (weekday) {
    const current = new Date(`${today}T12:00:00Z`).getUTCDay();
    const ahead = (weekday[1] - current + 7) % 7 || 7;
    return shiftDay(today, ahead);
  }
  return null;
}

const TRAINING_WORDS = ['train*', 'workout*', 'gym', 'entrain*', 'seance*', 'allena*', 'sport*'];

/**
 * Zielt der Satz auf das Verschieben — und von wo wohin? „Verschieb Freitag
 * auf Samstag“: vor „auf“ steht der Tag, von dem es weggeht, danach das Ziel.
 * Ohne eigenen Tag davor gilt heute.
 */
function rescheduleOf(text, today) {
  const moveWords = ['verschieb*', 'verleg*', 'schieb*', 'move', 'moving', 'reschedul*', 'postpone*', 'deplac*', 'report*', 'sposta*', 'rimand*'];
  const skipToday = has(text, ['heute nicht', 'not today', 'pas aujourd hui', 'oggi non', 'keine lust']);
  const parts = text.split(/ (?:auf|nach|to|a|au|al|zu) /);
  const before = parts[0] ?? '';
  const target = parts.slice(1).join(' ');
  // „Verschieb Freitag auf Samstag“ braucht kein „Training“: zwei Tage sagen genug.
  const twoDays = parts.length > 1 && dayFrom(before, today) !== null && dayFrom(target, today) !== null;
  if (!(has(text, moveWords) || skipToday) || !(has(text, TRAINING_WORDS) || twoDays)) return null;
  const fromDay = parts.length > 1 ? (dayFrom(before, today) ?? today) : today;
  const toDay =
    dayFrom(target, today) ??
    (parts.length > 1 ? null : dayFrom(text.replace(/heute|today|aujourd hui|oggi/g, ''), today)) ??
    shiftDay(fromDay, 1);
  return toDay === fromDay ? null : { tool: 'reschedule_workout', args: { fromDay, toDay } };
}

/** „Ich lasse das Training heute aus“, „skip today's workout“. */
function skipOf(text, today) {
  const skip =
    has(text, ['auslass*', 'fallt aus', 'streich*', 'skip*', 'sauter', 'saute', 'annul*', 'salto', 'saltare', 'salta', 'cancel*']) ||
    (has(text, ['lass', 'lasse', 'lassen']) && has(text, ['aus']));
  if (!skip || !has(text, TRAINING_WORDS)) return null;
  return { tool: 'skip_workout', args: { day: dayFrom(text, today) ?? today } };
}

/** Woerter, mit denen man sich wiegt — „kg“ allein reicht nicht. */
const WEIGH_WORDS = ['wiege', 'wiegt', 'gewogen', 'gewicht', 'korpergewicht', 'waage', 'weigh*', 'my weight', 'bodyweight', 'body weight', 'scale', 'pese', 'pesee', 'mon poids', 'balance', 'peso', 'pesato', 'pesata', 'bilancia'];
/** Woerter aus dem Training: „Ich habe 80 kg gedrückt“ ist kein Koerpergewicht. */
const LIFT_WORDS = ['gedruckt', 'drucke', 'gehoben', 'hebe', 'bank*', 'kniebeug*', 'kreuzheb*', 'satz', 'satze', 'wiederhol*', 'hantel*', 'langhantel*', 'kurzhantel*', 'squat*', 'bench*', 'press*', 'lift*', 'deadlift*', 'curl*', 'row*', 'rudern', 'rep', 'reps', 'set', 'sets', 'developpe*', 'souleve*', 'serie*', 'repetition*', 'panca', 'stacco', 'sollevat*', 'ripetizion*', 'distensione'];

function weightOf(text) {
  if (!has(text, WEIGH_WORDS) || has(text, LIFT_WORDS)) return null;
  const match = /(\d{2,3}(?:[.,]\d)?)\s*(kg|kilo)?/.exec(text.replace(/ (\d) (\d) /, ' $1.$2 '));
  if (!match) return null;
  const weightKg = Number(match[1].replace(',', '.'));
  return weightKg >= 30 && weightKg <= 350 ? { tool: 'log_weight', args: { weightKg } } : null;
}

/**
 * Die Absicht eines Satzes. `raw` ist der Text wie getippt (fuer den Vorrat),
 * `today` der Tag der Person. Gibt `{ tool, args }`, `{ tool: 'pantry_text' }`
 * oder `{ tool: 'general' }` — `safety: true`, wenn es um Schmerzen geht.
 */
function detectIntent(raw, today) {
  const text = normalize(raw).replace(/(\d) (\d)/g, '$1.$2');
  if (has(text, ['schmerz*', 'verletz*', 'weh', 'tut weh', 'pain*', 'injur*', 'hurt*', 'douleur*', 'blesse*', 'dolor*', 'infortun*', 'schwindel*', 'dizzy'])) {
    return { tool: 'general', safety: true };
  }
  const reschedule = rescheduleOf(text, today);
  if (reschedule) return reschedule;
  const skip = skipOf(text, today);
  if (skip) return skip;
  const weight = weightOf(text);
  if (weight) return weight;
  // „Ich habe 80 kg gedrückt“: ein Satz aus dem Training, kein Vorrat und kein Gewicht — frei beantworten.
  if (has(text, LIFT_WORDS) && /\d/.test(text)) return { tool: 'general' };
  if (has(text, ['rekord*', 'bestleistung*', 'record*', 'personal best*', 'primat*', 'massimal*'])) {
    return { tool: 'get_records', args: {} };
  }
  if (has(text, ['wochenplan*', 'essensplan*', 'menuplan*', 'meal plan*', 'plan de repas', 'menu de la semaine', 'piano pasti', 'piano settimanale'])) {
    return { tool: 'create_weekly_meal_plan', args: {} };
  }
  if (has(text, ['einkaufsliste*', 'shopping list*', 'grocery*', 'liste de courses', 'lista della spesa'])) return { tool: 'generate_shopping_list', args: {} };
  if (has(text, ['ich habe', 'ich hab', 'wir haben', 'i have', 'we have', 'j ai', 'nous avons', 'ho', 'abbiamo'])) return { tool: 'pantry_text' };
  const askMeal = has(text, ['was soll ich', 'was esse ich', 'was konnte ich', 'what should i', 'what can i']) && has(text, ['essen', 'eat']);
  if (askMeal || has(text, ['quoi manger', 'que manger', 'que dois je manger', 'cosa mangio', 'cosa posso mangiare'])) {
    return { tool: 'find_meals_for_remaining_macros', args: {} };
  }
  if (has(text, ['rezept*', 'kochen', 'koche', 'backen', 'recipe*', 'cook*', 'recette*', 'cuisiner', 'ricett*', 'cucinare'])) return { tool: 'suggest_recipes_from_pantry', args: {} };
  if (has(text, ['ubrig', 'noch essen', 'remaining', 'left today', 'reste', 'rimane', 'rimangono', 'makros', 'macros'])) return { tool: 'get_remaining_macros', args: {} };
  if (has(text, ['trainingsplan*', 'wann trainier*', 'nachstes training', 'schedule', 'next workout', 'prochain entrain*', 'prossimo allena*'])) {
    return { tool: 'get_workout_schedule', args: {} };
  }
  if (has(text, ['fortschritt*', 'wie lauft', 'progress*', 'how am i doing', 'progres', 'progressi', 'come sto andando'])) return { tool: 'explain_progress', args: {} };
  if (has(text, ['vorrat', 'pantry', 'what do i have', 'reserves', 'dispensa'])) return { tool: 'get_pantry_items', args: {} };
  if (has(text, ['heute gegessen', 'zusammenfassung', 'summary', 'resume', 'riepilogo'])) return { tool: 'get_today_summary', args: {} };
  return { tool: 'general' };
}

module.exports = { dayFrom, detectIntent, has };
