/**
 * Sprache der Inhalte (Lebensmittel, Rezepte, Uebungen). Die App schickt
 * `Accept-Language` mit der Sprache des Kontos; der Server reicht sie jedem
 * Routen-Handler als `language` weiter. Unbekanntes wird Deutsch.
 */
const LANGUAGES = ['de', 'fr', 'it', 'en'];

/** `fr`, `fr-CH`, `fr-CH,de;q=0.8` → `fr`; sonst `de`. */
function languageOf(header) {
  if (typeof header !== 'string') return 'de';
  const first = header.split(',')[0]?.trim().slice(0, 2).toLowerCase() ?? '';
  return LANGUAGES.includes(first) ? first : 'de';
}

/**
 * Ein Text in mehreren Sprachen (`{ de, fr, it, en }`) oder ein schlichter
 * String: die gewuenschte Sprache, sonst Deutsch, sonst die erste vorhandene.
 */
function pick(text, language) {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  return text[language] ?? text.de ?? Object.values(text).find((value) => typeof value === 'string') ?? '';
}

/** Der Name eines Lebensmittels aus dem Katalog (`names: { de, fr, it, en? }`). */
function nameIn(food, language) {
  if (!food) return '';
  if (food.names) return pick(food.names, language) || food.name || '';
  return food.name ?? '';
}

module.exports = { LANGUAGES, languageOf, pick, nameIn };
