import type { TranslationKey } from './de';

/** Englisch: die App-Hülle (Heute, Suche, Navigation) (de-shell.ts). Teil von `en`. */
export const enShell = {
  'shell.create': 'Create new',
  'shell.create.task': 'Task',
  'shell.create.note': 'Note',
  'shell.create.mail': 'Email',
  'shell.create.birthday': 'Birthday',

  'search.best': 'Top hit',
  'search.group.tasks': 'Tasks',
  'search.group.notes': 'Notes',
  'search.group.mail': 'Emails',
  'search.group.people': 'People',
  'search.group.places': 'Places',
  'search.group.entries': 'More entries',
  'search.group.functions': 'Functions',
  'search.showAll': 'All {count}',
  'search.recent': 'Recent searches',
  'search.otherApps': 'Other Better apps',
  'search.noSubject': 'No subject',
} as const satisfies Partial<Record<TranslationKey, string>>;
