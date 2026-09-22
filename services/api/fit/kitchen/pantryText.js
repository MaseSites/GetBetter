/**
 * Vorrat aus einem Satz: „Ich habe Bananen, Mehl und Eier zu Hause“ oder
 * „6 Eier, 500 g Mehl“ — gesprochen oder getippt, in vier Sprachen.
 *
 * Heraus kommt ein **Vorschlag**, nie eine Aenderung: jede erkannte Zeile mit
 * Lebensmittel, Menge und wie sicher die Zuordnung ist. Gespeichert wird erst,
 * wenn die Person bestaetigt.
 */
const { normalize } = require('../catalog/index.js');
const { nameIn } = require('../lang.js');

const FILLER = [
  'ich habe', 'ich hab', 'wir haben', 'hab', 'noch', 'zu hause', 'zuhause', 'daheim', 'im kuhlschrank', 'im vorrat', 'etwas', 'ein paar', 'einige',
  'i have', 'we have', 'at home', 'some', 'j ai', 'nous avons', 'a la maison', 'un peu de', 'ho', 'abbiamo', 'a casa', 'un po di',
  'des', 'du', 'de la', 'le', 'la', 'les', 'del', 'della', 'dello', 'dei', 'delle', 'degli', 'il', 'lo', 'gli',
];
const SEPARATORS = /\s*(?:,|;|\bund\b|\bsowie\b|\band\b|\bet\b|\be\b|\+|\n)\s*/i;
const NUMBER_WORDS = { ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwolf: 12, halb: 0.5, halbe: 0.5, halben: 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, un: 1, une: 1, deux: 2, trois: 3, demi: 0.5, uno: 1, una: 1, due: 2, tre: 3, mezzo: 0.5, mezza: 0.5 };
/** Einheiten, wie man sie sagt. `pack`: eine Packungsgroesse in Gramm (Dose, Becher, Bund). */
const UNIT_WORDS = {
  g: 'g', gr: 'g', gramm: 'g', grams: 'g', gramme: 'g', grammes: 'g', grammi: 'g', grammo: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg',
  ml: 'ml', cl: 'cl', dl: 'dl', l: 'l', liter: 'l', litre: 'l', litres: 'l', litro: 'l', litri: 'l',
  stuck: 'piece', stk: 'piece', st: 'piece', packung: 'piece', pieces: 'piece', piece: 'piece', pcs: 'piece', pezzi: 'piece', pezzo: 'piece', x: 'piece',
  el: 'tbsp', essloffel: 'tbsp', tbsp: 'tbsp', cs: 'tbsp', cucchiaio: 'tbsp', cucchiai: 'tbsp',
  tl: 'tsp', teeloffel: 'tsp', tsp: 'tsp', cc: 'tsp', cucchiaino: 'tsp', cucchiaini: 'tsp',
  prise: 'pinch', prisen: 'pinch', pinch: 'pinch', pincee: 'pinch', pizzico: 'pinch',
  dose: 'can', dosen: 'can', can: 'can', cans: 'can', boite: 'can', boites: 'can', lattina: 'can', lattine: 'can', scatola: 'can', scatole: 'can',
  becher: 'tub', pot: 'tub', pots: 'tub', vasetto: 'tub', vasetti: 'tub', tub: 'tub',
  bund: 'bunch', bunde: 'bunch', bunch: 'bunch', botte: 'bunch', bottes: 'bunch', mazzo: 'bunch', mazzi: 'bunch',
};
/** Uebliche Packungen: eine Dose Tomaten, ein Becher Joghurt, ein Bund Petersilie. */
const PACK_GRAMS = { can: 400, tub: 180, bunch: 40 };
const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
/** Nach der Einheit: „500 g de farine“, „2 dl di latte“, „1 Dose of beans“. */
const LINKS = new Set(['de', 'd', 'di', 'of']);

/**
 * Zahlen vor `normalize` retten, das Kommas und Punkte verschluckt: „1½“, „1/2“,
 * „1,5“ und „1.5“ werden zu `1q5` — ein Zeichen, das in keinem Wort vorkommt.
 */
function protectNumbers(text) {
  const decimal = (value) => String(Math.round(value * 100) / 100).replace('.', 'q');
  return String(text)
    .replace(/(\d+)?\s*([½¼¾⅓⅔])/g, (_, whole, fraction) => ` ${decimal(Number(whole ?? 0) + FRACTIONS[fraction])} `)
    .replace(/(\d+)\s*\/\s*(\d+)/g, (_, top, bottom) => (Number(bottom) > 0 ? ` ${decimal(Number(top) / Number(bottom))} ` : ` ${top} `))
    .replace(/(\d+)[.,](\d+)/g, (_, whole, part) => `${whole}q${part}`);
}

/** „500 g Mehl“, „500g Mehl“, „6x Eier“, „½ Bund Petersilie“ -> { amount, unit, name }; ohne Zahl bleibt die Menge offen. */
function parsePart(part) {
  let words = normalize(part).split(' ').filter(Boolean);
  // Franzoesisch „l'huile“ wird zu „l huile“ — ohne Zahl davor ist das „l“ ein Artikel, kein Liter.
  if (words[0] === 'l' || (words[0] === 'de' && words[1] === 'l')) words = words.slice(words[0] === 'l' ? 1 : 2);
  let amount = null;
  let unit = null;
  const first = words[0];
  const glued = first === undefined ? null : /^(\d+)(?:q(\d+))?([a-z]*)$/.exec(first);
  if (glued) {
    amount = Number(`${glued[1]}${glued[2] ? `.${glued[2]}` : ''}`);
    words = glued[3] ? [glued[3], ...words.slice(1)] : words.slice(1);
  } else if (first !== undefined && Object.hasOwn(NUMBER_WORDS, first)) {
    amount = NUMBER_WORDS[first];
    words = words.slice(1);
  }
  const unitWord = words[0];
  const spoken = unitWord !== undefined && Object.hasOwn(UNIT_WORDS, unitWord) ? UNIT_WORDS[unitWord] : null;
  // Ohne Zahl nur, was man so sagt: „Dose Tomaten“, „Prise Salz“ — nie „St. Galler Bratwurst“.
  if (spoken && words.length > 1 && (amount !== null || spoken in PACK_GRAMS || spoken === 'pinch')) {
    unit = spoken;
    amount ??= 1;
    words = words.slice(1);
  }
  if (unit !== null && words.length > 1 && LINKS.has(words[0])) words = words.slice(1);
  const name = words.join(' ').trim();
  return name ? { name, amount, unit: unit ?? (amount !== null ? 'piece' : null) } : null;
}

/**
 * Den Satz in Teile schneiden und jedem Teil einen Datensatz zuordnen.
 * `match(term)` wie im Katalog. Gibt `{ lines, unknown }`.
 */
function parsePantryText(text, match, language = 'de') {
  // Erst an Kommas und „und“ trennen — `normalize` wuerde die Kommas verschlucken.
  const parts = protectNumbers(String(text ?? ''))
    .split(SEPARATORS)
    .map((part) => {
      let cleaned = ` ${normalize(part)} `;
      for (const filler of FILLER) cleaned = cleaned.replace(new RegExp(` ${filler} `, 'g'), ' ');
      return parsePart(cleaned.trim());
    })
    .filter(Boolean)
    .slice(0, 30);
  const lines = [];
  const unknown = [];
  for (const part of parts) {
    const found = match(part.name);
    if (!found) {
      unknown.push(part.name);
      continue;
    }
    let { amount, unit } = part;
    if (Object.hasOwn(PACK_GRAMS, unit ?? '')) [amount, unit] = [amount * PACK_GRAMS[unit], 'g'];
    if (unit === 'kg') [amount, unit] = [amount * 1000, 'g'];
    if (unit === 'cl') [amount, unit] = [amount * 10, 'ml'];
    if (unit === 'l') [amount, unit] = [amount * 1000, 'ml'];
    if (unit === 'dl') [amount, unit] = [amount * 100, 'ml'];
    if (unit === 'piece' && !found.food.gramsPerPiece) unit = 'g';
    lines.push({
      said: part.name,
      foodId: found.food.id,
      name: nameIn(found.food, language) || part.name,
      amount,
      unit,
      certain: !found.uncertain,
    });
  }
  return { lines, unknown };
}

module.exports = { parsePantryText };
