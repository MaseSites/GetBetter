import {
  bills as billRepo,
  contacts as contactRepo,
  mail as mailRepo,
  meds as medRepo,
  recipes as recipeRepo,
  savings as savingsRepo,
  subscriptions as subscriptionRepo,
  useLiveQuery,
} from '@/db';
import {
  events as eventRepo,
  notes as noteRepo,
  shopping as shoppingRepo,
  tasks as taskRepo,
} from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { nextBirthday, relativeDay } from '@/features/shared/days';
import { formatShortDate, useI18n } from '@/i18n';
import { BUILT_MODULE_IDS, MODULES, modulesOfApp } from '@/mocks/modules';
import { moduleName, moduleShort } from '@/mocks/moduleText';
import { useAccount, useApp } from '@/state/AppContext';
import type { IconName } from '@/ui';

import type { SearchCandidate } from './results';

/** Was eine Trefferzeile braucht, um sich zu zeigen und den Eintrag zu oeffnen. */
export type SearchItem = {
  /** Bestimmt die Farbe des Symbols. */
  moduleId: string;
  icon: IconName;
  subtitle?: string | undefined;
  /** Wohin ein Tipp fuehrt — der Eintrag selbst, wo die Funktion das kann. */
  href: string;
};

export type SearchEntry = SearchCandidate<SearchItem>;

export type SearchSource = {
  /** Alles Durchsuchbare in der Reihenfolge der Gruppen. */
  candidates: readonly SearchEntry[];
  /** Die Funktionen dieser App — auch ohne Eingabe zu sehen. */
  functions: readonly SearchEntry[];
};

/** Oeffnet einen Eintrag in seiner Funktion: `/run/tasks?task=<id>`. */
function itemHref(moduleId: string, param: string, value: string): string {
  return `/run/${moduleId}?${param}=${encodeURIComponent(value)}`;
}

function iconOf(moduleId: string): IconName {
  return MODULES.find((module) => module.id === moduleId)?.icon ?? 'circle';
}

/**
 * Sammelt, was diese App durchsuchen kann. Jede App sucht nur in ihren eigenen
 * Funktionen; die Rechnung, was passt, macht `rankResults`.
 */
export function useSearchCandidates(): SearchSource {
  const { t, language } = useI18n();
  const account = useAccount();
  const { household } = useApp();
  const { access } = useCalendarAccess();
  const householdId = household?.id ?? null;
  const modules = modulesOfApp();
  const owned = new Set(modules.map((module) => module.id));
  const hasMail = owned.has('mail');

  const taskList = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const noteList = useLiveQuery(() => noteRepo.list(account.id), [account.id]);
  const mailList = useLiveQuery(
    () => (hasMail ? mailRepo.messages(account.id) : Promise.resolve([])),
    [account.id, hasMail],
  );
  const contactList = useLiveQuery(() => contactRepo.list(account.id), [account.id]);
  const eventList = useLiveQuery(
    () => eventRepo.listUpcoming(access, new Date().toISOString(), 50),
    [access.accountId, access.householdIds, access.calendarIds],
  );
  const shoppingList = useLiveQuery(
    () => shoppingRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const recipeList = useLiveQuery(
    () => recipeRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const medList = useLiveQuery(() => medRepo.list(account.id), [account.id]);
  const billList = useLiveQuery(() => billRepo.listOpen(account.id), [account.id]);
  const subscriptionList = useLiveQuery(() => subscriptionRepo.list(account.id), [account.id]);
  const goalList = useLiveQuery(() => savingsRepo.list(account.id), [account.id]);

  const tasks: SearchEntry[] = owned.has('tasks')
    ? (taskList.data ?? []).map((row) => ({
        key: `task-${row.id}`,
        group: 'tasks',
        title: row.title,
        extra: [row.notes],
        item: {
          moduleId: 'tasks',
          icon: iconOf('tasks'),
          subtitle: row.dueAt ? relativeDay(t, language, row.dueAt.slice(0, 10)) : undefined,
          href: itemHref('tasks', 'task', row.id),
        },
      }))
    : [];

  const notes: SearchEntry[] = owned.has('notes')
    ? (noteList.data ?? []).map((row) => ({
        key: `note-${row.id}`,
        group: 'notes',
        title: row.title || t('notes.untitled'),
        extra: [row.body],
        item: {
          moduleId: 'notes',
          icon: iconOf('notes'),
          subtitle: row.body.slice(0, 60) || undefined,
          href: itemHref('notes', 'note', row.id),
        },
      }))
    : [];

  // Der Papierkorb bleibt draussen: was man weggeworfen hat, sucht man nicht.
  const mails: SearchEntry[] = (mailList.data ?? [])
    .filter((row) => row.folderRole !== 'trash')
    .map((row) => ({
      key: `mail-${row.id}`,
      group: 'mail',
      title: row.subject.trim() || t('search.noSubject'),
      extra: [row.from.name, row.from.address, row.snippet],
      item: {
        moduleId: 'mail',
        icon: iconOf('mail'),
        subtitle: [row.from.name || row.from.address, formatShortDate(language, row.date)]
          .filter((part) => part.length > 0)
          .join(' · '),
        href: itemHref('mail', 'message', row.id),
      },
    }));

  // Wer einen Geburtstag hat, oeffnet sich in den Geburtstagen; sonst bei den Kontakten.
  const people: SearchEntry[] = (contactList.data ?? []).flatMap((row): SearchEntry[] => {
    if (row.birthday && owned.has('birthdays')) {
      const next = nextBirthday(row.birthday);
      const when = relativeDay(t, language, next.day);
      return [
        {
          key: `person-${row.id}`,
          group: 'people',
          title: row.name,
          extra: [row.phone, row.note],
          item: {
            moduleId: 'birthdays',
            icon: 'gift',
            subtitle:
              row.birthYearKnown === false
                ? when
                : `${t('contacts.turns', { age: next.age })} · ${when}`,
            href: itemHref('birthdays', 'person', row.id),
          },
        },
      ];
    }
    if (!owned.has('contacts')) return [];
    return [
      {
        key: `person-${row.id}`,
        group: 'people',
        title: row.name,
        extra: [row.phone, row.note],
        item: { moduleId: 'contacts', icon: iconOf('contacts'), href: '/run/contacts' },
      },
    ];
  });

  const savedPlaces = account.weatherPlaces ?? (account.weatherPlace ? [account.weatherPlace] : []);
  const places: SearchEntry[] = owned.has('weather')
    ? savedPlaces
        .map((place): SearchEntry => ({
          key: `place-${place.lat},${place.lon}`,
          group: 'places',
          title: place.name,
          item: {
            moduleId: 'weather',
            icon: 'location',
            href: `/run/weather?place=${place.lat},${place.lon}`,
          },
        }))
        .filter((entry, index, all) => all.findIndex((other) => other.key === entry.key) === index)
    : [];

  /** Eintraege ohne eigenen Oeffnen-Weg: ein Tipp fuehrt in die Funktion. */
  function entries<T>(
    moduleId: string,
    rows: readonly T[] | undefined,
    read: (row: T) => {
      id: string;
      title: string;
      subtitle?: string | undefined;
      extra?: readonly string[];
    },
  ): SearchEntry[] {
    if (!owned.has(moduleId)) return [];
    return (rows ?? []).map((row) => {
      const entry = read(row);
      return {
        key: `${moduleId}-${entry.id}`,
        group: 'entries',
        title: entry.title,
        extra: entry.extra ?? [],
        item: {
          moduleId,
          icon: iconOf(moduleId),
          subtitle: entry.subtitle,
          href: `/run/${moduleId}`,
        },
      };
    });
  }

  const others: SearchEntry[] = [
    ...entries('calendar', eventList.data, (row) => ({
      id: row.id,
      title: row.title,
      subtitle: formatShortDate(language, row.startsAt),
    })),
    ...entries('shopping', shoppingList.data, (row) => ({
      id: row.id,
      title: row.name,
      subtitle: row.quantity ?? undefined,
    })),
    ...entries('recipes', recipeList.data, (row) => ({
      id: row.id,
      title: row.title,
      extra: row.ingredients,
    })),
    ...entries('meds', medList.data, (row) => ({
      id: row.id,
      title: row.name,
      subtitle: row.dose ?? undefined,
    })),
    ...entries('bills', billList.data, (row) => ({
      id: row.id,
      title: row.title,
      subtitle: formatShortDate(language, row.dueDay),
    })),
    ...entries('subscriptions', subscriptionList.data, (row) => ({ id: row.id, title: row.name })),
    ...entries('savings', goalList.data, (row) => ({ id: row.id, title: row.name })),
  ];

  const functions: SearchEntry[] = modules.map((module) => ({
    key: `function-${module.id}`,
    group: 'functions',
    title: moduleName(t, module.id),
    extra: [moduleShort(t, module.id)],
    item: {
      moduleId: module.id,
      icon: module.icon,
      href: BUILT_MODULE_IDS.includes(module.id) ? `/run/${module.id}` : `/module/${module.id}`,
    },
  }));

  return {
    candidates: [...tasks, ...notes, ...mails, ...people, ...places, ...others, ...functions],
    functions,
  };
}
