/**
 * Was der Assistent in einer App tun kann — als Funktionen im Format der
 * OpenAI-Schnittstelle (`tools`). Der Dienst fuehrt nichts davon aus: er gibt
 * die Aufrufe des Modells geprueft an die App zurueck (`actions`), und die App
 * traegt sie ueber ihre Repositories ein, genau wie ihre Bildschirme.
 *
 * Die Namen und Felder stehen ein zweites Mal in
 * `packages/core/src/features/assistant/actions.ts`; `test/assistant-tools.test.js`
 * haelt beide gleich.
 */

/** Hoechstens so viele Aufrufe aus einer Antwort — mehr ist fast immer ein Irrlauf. */
const MAX_ACTIONS = 5;

const DATE = {
  type: 'string',
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  description: 'Tag als YYYY-MM-DD, aus der Liste der naechsten Tage',
};
const TIME = {
  type: 'string',
  pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
  description: 'Uhrzeit HH:MM (24 h)',
};
const TITLE = { type: 'string', minLength: 1, maxLength: 120 };
const NOTE = { type: 'string', maxLength: 500 };
const REF = {
  type: 'string',
  pattern: '^[A-Z]\\d{1,3}$',
  description: 'Kennung aus der Liste im Kontext, z. B. T2',
};
const AMOUNT = { type: 'number', minimum: 0.05, maximum: 100000, description: 'Betrag in CHF' };

/** Was man in einer App oeffnen kann — dieselbe Liste wie `APP_MODULES` in `app/identity.ts`. */
const APP_MODULES = {
  getbetter: [
    'calendar',
    'tasks',
    'notes',
    'alarm',
    'weather',
    'documents',
    'habits',
    'travel',
    'contacts',
    'birthdays',
    'mail',
  ],
  betterfamily: ['calendar', 'shopping', 'chores', 'recipes', 'plants', 'pets', 'vehicles'],
  bettergym: [
    'nutrition',
    'trainingplan',
    'kitchen',
    'water',
    'coach',
    'progress',
    'sleep',
    'meds',
    'vitals',
    'mind',
  ],
  bettermoney: ['budget', 'bills', 'subscriptions', 'savings'],
};

const EVERYWHERE = Object.keys(APP_MODULES);
const CALENDAR_APPS = ['getbetter', 'betterfamily'];

const object = (properties, required = []) => ({ type: 'object', properties, required });

const TOOLS = [
  {
    name: 'create_event',
    apps: CALENDAR_APPS,
    description: 'Traegt einen Termin in den Kalender ein. Ohne Startzeit wird er ganztaegig.',
    parameters: object(
      {
        title: TITLE,
        date: DATE,
        start: TIME,
        end: TIME,
        location: { type: 'string', maxLength: 120 },
        note: NOTE,
      },
      ['title', 'date'],
    ),
  },
  {
    name: 'move_event',
    apps: CALENDAR_APPS,
    description:
      'Verschiebt einen Termin aus der Liste auf einen anderen Tag oder eine andere Zeit.',
    parameters: object({ ref: REF, date: DATE, start: TIME, end: TIME }, ['ref']),
  },
  {
    name: 'delete_event',
    apps: CALENDAR_APPS,
    description: 'Loescht einen Termin aus der Liste.',
    parameters: object({ ref: REF }, ['ref']),
  },
  {
    name: 'create_task',
    apps: ['getbetter'],
    description:
      'Legt eine Aufgabe an, auf Wunsch mit Frist und Wichtigkeit (0 normal bis 3 sehr wichtig).',
    parameters: object(
      {
        title: TITLE,
        date: DATE,
        time: TIME,
        priority: { type: 'integer', minimum: 0, maximum: 3 },
        note: NOTE,
      },
      ['title'],
    ),
  },
  {
    name: 'complete_task',
    apps: ['getbetter'],
    description: 'Hakt eine offene Aufgabe aus der Liste ab.',
    parameters: object({ ref: REF }, ['ref']),
  },
  {
    name: 'create_note',
    apps: ['getbetter'],
    description: 'Legt eine Notiz an.',
    parameters: object({ title: TITLE, text: { type: 'string', maxLength: 4000 } }, ['title']),
  },
  {
    name: 'set_alarm',
    apps: ['getbetter'],
    description: 'Stellt einen Wecker. Ohne Wochentage klingelt er einmal.',
    parameters: object(
      {
        time: TIME,
        label: { type: 'string', maxLength: 60 },
        days: {
          type: 'array',
          maxItems: 7,
          items: { type: 'string', enum: ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] },
        },
      },
      ['time'],
    ),
  },
  {
    name: 'add_birthday',
    apps: ['getbetter'],
    description: 'Traegt einen Geburtstag ein; das Jahr nur, wenn es bekannt ist.',
    parameters: object(
      {
        name: TITLE,
        month: { type: 'integer', minimum: 1, maximum: 12 },
        day: { type: 'integer', minimum: 1, maximum: 31 },
        year: { type: 'integer', minimum: 1900, maximum: 2100 },
      },
      ['name', 'month', 'day'],
    ),
  },
  {
    name: 'add_habit',
    apps: ['getbetter'],
    description: 'Legt eine Gewohnheit an, mit dem Ziel pro Woche (1 bis 7 Mal).',
    parameters: object({ name: TITLE, per_week: { type: 'integer', minimum: 1, maximum: 7 } }, [
      'name',
    ]),
  },
  {
    name: 'add_shopping',
    apps: CALENDAR_APPS,
    description:
      'Setzt Dinge auf die Einkaufsliste, je Ding ein Eintrag, Menge vorne (z. B. "2 Bananen").',
    parameters: object(
      {
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: { type: 'string', minLength: 1, maxLength: 80 },
        },
      },
      ['items'],
    ),
  },
  {
    name: 'add_chore',
    apps: CALENDAR_APPS,
    description: 'Legt ein Aemtli im Haushalt an.',
    parameters: object({ title: TITLE }, ['title']),
  },
  {
    name: 'log_water',
    apps: ['bettergym'],
    description: 'Traegt ein, was heute getrunken wurde, in Deziliter (2.5 dl ist ein Glas).',
    parameters: object({ dl: { type: 'number', minimum: 0.5, maximum: 30 } }, ['dl']),
  },
  {
    name: 'log_meal',
    apps: ['bettergym'],
    description: 'Traegt eine Mahlzeit von heute mit Kalorien ein.',
    parameters: object(
      {
        name: TITLE,
        kcal: { type: 'integer', minimum: 0, maximum: 5000 },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
      },
      ['name', 'kcal'],
    ),
  },
  {
    name: 'log_workout',
    apps: ['bettergym'],
    description: 'Traegt ein Training von heute ein: Art und Minuten.',
    parameters: object(
      {
        kind: { type: 'string', minLength: 1, maxLength: 60 },
        minutes: { type: 'integer', minimum: 1, maximum: 600 },
      },
      ['kind', 'minutes'],
    ),
  },
  {
    name: 'add_expense',
    apps: ['bettermoney'],
    description: 'Traegt eine Ausgabe von heute ins Budget ein.',
    parameters: object(
      {
        amount: AMOUNT,
        category: { type: 'string', enum: ['food', 'home', 'transport', 'fun', 'health', 'other'] },
        note: { type: 'string', maxLength: 120 },
      },
      ['amount'],
    ),
  },
  {
    name: 'add_bill',
    apps: ['bettermoney'],
    description: 'Traegt eine offene Rechnung mit Faelligkeit ein.',
    parameters: object({ title: TITLE, amount: AMOUNT, due_date: DATE }, [
      'title',
      'amount',
      'due_date',
    ]),
  },
  {
    name: 'open_function',
    apps: EVERYWHERE,
    description: 'Oeffnet eine Funktion dieser App.',
    parameters: object({ module: { type: 'string' } }, ['module']),
  },
  {
    name: 'set_theme',
    apps: EVERYWHERE,
    description: 'Stellt das Aussehen auf hell, dunkel oder wie das Geraet.',
    parameters: object({ mode: { type: 'string', enum: ['light', 'dark', 'system'] } }, ['mode']),
  },
];

/** `open_function` kennt nur die Funktionen der fragenden App. */
function parametersFor(tool, app) {
  if (tool.name !== 'open_function') return tool.parameters;
  return object({ module: { type: 'string', enum: APP_MODULES[app] ?? [] } }, ['module']);
}

const toolsOf = (app) => TOOLS.filter((tool) => tool.apps.includes(app));

/**
 * Was davon zum Modell geht: Typ, Pflichtfelder, Auswahl und Zahlengrenzen.
 * Laengen, Muster und Feldbeschreibungen prueft nur der Dienst — sie kosten bei
 * Groq Tokens, und die Minute hat im Gratis-Plan nur 8000.
 */
function slim(schema) {
  if (schema.type === 'object') {
    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(schema.properties).map(([key, field]) => [key, slim(field)]),
      ),
      required: schema.required,
    };
  }
  if (schema.type === 'array') return { type: 'array', items: slim(schema.items) };
  const kept = { type: schema.type };
  if (schema.enum !== undefined) kept.enum = schema.enum;
  if (schema.minimum !== undefined && schema.type !== 'string') kept.minimum = schema.minimum;
  if (schema.maximum !== undefined && schema.type !== 'string') kept.maximum = schema.maximum;
  return kept;
}

/** Die Funktionen einer App im Format der Schnittstelle; BetterAi hat keine. */
function toolsFor(app) {
  return toolsOf(app).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: slim(parametersFor(tool, app)),
    },
  }));
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const INVALID = Symbol('invalid');

/** Zahlen kommen manchmal als Text ("3") — das gilt noch. */
function numberOf(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return Number.NaN;
}

function checkString(schema, value) {
  if (typeof value !== 'string') return INVALID;
  const text = value.trim();
  if (schema.minLength !== undefined && text.length < schema.minLength) return INVALID;
  if (schema.maxLength !== undefined && text.length > schema.maxLength) return INVALID;
  if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(text)) return INVALID;
  if (schema.enum !== undefined && !schema.enum.includes(text)) return INVALID;
  return text;
}

function checkNumber(schema, value) {
  const number = numberOf(value);
  if (!Number.isFinite(number)) return INVALID;
  if (schema.type === 'integer' && !Number.isInteger(number)) return INVALID;
  if (schema.minimum !== undefined && number < schema.minimum) return INVALID;
  if (schema.maximum !== undefined && number > schema.maximum) return INVALID;
  return number;
}

function checkArray(schema, value) {
  if (!Array.isArray(value)) return INVALID;
  if (schema.minItems !== undefined && value.length < schema.minItems) return INVALID;
  if (schema.maxItems !== undefined && value.length > schema.maxItems) return INVALID;
  const items = value.map((item) => check(schema.items, item));
  return items.includes(INVALID) ? INVALID : items;
}

/** Leere und fehlende Nebenfelder fallen weg; Pflichtfelder muessen gueltig sein, Fremdes faellt weg. */
function checkObject(schema, value) {
  if (!isObject(value)) return INVALID;
  const clean = {};
  for (const [key, field] of Object.entries(schema.properties)) {
    const raw = value[key];
    const missing = raw === undefined || raw === null || raw === '';
    if (missing) {
      if (schema.required.includes(key)) return INVALID;
      continue;
    }
    const checked = check(field, raw);
    if (checked === INVALID) {
      if (schema.required.includes(key)) return INVALID;
      continue;
    }
    clean[key] = checked;
  }
  return clean;
}

function check(schema, value) {
  if (schema.type === 'object') return checkObject(schema, value);
  if (schema.type === 'array') return checkArray(schema, value);
  if (schema.type === 'string') return checkString(schema, value);
  if (schema.type === 'number' || schema.type === 'integer') return checkNumber(schema, value);
  return INVALID;
}

/** `arguments` ist meist JSON als Text, manchmal schon ein Objekt. */
function argumentsOf(raw) {
  if (isObject(raw)) return raw;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Die `tool_calls` einer Antwort -> `{ actions: [{ name, args }], rejected }`.
 * Nur Funktionen dieser App (und mit `only` nur die angebotenen), nur mit
 * gueltigen Feldern; hoechstens `MAX_ACTIONS`.
 */
function actionsOf(toolCalls, app, only = null) {
  const allowed = new Map(
    toolsOf(app)
      .filter((tool) => only === null || only.includes(tool.name))
      .map((tool) => [tool.name, parametersFor(tool, app)]),
  );
  const actions = [];
  let rejected = 0;
  for (const call of Array.isArray(toolCalls) ? toolCalls : []) {
    const name = call?.function?.name;
    const schema = typeof name === 'string' ? allowed.get(name) : undefined;
    const args = argumentsOf(call?.function?.arguments);
    const checked = schema && args ? check(schema, args) : INVALID;
    if (checked === INVALID || actions.length >= MAX_ACTIONS) {
      rejected += 1;
      continue;
    }
    actions.push({ name, args: checked });
  }
  return { actions, rejected };
}

module.exports = { APP_MODULES, MAX_ACTIONS, TOOLS, actionsOf, toolsFor };
