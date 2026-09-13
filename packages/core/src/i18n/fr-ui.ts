import type { TranslationKey } from './de';

/** Französisch: die gemeinsamen Bausteine (de-ui.ts). Teil von `fr`. */
export const frUi = {
  'ui.undo': 'Annuler',
  'ui.menu.open': 'Ouvrir le menu',
  'ui.menu.more': 'Plus d’actions',
  'ui.sheet.size': 'Taille de la feuille',
  'ui.sheet.medium': 'À moitié ouverte',
  'ui.sheet.large': 'Entièrement ouverte',
} as const satisfies Partial<Record<TranslationKey, string>>;
