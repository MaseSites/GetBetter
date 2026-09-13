import type { TranslationKey } from './de';

/** Englisch: die gemeinsamen Bausteine (de-ui.ts). Teil von `en`. */
export const enUi = {
  'ui.undo': 'Undo',
  'ui.menu.open': 'Open menu',
  'ui.menu.more': 'More actions',
  'ui.sheet.size': 'Sheet size',
  'ui.sheet.medium': 'Half open',
  'ui.sheet.large': 'Fully open',
} as const satisfies Partial<Record<TranslationKey, string>>;
