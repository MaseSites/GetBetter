import type { Translate, TranslationKey } from '../i18n';

import { MODULES_BY_ID } from './modules';

/**
 * Name, Kurztext und Beschreibung einer Funktion stehen nicht in der Registry,
 * sondern in der Sprache (`i18n/de-modules.ts`, `module.<id>.<feld>`). Diese
 * drei Helfer bauen den Schluessel; eine unbekannte Id kommt unveraendert zurueck.
 */
type ModuleTextField = 'name' | 'short' | 'description';

/** In BetterFamily steht der Haushalt wie eine Funktion da, ist aber keine der Registry. */
export const HOUSEHOLD_MODULE_ID = 'household';

function moduleText(t: Translate, id: string, field: ModuleTextField): string {
  if (id === HOUSEHOLD_MODULE_ID) return field === 'name' ? t('tabs.household') : '';
  if (!MODULES_BY_ID[id]) return id;
  return t(`module.${id}.${field}` as TranslationKey);
}

export function moduleName(t: Translate, id: string): string {
  return moduleText(t, id, 'name');
}

export function moduleShort(t: Translate, id: string): string {
  return moduleText(t, id, 'short');
}

export function moduleDescription(t: Translate, id: string): string {
  return moduleText(t, id, 'description');
}
