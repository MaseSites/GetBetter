/**
 * Der KI-Router: welche Stufe beantwortet eine Nachricht?
 *
 * Rein und ohne Modellaufruf — das Routen selbst kostet nichts. Er liest die
 * Absicht an Schluesselwoertern ab (Deutsch samt Schweizerdeutsch, Englisch,
 * Franzoesisch, Italienisch) und nimmt immer die guenstigste Stufe, die das kann:
 *
 * - `vision`       ein Bild ist dabei                      -> vision_model
 * - `command`      kurzer Auftrag („trag … ein“, „zeig“)    -> cheap_model
 * - `simple_query` kurze Frage mit klarer Antwort, Rechnen  -> cheap_model
 * - `coaching`     Tipps, Motivation, besser werden        -> chat_model
 * - `planning`     Plaene, Analysen, Vergleiche            -> reasoning_model nur in
 *                  BetterAi und BetterGym, sonst chat_model
 * - `conversation` alles andere                            -> chat_model; in GetBetter,
 *                  BetterFamily und BetterMoney cheap_model, solange Text und Verlauf kurz sind
 */

const APPS = ['getbetter', 'betterfamily', 'bettergym', 'betterai', 'bettermoney'];
const TIERS = ['cheap_model', 'chat_model', 'reasoning_model', 'vision_model'];
const INTENTS = ['command', 'simple_query', 'conversation', 'coaching', 'planning', 'vision'];

/** Nur hier lohnt die Stufe mit Denkzeit: Trainingsplaene, Analysen. */
const REASONING_APPS = new Set(['betterai', 'bettergym']);
/** Hier sind Gespraeche meist kurz — die guenstige Stufe reicht (Ziel: rund 80 %). */
const LIGHT_APPS = new Set(['getbetter', 'betterfamily', 'bettermoney']);

/** Laenger ist kein kurzer Auftrag und keine kurze Frage mehr. */
const SHORT_TEXT = 200;
/** „Wann …?“, „Wo …?“ gilt nur so kurz als Faktenfrage. */
const SHORT_QUESTION = 80;
/** Ab hier braucht ein Gespraech in den leichten Apps die Chat-Stufe. */
const LONG_CONVERSATION = 280;
const LONG_HISTORY = 6;
/** So lange Eingaben sind in BetterAi und BetterGym ein Fall fuer die Planung. */
const LONG_INPUT = 600;

const MAX_CHARS = {
  voice: { cheap_model: 300, chat_model: 600, vision_model: 600, reasoning_model: 900 },
  text: { cheap_model: 600, chat_model: 1500, vision_model: 1200, reasoning_model: 3000 },
};

const COST_LEVELS = {
  cheap_model: 'low',
  chat_model: 'medium',
  vision_model: 'medium',
  reasoning_model: 'high',
};

/** Hoeflichkeit vor dem Verb: „Bitte trag …“, „Hey, zeig …“. */
const LEAD = "^(?:(?:bitte|hey|hallo|hoi|salue|ok|okay|please|pls|s'il te plait|stp|per favore|dai)[,!]? )*";
const start = (verbs) => new RegExp(`${LEAD}(?:${verbs})`);

/**
 * Die Tabellen arbeiten auf `normalise(text)`: klein, Umlaute ausgeschrieben
 * (ä -> ae), Akzente weg. Darum steht hier „fuer“ und „entrainement“.
 */
const KEYWORDS = {
  /** Eindeutig Planung, egal wie der Satz anfaengt. */
  planning: {
    de: [
      /\bplan fue?r\b/,
      /\b(erstell|mach|schreib|entw[iu]rf)\w*\b[^.?!]{0,40}plan\b/,
      /\banalys/,
      /\bvergl(ei|ii|i)ch/,
      /\bschritt fue?r schritt\b/,
      /\bstrategie/,
      /\bplan(e|en)? (mir )?(meine|mini|die|de|den|das) (woche|wuche|ferien|reise|training|monat|tag)\b/,
    ],
    en: [
      /\bplan for\b/,
      /\b(create|make|build|write|design|draft|put together)\b[^.?!]{0,40}\bplan\b/,
      /\banaly[sz]/,
      /\bcompar(e|ing|ison)\b/,
      /\bstep[- ]by[- ]step\b/,
      /\bstrateg(y|ies|ic)\b/,
      /\bplan (my|the|a) (week|month|trip|training|day|workouts?)\b/,
    ],
    fr: [
      /\bplan pour\b/,
      /\b(cree|creer|fais|faire|elabore|prepare|redige|ecris)\b[^.?!]{0,40}\b(plan|programme|planning)\b/,
      /\banalys/,
      /\bcompar(e|er|aison)\b/,
      /\betape par etape\b/,
      /\bstrategi/,
      /\bplanifi/,
    ],
    it: [
      /\bpiano per\b/,
      /\b(crea|creami|fai|fammi|prepara|preparami|scrivi|elabora)\b[^.?!]{0,40}\b(piano|programma|scheda)\b/,
      /\banalizz/,
      /\bconfront/,
      /\bpasso (dopo|per) passo\b/,
      /\bstrategi/,
      /\bpianific/,
    ],
  },
  /** Plaene als Wort — Planung, ausser der Satz ist ein Auftrag („Zeig den Trainingsplan“). */
  planNouns: {
    de: [
      /\b(trainings|ernaehrungs|essens|menue|mahlzeiten|wochen|tages|monats|lern|spar|budget|fitness|lauf|diaet)plan\b/,
      /\btrainingsprogramm\b/,
    ],
    en: [
      /\b(training|workout|meal|diet|weekly|daily|study|savings|budget|fitness|running|exercise) (plan|program|programme|schedule)\b/,
    ],
    fr: [
      /\b(plan|programme|planning) (d'entrainement|de repas|alimentaire|de la semaine|hebdomadaire|d'epargne|de musculation|sportif|de course)\b/,
    ],
    it: [
      /\b(piano|scheda|programma) (di allenamento|d'allenamento|alimentare|settimanale|dei pasti|di risparmio|di corsa)\b/,
    ],
  },
  coaching: {
    de: [
      /\btipps?\b/,
      /\bratschlae?g/,
      /\bmotivier/,
      /\bmotivation\b/,
      /\bwie schaff(e)? (ich|i)\b/,
      /\bwie chan i\b/,
      /\bcoach/,
      /\bverbesser/,
      /\bbesser werden\b/,
      /\bdranbleiben\b/,
      /\bdurchhalten\b/,
    ],
    en: [
      /\btips?\b/,
      /\badvice\b/,
      /\bmotivat/,
      /\bcoach/,
      /\bhow (can|do|should) i (get better|improve|stay motivated|stick)/,
      /\bimprov(e|ing)\b/,
      /\bstay on track\b/,
    ],
    fr: [
      /\bconseils?\b/,
      /\bastuces?\b/,
      /\bmotiv/,
      /\bcoach/,
      /\bcomment (progresser|m'ameliorer|tenir|rester motive)/,
      /\bameliorer\b/,
    ],
    it: [
      /\bconsigli/,
      /\btrucchi\b/,
      /\bmotiva/,
      /\bcoach/,
      /\bcome (posso )?(migliorare|migliorarmi|progredire|restare motivat)/,
      /\bmiglior(are|armi)\b/,
    ],
  },
  /** Ein Auftrag faengt mit dem Verb an. */
  command: {
    de: [
      start(
        '(trag|traeg|fueg|setz|stell|erinner|zeig|loesch|entfern|erstell|leg|mach|schalt|oeffn|notier|merk|start|stopp?|hak|markier|schreib|schrib|verschieb|aender|nimm|lies|list)\\w*\\b',
      ),
      start('(tue?|due) (das|mer|mir|es|en|e)\\b'),
    ],
    en: [
      start(
        '(add|set|remind|create|delete|remove|show|open|turn (on|off)|switch (on|off)|start|stop|schedule|put|mark|note|log|track|cancel|list|book|move|clear|check off|write down|save)\\b',
      ),
    ],
    fr: [
      start(
        '(ajoute|ajouter|mets|mettre|rappelle|cree|creer|supprime|efface|montre|affiche|ouvre|allume|eteins|active|desactive|note|lance|arrete|annule|enregistre|coche|marque|inscris|liste)\\b',
      ),
    ],
    it: [
      start(
        '(aggiungi|metti|imposta|ricordami|ricorda|crea|elimina|cancella|rimuovi|mostra|mostrami|apri|accendi|spegni|attiva|disattiva|segna|annota|avvia|ferma|sposta|salva|elenca)\\b',
      ),
    ],
  },
  /** Auftraege, die nicht mit dem Verb anfangen. */
  commandPhrases: {
    de: [
      /\berinner\w* (mich|mi)\b/,
      /\btrag\w*\b[^.?!]{0,60}\bi?ein\b/,
      /\b(auf|uf) (die|d'|mini|meine) (einkaufsliste|liste|lischte|poschtiliste)\b/,
    ],
    en: [/\bremind me\b/, /\badd\b[^.?!]{0,40}\bto (my|the)\b/],
    fr: [/\brappelle[- ]moi\b/],
    it: [/\bricordami\b/],
  },
  simpleQuery: {
    de: [
      /\b(be)?rechne\b/,
      /\braechne\b/,
      /\bausrechnen\b/,
      /\bwie ?viele? (kalorien|kcal|gramm|protein|eiweiss|kohlenhydrate|liter|kilometer|km|minuten|stunden|tage|wochen|schritte)\b/,
      /\bwie ?vill?e? (kalorie|kalorien|kcal)\b/,
      /\bkalorien (hat|haben|in|von)\b/,
      /\bumrechnen\b/,
      /\bprozent von\b/,
      /\bwas (ist|gibt|macht|isch) \d/,
      /\bwie spaet\b/,
    ],
    en: [
      /\bcalculate\b/,
      /\bhow many (calories|kcal|grams|protein|carbs|liters|litres|km|miles|minutes|hours|days|weeks|steps)\b/,
      /\bcalories (in|does|do)\b/,
      /\bconvert\b/,
      /\bpercent of\b/,
      /\bwhat(?:'s| is) \d/,
      /\bhow much is \d/,
      /\bwhat time\b/,
    ],
    fr: [
      /\bcalcule/,
      /\bcombien de (calories|kcal|grammes|proteines|litres|km|kilometres|minutes|heures|jours|semaines|pas)\b/,
      /\bconverti[rs]?\b/,
      /\bpour ?cent de\b/,
      /\bcombien (fait|font) \d/,
      /\bquelle heure\b/,
    ],
    it: [
      /\bcalcola/,
      /\bquante (calorie|kcal|proteine|ore|settimane)\b/,
      /\bquanti (grammi|litri|km|chilometri|minuti|giorni|passi)\b/,
      /\bconverti\b/,
      /\bper ?cento di\b/,
      /\bquanto fa \d/,
      /\bche ore\b/,
    ],
    /** Rechenausdruecke in jeder Sprache: „12 * 7“, „3x10“, „20 % von 80“. */
    any: [
      /\d\s*[+*/×÷^]\s*\d/,
      /\d\s+-\s+\d/,
      /\d\s*x\s*\d/,
      /\d\s*(mal|plus|minus|geteilt durch|times|divided by|fois|moins|divise par|piu|meno|diviso) \d/,
      /\d\s*% (von|of|de|di)\b/,
    ],
  },
  /** Kurze Faktenfragen: „Wann …?“, „Where …?“, „Combien …?“, „Quando …?“. */
  factualStart: {
    de: [
      start(
        '(wann|wo|wer|wie ?viele?|wie ?vill?|wie spaet|wie alt|wie hoch|wie weit|wie lange?|welche[rsnm]?)\\b',
      ),
    ],
    en: [start('(when|where|who|how (many|much|old|far|long|tall)|which)\\b')],
    fr: [start('(quand|ou|qui|combien|quel(le)?s?)\\b')],
    it: [start('(quando|dove|chi|quant[aieo]|qual[ei]?)\\b')],
  },
};

/** Klein, Umlaute ausgeschrieben, ohne Akzente, Leerraum zusammengezogen. */
function normalise(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const patternsOf = (table) => Object.values(table).flat();
const matches = (text, table) => patternsOf(table).some((pattern) => pattern.test(text));

/** Die Absicht einer Nachricht. Die Reihenfolge der Pruefungen ist gewollt. */
function detectIntent({ app, text, hasImage }) {
  if (hasImage === true) return 'vision';
  const plain = normalise(text);
  const length = String(text ?? '').trim().length;
  const isCommand = matches(plain, KEYWORDS.command);

  if (matches(plain, KEYWORDS.planning)) return 'planning';
  if (!isCommand && matches(plain, KEYWORDS.planNouns)) return 'planning';
  if (matches(plain, KEYWORDS.coaching)) return 'coaching';
  if (length <= SHORT_TEXT && (isCommand || matches(plain, KEYWORDS.commandPhrases))) {
    return 'command';
  }
  if (length <= SHORT_TEXT && matches(plain, KEYWORDS.simpleQuery)) return 'simple_query';
  if (length <= SHORT_QUESTION && matches(plain, KEYWORDS.factualStart)) return 'simple_query';
  if (length > LONG_INPUT && REASONING_APPS.has(app)) return 'planning';
  return 'conversation';
}

/** Die guenstigste Stufe, die diese Absicht in dieser App kann. */
function tierFor({ intent, app, text, historyLength }) {
  if (intent === 'vision') return 'vision_model';
  if (intent === 'command' || intent === 'simple_query') return 'cheap_model';
  if (intent === 'coaching') return 'chat_model';
  if (intent === 'planning') return REASONING_APPS.has(app) ? 'reasoning_model' : 'chat_model';
  if (!LIGHT_APPS.has(app)) return 'chat_model';
  const history = Number.isFinite(historyLength) ? historyLength : 0;
  const long = String(text ?? '').trim().length > LONG_CONVERSATION || history > LONG_HISTORY;
  return long ? 'chat_model' : 'cheap_model';
}

/**
 * `{ app, text, hasImage, voice, historyLength }` ->
 * `{ intent, tier, maxChars, tts, costLevel }`.
 */
function routeRequest({ app, text, hasImage = false, voice = false, historyLength = 0 } = {}) {
  const intent = detectIntent({ app, text, hasImage });
  const tier = tierFor({ intent, app, text, historyLength });
  const tts = voice === true;
  return {
    intent,
    tier,
    maxChars: MAX_CHARS[tts ? 'voice' : 'text'][tier],
    tts,
    costLevel: COST_LEVELS[tier],
  };
}

module.exports = {
  APPS,
  COST_LEVELS,
  INTENTS,
  KEYWORDS,
  LIGHT_APPS,
  LONG_CONVERSATION,
  LONG_HISTORY,
  LONG_INPUT,
  MAX_CHARS,
  REASONING_APPS,
  SHORT_QUESTION,
  SHORT_TEXT,
  TIERS,
  detectIntent,
  normalise,
  routeRequest,
  tierFor,
};
