import { createContext, useContext } from 'react';

import { de, type TranslationKey, type Translations } from './de';
import { en } from './en';
import { fr } from './fr';
import { it } from './it';

export type Language = 'de' | 'fr' | 'it' | 'en';

export const LANGUAGES: readonly Language[] = ['de', 'fr', 'it', 'en'];

export const LANGUAGE_LABEL: Record<Language, string> = {
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  en: 'English',
};

const CATALOGUE: Record<Language, Translations> = { de, fr, it, en };

/** Damit dieselbe Luecke nicht bei jedem Rendern erneut geloggt wird. */
const reported = new Set<string>();

export type TranslateValues = Record<string, string | number>;

export type Translate = (key: TranslationKey, values?: TranslateValues) => string;

function interpolate(template: string, values?: TranslateValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(
  language: Language,
  key: TranslationKey,
  values?: TranslateValues,
): string {
  const own = CATALOGUE[language][key];
  if (own !== undefined) return interpolate(own, values);

  if (language !== 'de') {
    const marker = `${language}:${key}`;
    if (!reported.has(marker)) {
      reported.add(marker);
      console.warn(`[i18n] Kein Eintrag fuer "${key}" in "${language}" — faellt auf "de" zurueck.`);
    }
  }

  const fallback = de[key];
  if (fallback !== undefined) return interpolate(fallback, values);

  console.warn(`[i18n] Unbekannter Schluessel "${key}".`);
  return key;
}

export type I18nValue = {
  language: Language;
  t: Translate;
};

const I18nContext = createContext<I18nValue>({
  language: 'de',
  t: (key, values) => translate('de', key, values),
});

export const I18nProvider = I18nContext.Provider;

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function useTranslate(): Translate {
  return useI18n().t;
}

export type { TranslationKey, Translations };
export * from './format';
