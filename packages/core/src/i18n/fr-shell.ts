import type { TranslationKey } from './de';

/** Französisch: die App-Hülle (Heute, Suche, Navigation) (de-shell.ts). Teil von `fr`. */
export const frShell = {
  'shell.create': 'Créer',
  'shell.create.task': 'Tâche',
  'shell.create.note': 'Note',
  'shell.create.mail': 'E-mail',
  'shell.create.birthday': 'Anniversaire',

  'search.best': 'Meilleur résultat',
  'search.group.tasks': 'Tâches',
  'search.group.notes': 'Notes',
  'search.group.mail': 'E-mails',
  'search.group.people': 'Personnes',
  'search.group.places': 'Lieux',
  'search.group.entries': 'Autres entrées',
  'search.group.functions': 'Fonctions',
  'search.showAll': 'Voir les {count}',
  'search.recent': 'Recherches récentes',
  'search.otherApps': 'Autres apps Better',
  'search.noSubject': 'Sans objet',
} as const satisfies Partial<Record<TranslationKey, string>>;
