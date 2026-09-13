import type { TranslationKey } from './de';

/** Italienisch: die gemeinsamen Bausteine (de-ui.ts). Teil von `it`. */
export const itUi = {
  'ui.undo': 'Annulla',
  'ui.menu.open': 'Apri il menu',
  'ui.menu.more': 'Altre azioni',
  'ui.sheet.size': 'Dimensione del foglio',
  'ui.sheet.medium': 'Aperto a metà',
  'ui.sheet.large': 'Aperto del tutto',
} as const satisfies Partial<Record<TranslationKey, string>>;
