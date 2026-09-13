import type { TranslationKey } from './de';

/** Italienisch: die App-Hülle (Heute, Suche, Navigation) (de-shell.ts). Teil von `it`. */
export const itShell = {
  'shell.create': 'Crea',
  'shell.create.task': 'Attività',
  'shell.create.note': 'Nota',
  'shell.create.mail': 'E-mail',
  'shell.create.birthday': 'Compleanno',

  'search.best': 'Risultato migliore',
  'search.group.tasks': 'Attività',
  'search.group.notes': 'Note',
  'search.group.mail': 'E-mail',
  'search.group.people': 'Persone',
  'search.group.places': 'Luoghi',
  'search.group.entries': 'Altre voci',
  'search.group.functions': 'Funzioni',
  'search.showAll': 'Tutti e {count}',
  'search.recent': 'Ricerche recenti',
  'search.otherApps': 'Altre app Better',
  'search.noSubject': 'Senza oggetto',
} as const satisfies Partial<Record<TranslationKey, string>>;
