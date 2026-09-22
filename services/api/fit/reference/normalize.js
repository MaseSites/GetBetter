/**
 * Namen vereinheitlichen, damit „Grilled Chicken Breasts“ und „chicken
 * breast“ derselbe Schluessel werden: klein, ohne Satzzeichen, jedes Wort in
 * der Einzahl. Bewusst einfach und deterministisch — keine Wortliste von
 * aussen, keine Zufallszahl.
 */

/** Woerter, die auf -s enden, aber keine Mehrzahl sind. */
const KEEP_S = new Set([
  'hummus', 'asparagus', 'couscous', 'swiss', 'grass', 'molasses', 'citrus', 'octopus', 'bus',
  'gas', 'jus', 'anis', 'anise', 'series', 'species', 'plus', 'less', 'cress', 'watercress',
  'bass', 'brussels', 'hollandaise', 'lettuce', 'quinoa', 'pancreas', 'fries',
]);

/** Ein Wort in die Einzahl: berries → berry, potatoes → potato, onions → onion. */
function singular(word) {
  if (word.length <= 3 || KEEP_S.has(word)) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(tomato|potato|mango|avocado)es$/.test(word)) return word.slice(0, -2);
  if (/(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Umlaute und Akzente weg, klein, nur Buchstaben, Ziffern und Leerzeichen. */
function fold(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Die Woerter eines Namens, jedes in der Einzahl. */
function tokensOf(text) {
  return fold(text).split(' ').filter(Boolean).map(singular);
}

/** Der Schluessel eines Namens: seine Woerter in der Einzahl, mit Leerzeichen. */
function keyOf(text) {
  return tokensOf(text).join(' ');
}

/**
 * Woerter, die die Zubereitung oder den Schnitt beschreiben. In der Anfrage
 * sind sie freiwillig: „grilled chicken breast“ darf „chicken breast“ finden.
 * Steht so ein Wort im Schluessel selbst („roasted potato“), zaehlt es wie
 * jedes andere und muss in der Anfrage vorkommen.
 */
const STOPWORDS = new Set([
  'cooked', 'grilled', 'fresh', 'sliced', 'diced', 'chopped', 'raw', 'boiled', 'steamed', 'baked', 'fried',
  'pan', 'sauteed', 'saute', 'plain', 'whole', 'cut', 'piece', 'of', 'with', 'and', 'a', 'an', 'the', 'in',
  'organic', 'homemade', 'skinless', 'boneless', 'small', 'large', 'medium', 'hot', 'cold', 'warm',
  'shredded', 'grated', 'mashed', 'roasted', 'toasted', 'minced', 'cubed', 'stir', 'seared', 'poached',
  'braised', 'smoked', 'dried', 'frozen', 'canned', 'uncooked', 'prepared', 'serving', 'portion', 'mixed',
  'baby', 'leaf', 'leave', 'style', 'type', 'fillet', 'filet', 'slice', 'chunk', 'strip', 'wedge',
]);

/** Quantil einer aufsteigend sortierten Liste (lineare Interpolation). */
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const value = sorted[low] + (sorted[high] - sorted[low]) * (position - low);
  return Math.round(value * 10) / 10;
}

module.exports = { singular, fold, tokensOf, keyOf, STOPWORDS, quantile };
