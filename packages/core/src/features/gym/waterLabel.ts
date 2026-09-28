import type { Language, Translate } from '@/i18n';

/**
 * Die Beschriftung eines Trink-Knopfs — ueberall gleich: Startseite, Trinken
 * und Ernaehrung. Hoechstens eine Nachkommastelle, ohne ",0": "2.5 dl", "5 dl".
 */
export function waterAddLabel(t: Translate, language: Language, dl: number): string {
  const amount = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 }).format(dl);
  return t('water.add', { amount });
}
