import type { AiAction } from '../../db/ai';
import { endOfDay, startOfDay } from '../calendar/dates';

/**
 * Was der Assistent in der App tun kann. Der Dienst gibt dem Modell diese
 * Funktionen (`services/api/ai/tools.js`) und reicht die Aufrufe geprueft
 * zurueck; hier werden sie noch einmal gelesen — nie blind vertrauen — und zu
 * einem Auftrag, den `runActions.ts` ueber die Repositories ausfuehrt.
 *
 * Rein gerechnet und getestet. `test/assistant-tools.test.js` haelt die Namen
 * gleich mit dem Dienst.
 */
export const ACTION_NAMES = [
  'create_event',
  'move_event',
  'delete_event',
  'create_task',
  'complete_task',
  'create_note',
  'set_alarm',
  'add_birthday',
  'add_habit',
  'add_shopping',
  'add_chore',
  'log_water',
  'log_meal',
  'log_workout',
  'add_expense',
  'add_bill',
  'open_function',
  'set_theme',
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

const EVERYWHERE = ['open_function', 'set_theme'] as const;
const CALENDAR = ['create_event', 'move_event', 'delete_event'] as const;

/**
 * Welche App welche Funktionen hat — wie `apps` in `services/api/ai/tools.js`.
 * BetterAi fehlt: dort bedient der Assistent nichts.
 */
export const APP_ACTIONS: Readonly<Record<string, readonly ActionName[]>> = {
  getbetter: [
    ...CALENDAR,
    'create_task',
    'complete_task',
    'create_note',
    'set_alarm',
    'add_birthday',
    'add_habit',
    'add_shopping',
    'add_chore',
    ...EVERYWHERE,
  ],
  betterfamily: [...CALENDAR, 'add_shopping', 'add_chore', ...EVERYWHERE],
  bettergym: ['log_water', 'log_meal', 'log_workout', ...EVERYWHERE],
  bettermoney: ['add_expense', 'add_bill', ...EVERYWHERE],
};

export const ALARM_DAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const;
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const EXPENSE_CATEGORIES = ['food', 'home', 'transport', 'fun', 'health', 'other'] as const;
export const THEME_MODES = ['light', 'dark', 'system'] as const;

export type AlarmDay = (typeof ALARM_DAYS)[number];
export type MealSlot = (typeof MEAL_SLOTS)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ThemeMode = (typeof THEME_MODES)[number];

export type AssistantAction =
  | {
      name: 'create_event';
      title: string;
      date: string;
      start: string | null;
      end: string | null;
      location: string | null;
      note: string | null;
    }
  | { name: 'move_event'; ref: string; date: string | null; start: string | null; end: string | null }
  | { name: 'delete_event'; ref: string }
  | {
      name: 'create_task';
      title: string;
      date: string | null;
      time: string | null;
      priority: number;
      note: string | null;
    }
  | { name: 'complete_task'; ref: string }
  | { name: 'create_note'; title: string; text: string }
  | { name: 'set_alarm'; time: string; label: string; days: readonly AlarmDay[] }
  | { name: 'add_birthday'; person: string; birthday: string; yearKnown: boolean }
  | { name: 'add_habit'; habit: string; perWeek: number }
  | { name: 'add_shopping'; items: readonly string[] }
  | { name: 'add_chore'; title: string }
  | { name: 'log_water'; dl: number }
  | { name: 'log_meal'; meal: string; kcal: number; slot: MealSlot | null }
  | { name: 'log_workout'; kind: string; minutes: number }
  | { name: 'add_expense'; amount: number; category: ExpenseCategory; note: string | null }
  | { name: 'add_bill'; title: string; amount: number; dueDate: string }
  | { name: 'open_function'; module: string }
  | { name: 'set_theme'; mode: ThemeMode };

type Args = Readonly<Record<string, unknown>>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const REF = /^[A-Z]\d{1,3}$/;
/** Ohne Ende dauert ein Termin eine Stunde. */
const DEFAULT_MINUTES = 60;
const MINUTE_MS = 60_000;
/** Ohne Jahr steht ein Geburtstag im Schaltjahr 2000 — so geht auch der 29. Februar. */
const NO_YEAR = 2000;

const isRecord = (value: unknown): value is Args =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function text(args: Args, key: string, max: number): string | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function matching(args: Args, key: string, pattern: RegExp): string | null {
  const value = args[key];
  return typeof value === 'string' && pattern.test(value.trim()) ? value.trim() : null;
}

function numberIn(args: Args, key: string, min: number, max: number): number | null {
  const raw = args[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function integerIn(args: Args, key: string, min: number, max: number): number | null {
  const value = numberIn(args, key, min, max);
  return value !== null && Number.isInteger(value) ? value : null;
}

function oneOf<T extends string>(args: Args, key: string, options: readonly T[]): T | null {
  const value = args[key];
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/** Ein echter Tag — der 31. Juni zum Beispiel nicht. */
function realDay(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Der Geburtstag als `YYYY-MM-DD`, ohne Jahr im Platzhalterjahr — oder null. */
export function birthdayKey(month: number, day: number, year: number | null): string | null {
  const stored = year ?? NO_YEAR;
  return realDay(stored, month, day) ? `${stored}-${pad(month)}-${pad(day)}` : null;
}

function refIn(args: Args): string | null {
  return matching(args, 'ref', REF);
}

function strings(args: Args, key: string, max: number, limit: number): string[] {
  const value = args[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= max)
    .slice(0, limit);
}

function eventOf(args: Args): AssistantAction | null {
  const title = text(args, 'title', 120);
  const date = matching(args, 'date', DAY);
  if (!title || !date) return null;
  return {
    name: 'create_event',
    title,
    date,
    start: matching(args, 'start', TIME),
    end: matching(args, 'end', TIME),
    location: text(args, 'location', 120),
    note: text(args, 'note', 500),
  };
}

function taskOf(args: Args): AssistantAction | null {
  const title = text(args, 'title', 120);
  if (!title) return null;
  return {
    name: 'create_task',
    title,
    date: matching(args, 'date', DAY),
    time: matching(args, 'time', TIME),
    priority: integerIn(args, 'priority', 0, 3) ?? 0,
    note: text(args, 'note', 500),
  };
}

function birthdayOf(args: Args): AssistantAction | null {
  const person = text(args, 'name', 120);
  const month = integerIn(args, 'month', 1, 12);
  const day = integerIn(args, 'day', 1, 31);
  if (!person || month === null || day === null) return null;
  const year = integerIn(args, 'year', 1900, 2100);
  const birthday = birthdayKey(month, day, year);
  return birthday ? { name: 'add_birthday', person, birthday, yearKnown: year !== null } : null;
}

type Reader = (args: Args) => AssistantAction | null;

const READERS: Readonly<Record<ActionName, Reader>> = {
  create_event: eventOf,
  move_event: (args) => {
    const ref = refIn(args);
    return ref
      ? {
          name: 'move_event',
          ref,
          date: matching(args, 'date', DAY),
          start: matching(args, 'start', TIME),
          end: matching(args, 'end', TIME),
        }
      : null;
  },
  delete_event: (args) => {
    const ref = refIn(args);
    return ref ? { name: 'delete_event', ref } : null;
  },
  create_task: taskOf,
  complete_task: (args) => {
    const ref = refIn(args);
    return ref ? { name: 'complete_task', ref } : null;
  },
  create_note: (args) => {
    const title = text(args, 'title', 120);
    return title ? { name: 'create_note', title, text: text(args, 'text', 4000) ?? '' } : null;
  },
  set_alarm: (args) => {
    const time = matching(args, 'time', TIME);
    if (!time) return null;
    const days = strings(args, 'days', 2, 7).filter((day): day is AlarmDay =>
      (ALARM_DAYS as readonly string[]).includes(day),
    );
    // In der Woche geordnet und jeder Tag nur einmal.
    const ordered = ALARM_DAYS.filter((day) => days.includes(day));
    return { name: 'set_alarm', time, label: text(args, 'label', 60) ?? '', days: ordered };
  },
  add_birthday: birthdayOf,
  add_habit: (args) => {
    const habit = text(args, 'name', 120);
    return habit
      ? { name: 'add_habit', habit, perWeek: integerIn(args, 'per_week', 1, 7) ?? 7 }
      : null;
  },
  add_shopping: (args) => {
    const items = strings(args, 'items', 80, 20);
    return items.length > 0 ? { name: 'add_shopping', items } : null;
  },
  add_chore: (args) => {
    const title = text(args, 'title', 120);
    return title ? { name: 'add_chore', title } : null;
  },
  log_water: (args) => {
    const dl = numberIn(args, 'dl', 0.5, 30);
    return dl === null ? null : { name: 'log_water', dl: Math.round(dl * 10) / 10 };
  },
  log_meal: (args) => {
    const meal = text(args, 'name', 120);
    const kcal = integerIn(args, 'kcal', 0, 5000);
    return meal && kcal !== null
      ? { name: 'log_meal', meal, kcal, slot: oneOf(args, 'slot', MEAL_SLOTS) }
      : null;
  },
  log_workout: (args) => {
    const kind = text(args, 'kind', 60);
    const minutes = integerIn(args, 'minutes', 1, 600);
    return kind && minutes !== null ? { name: 'log_workout', kind, minutes } : null;
  },
  add_expense: (args) => {
    const amount = numberIn(args, 'amount', 0.05, 100_000);
    return amount === null
      ? null
      : {
          name: 'add_expense',
          amount,
          category: oneOf(args, 'category', EXPENSE_CATEGORIES) ?? 'other',
          note: text(args, 'note', 120),
        };
  },
  add_bill: (args) => {
    const title = text(args, 'title', 120);
    const amount = numberIn(args, 'amount', 0.05, 100_000);
    const dueDate = matching(args, 'due_date', DAY);
    return title && amount !== null && dueDate ? { name: 'add_bill', title, amount, dueDate } : null;
  },
  open_function: (args) => {
    const module = text(args, 'module', 40);
    return module ? { name: 'open_function', module } : null;
  },
  set_theme: (args) => {
    const mode = oneOf(args, 'mode', THEME_MODES);
    return mode ? { name: 'set_theme', mode } : null;
  },
};

const isActionName = (value: string): value is ActionName => Object.hasOwn(READERS, value);

/** Ein Aufruf aus dem Dienst als Auftrag — oder null, wenn er nicht taugt. */
export function parseAction(raw: AiAction): AssistantAction | null {
  if (typeof raw?.name !== 'string' || !isActionName(raw.name)) return null;
  return READERS[raw.name](isRecord(raw.args) ? raw.args : {});
}

function dateOf(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

function atTime(day: string, time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const date = dateOf(day);
  date.setHours(hour ?? 0, minute ?? 0, 0, 0);
  return date;
}

export type EventWindow = { startsAt: string; endsAt: string; allDay: boolean };

/**
 * Beginn und Ende eines Termins in Ortszeit — wie der Termin-Editor: ohne
 * Start ganztaegig, ohne (oder mit falschem) Ende eine Stunde, nie ueber
 * Mitternacht hinaus.
 */
export function eventWindow(date: string, start: string | null, end: string | null): EventWindow {
  const day = dateOf(date);
  if (!start) {
    return { startsAt: startOfDay(day).toISOString(), endsAt: endOfDay(day).toISOString(), allDay: true };
  }
  const from = atTime(date, start);
  const planned = end ? atTime(date, end) : null;
  const to =
    planned && planned > from ? planned : new Date(from.getTime() + DEFAULT_MINUTES * MINUTE_MS);
  const latest = endOfDay(day);
  return {
    startsAt: from.toISOString(),
    endsAt: (to > latest ? latest : to).toISOString(),
    allDay: false,
  };
}

const localDay = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const localTime = (iso: string) => {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Wohin ein Termin verschoben wird: was nicht genannt ist, bleibt — der Tag,
 * die Uhrzeit, die Dauer. Ein ganztaegiger bleibt ganztaegig, bis eine Zeit kommt.
 */
export function movedWindow(
  current: { startsAt: string; endsAt: string | null; allDay: boolean },
  change: { date: string | null; start: string | null; end: string | null },
): EventWindow {
  const date = change.date ?? localDay(current.startsAt);
  if (!change.start && current.allDay) return eventWindow(date, null, null);
  const start = change.start ?? localTime(current.startsAt);
  if (change.end) return eventWindow(date, start, change.end);
  const minutes =
    current.allDay || !current.endsAt
      ? DEFAULT_MINUTES
      : Math.max(1, Math.round((Date.parse(current.endsAt) - Date.parse(current.startsAt)) / MINUTE_MS));
  const from = atTime(date, start);
  const to = new Date(from.getTime() + minutes * MINUTE_MS);
  const latest = endOfDay(dateOf(date));
  return { startsAt: from.toISOString(), endsAt: (to > latest ? latest : to).toISOString(), allDay: false };
}

/** Wann gegessen wird, wenn der Assistent es nicht sagt. */
export function mealSlotAt(hour: number): MealSlot {
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 17) return 'snack';
  if (hour < 22) return 'dinner';
  return 'snack';
}
