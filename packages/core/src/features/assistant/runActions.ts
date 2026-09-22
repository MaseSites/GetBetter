import { APP_MODULES, type AppId } from '@/app/identity';
import {
  bills as billRepo,
  contacts as contactRepo,
  dayKey,
  drinks as drinkRepo,
  expenses as expenseRepo,
  habits as habitRepo,
  meals as mealRepo,
  notes as noteRepo,
  tasks as taskRepo,
  workouts as workoutRepo,
  type AiAction,
} from '@/db';
import {
  alarms as alarmRepo,
  chores as choreRepo,
  events as eventRepo,
  shopping as shoppingRepo,
  targetOf,
  type EventFields,
  type EventTarget,
} from '@/db/repositories';
import { dueAtOfDay } from '@/db/taskFields';
import type { CelebrationKind } from '@/features/celebrate/celebrations';
import { guessCategory, splitQuantity } from '@/features/shopping/categories';
import {
  formatBirthDate,
  formatDayMonth,
  formatList,
  formatLongDate,
  formatMoney,
  formatNumber,
  formatTime,
  type Language,
  type Translate,
  type TranslationKey,
} from '@/i18n';
import { moduleName } from '@/mocks/moduleText';

import {
  eventWindow,
  mealSlotAt,
  movedWindow,
  parseAction,
  type AssistantAction,
  type EventWindow,
  type ThemeMode,
} from './actions';
import type { ContextRefs } from './context';

/**
 * Fuehrt aus, was der Assistent aufgerufen hat — ueber dieselben Repositories
 * wie die Bildschirme, nie direkt am Speicher. Jede Aktion sagt selbst, was
 * daraus wurde; den Satz baut die App, nicht das Modell, damit nie etwas
 * behauptet wird, das nicht passiert ist.
 */
export type ActionEnv = {
  t: Translate;
  language: Language;
  app: AppId;
  accountId: string;
  /** Der aktive Haushalt: Einkauf, Aemtli und der Familienkalender gehoeren ihm. */
  householdId: string | null;
  /** Die Kennungen aus dem Kontext, mit dem gefragt wurde. */
  refs: ContextRefs;
  now: Date;
  openModule: (module: string) => void;
  setMode: (mode: ThemeMode) => void;
};

export type ActionOutcome = {
  ok: boolean;
  text: string;
  celebrate?: CelebrationKind;
  /** Nimmt die Aktion zurueck — beim Loeschen, Verschieben und Abhaken. */
  undo?: () => Promise<void>;
};

const done = (text: string, extra: Omit<ActionOutcome, 'ok' | 'text'> = {}): ActionOutcome => ({
  ok: true,
  text,
  ...extra,
});
const refused = (text: string): ActionOutcome => ({ ok: false, text });

/** „Mittwoch, 23. September, 14:00“ — ganztaegig ohne Uhrzeit. */
function whenOf(language: Language, window: Pick<EventWindow, 'startsAt' | 'allDay'>): string {
  const day = formatLongDate(language, window.startsAt);
  return window.allDay ? day : `${day}, ${formatTime(language, window.startsAt)}`;
}

/** Ein Tag `YYYY-MM-DD` als Zeitpunkt mitten am Tag — so verrutscht er in keiner Zeitzone. */
const noonOf = (day: string) => dueAtOfDay(day);

function eventTarget(env: ActionEnv): EventTarget | null {
  if (env.app !== 'betterfamily') return { calendar: 'personal', calendarId: null, householdId: null };
  return env.householdId ? { calendar: 'family', calendarId: null, householdId: env.householdId } : null;
}

async function createEvent(action: Extract<AssistantAction, { name: 'create_event' }>, env: ActionEnv) {
  const target = eventTarget(env);
  if (!target) return refused(env.t('assistant.did.noHousehold'));
  const window = eventWindow(action.date, action.start, action.end);
  await eventRepo.create(
    {
      accountId: env.accountId,
      isPrivate: false,
      title: action.title,
      ...window,
      location: action.location,
      notes: action.note,
      color: null,
    },
    [target],
  );
  return done(env.t('assistant.did.event', { title: action.title, when: whenOf(env.language, window) }), {
    celebrate: 'event',
  });
}

/** Der Termin hinter einer Kennung, samt allen Kopien — oder null. */
async function eventOfRef(ref: string, env: ActionEnv) {
  const groupId = env.refs[ref];
  if (!groupId) return null;
  const rows = await eventRepo.group(groupId);
  const first = rows[0];
  return first ? { groupId, rows, first } : null;
}

function fieldsOf(row: {
  isPrivate?: boolean;
  title: string;
  location?: string | null;
  notes?: string | null;
  color?: string | null;
}): Omit<EventFields, 'startsAt' | 'endsAt' | 'allDay'> {
  return {
    isPrivate: row.isPrivate ?? false,
    title: row.title,
    location: row.location ?? null,
    notes: row.notes ?? null,
    color: row.color ?? null,
  };
}

async function moveEvent(action: Extract<AssistantAction, { name: 'move_event' }>, env: ActionEnv) {
  const found = await eventOfRef(action.ref, env);
  if (!found) return refused(env.t('assistant.did.missing'));
  const { groupId, rows, first } = found;
  const before = { startsAt: first.startsAt, endsAt: first.endsAt ?? null, allDay: first.allDay ?? false };
  const window = movedWindow(before, action);
  const targets = rows.map(targetOf);
  const base = fieldsOf(first);
  await eventRepo.save(groupId, first.accountId, { ...base, ...window }, targets);
  return done(env.t('assistant.did.eventMoved', { title: first.title, when: whenOf(env.language, window) }), {
    celebrate: 'event',
    undo: () => eventRepo.save(groupId, first.accountId, { ...base, ...before }, targets),
  });
}

async function deleteEvent(action: Extract<AssistantAction, { name: 'delete_event' }>, env: ActionEnv) {
  const found = await eventOfRef(action.ref, env);
  if (!found) return refused(env.t('assistant.did.missing'));
  await eventRepo.remove(found.groupId);
  return done(env.t('assistant.did.eventDeleted', { title: found.first.title }), {
    undo: () => eventRepo.restore(found.rows),
  });
}

async function createTask(action: Extract<AssistantAction, { name: 'create_task' }>, env: ActionEnv) {
  await taskRepo.create({
    accountId: env.accountId,
    householdId: env.householdId,
    title: action.title,
    dueAt: action.date ? dueAtOfDay(action.date) : null,
    ...(action.time ? { dueTime: action.time } : {}),
    priority: action.priority as 0 | 1 | 2 | 3,
    ...(action.note ? { notes: action.note } : {}),
  });
  if (!action.date) return done(env.t('assistant.did.task', { title: action.title }), { celebrate: 'task' });
  const day = formatLongDate(env.language, noonOf(action.date));
  return done(
    env.t('assistant.did.taskDue', { title: action.title, when: action.time ? `${day}, ${action.time}` : day }),
    { celebrate: 'task' },
  );
}

async function completeTask(action: Extract<AssistantAction, { name: 'complete_task' }>, env: ActionEnv) {
  const id = env.refs[action.ref];
  const task = id ? await taskRepo.find(id) : undefined;
  if (!task || task.done) return refused(env.t('assistant.did.missing'));
  await taskRepo.setDone(task.id, true);
  return done(env.t('assistant.did.taskDone', { title: task.title }), {
    celebrate: 'done',
    undo: async () => {
      await taskRepo.setDone(task.id, false);
    },
  });
}

async function addBirthday(action: Extract<AssistantAction, { name: 'add_birthday' }>, env: ActionEnv) {
  const wanted = action.person.toLocaleLowerCase();
  const known = (await contactRepo.list(env.accountId)).find(
    (row) => row.name.trim().toLocaleLowerCase() === wanted,
  );
  const patch = { birthday: action.birthday, birthYearKnown: action.yearKnown };
  if (known) await contactRepo.update(known.id, patch);
  else await contactRepo.add({ accountId: env.accountId, name: action.person, ...patch });
  const [year, month, day] = action.birthday.split('-').map(Number);
  const date = new Date(year ?? 2000, (month ?? 1) - 1, day ?? 1);
  const shown = action.yearKnown ? formatBirthDate(env.language, date) : formatDayMonth(env.language, date);
  return done(env.t('assistant.did.birthday', { name: known?.name ?? action.person, date: shown }), {
    celebrate: 'birthday',
  });
}

async function addShopping(action: Extract<AssistantAction, { name: 'add_shopping' }>, env: ActionEnv) {
  for (const entry of action.items) {
    const { name, quantity } = splitQuantity(entry);
    await shoppingRepo.add({
      accountId: env.accountId,
      householdId: env.householdId,
      name,
      quantity,
      category: guessCategory(name),
    });
  }
  return done(env.t('assistant.did.shopping', { items: formatList(env.language, action.items) }), {
    celebrate: 'shopping',
  });
}

async function run(action: AssistantAction, env: ActionEnv): Promise<ActionOutcome> {
  const { t, language, accountId } = env;
  const today = dayKey(env.now);
  switch (action.name) {
    case 'create_event':
      return createEvent(action, env);
    case 'move_event':
      return moveEvent(action, env);
    case 'delete_event':
      return deleteEvent(action, env);
    case 'create_task':
      return createTask(action, env);
    case 'complete_task':
      return completeTask(action, env);
    case 'create_note':
      await noteRepo.create({ accountId, title: action.title, body: action.text });
      return done(t('assistant.did.note', { title: action.title }), { celebrate: 'note' });
    case 'set_alarm':
      await alarmRepo.create({ accountId, time: action.time, label: action.label, days: action.days });
      return done(t('assistant.did.alarm', { time: action.time }));
    case 'add_birthday':
      return addBirthday(action, env);
    case 'add_habit':
      await habitRepo.add({ accountId, name: action.habit, targetPerWeek: action.perWeek });
      return done(t('assistant.did.habit', { name: action.habit }), { celebrate: 'done' });
    case 'add_shopping':
      return addShopping(action, env);
    case 'add_chore':
      if (!env.householdId) return refused(t('assistant.did.noHousehold'));
      await choreRepo.create({ householdId: env.householdId, title: action.title });
      return done(t('assistant.did.chore', { title: action.title }), { celebrate: 'chore' });
    case 'log_water':
      await drinkRepo.add(accountId, today, action.dl);
      return done(
        t('assistant.did.water', { amount: t('water.add', { amount: formatNumber(language, action.dl) }) }),
        { celebrate: 'water' },
      );
    case 'log_meal':
      await mealRepo.add({
        accountId,
        day: today,
        name: action.meal,
        kcal: action.kcal,
        slot: action.slot ?? mealSlotAt(env.now.getHours()),
      });
      return done(t('assistant.did.meal', { name: action.meal, kcal: formatNumber(language, action.kcal) }), {
        celebrate: 'done',
      });
    case 'log_workout':
      await workoutRepo.add({ accountId, day: today, kind: action.kind, minutes: action.minutes });
      return done(t('assistant.did.workout', { kind: action.kind, minutes: action.minutes }), {
        celebrate: 'workout',
      });
    case 'add_expense':
      await expenseRepo.add({
        accountId,
        day: today,
        amountChf: action.amount,
        category: action.category,
        note: action.note,
      });
      return done(t('assistant.did.expense', { amount: formatMoney(language, action.amount) }), {
        celebrate: 'money',
      });
    case 'add_bill':
      await billRepo.add({ accountId, title: action.title, amountChf: action.amount, dueDay: action.dueDate });
      return done(
        t('assistant.did.bill', {
          title: action.title,
          amount: formatMoney(language, action.amount),
          when: formatLongDate(language, noonOf(action.dueDate)),
        }),
        { celebrate: 'money' },
      );
    case 'open_function':
      if (!APP_MODULES[env.app].includes(action.module)) return refused(t('assistant.did.noModule'));
      env.openModule(action.module);
      return done(t('assistant.did.open', { name: moduleName(t, action.module) }));
    case 'set_theme':
      env.setMode(action.mode);
      return done(t('assistant.did.theme', { mode: t(`appearance.mode.${action.mode}` as TranslationKey) }));
  }
}

/**
 * Alle Aufrufe einer Antwort, einer nach dem anderen. Was sich nicht lesen
 * laesst, faellt weg; was scheitert, sagt es — die anderen laufen trotzdem.
 */
export async function runActions(actions: readonly AiAction[], env: ActionEnv): Promise<ActionOutcome[]> {
  const outcomes: ActionOutcome[] = [];
  for (const raw of actions) {
    const action = parseAction(raw);
    if (!action) continue;
    try {
      outcomes.push(await run(action, env));
    } catch {
      outcomes.push(refused(env.t('assistant.did.failed')));
    }
  }
  return outcomes;
}
