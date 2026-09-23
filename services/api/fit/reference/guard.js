/**
 * Der Portionspruefer: das Referenzwissen (menuCH) haelt die geschaetzten
 * Gramm in dem Bereich, in dem eine Schweizer Portion wirklich liegt.
 *
 * Warum ueberhaupt: Bildmodelle schaetzen Mengen **systematisch zu tief**, und
 * zwar staerker, je groesser die Portion ist (gemessene Verzerrung −31 % im
 * eigenen Benchmark vom 22.09.2026). Gelegentlich kippt es auch andersherum —
 * ein Reiskorn-Teller wird zu 900 g. Beides sind Ausreisser, und nur die
 * fasst dieser Pruefer an.
 *
 * Wie: `menuch` (Bundesamt fuer Lebensmittelsicherheit, die Schweizer
 * Ernaehrungserhebung) kennt je Kategorie und Mahlzeit die Median-Portion.
 * Liegt ein Posten weiter als das Vierzigstel bzw. das Zweieinhalbfache davon
 * weg, wird er auf diese Grenze gezogen — nie in die Mitte. Was dazwischen
 * liegt, bleibt Wort fuer Wort, wie das Modell es sah: der Pruefer ersetzt
 * keine Schaetzung, er kappt nur das Unmoegliche.
 *
 * Nicht angefasst werden Posten aus dem Standardrezept (`from: 'dish'`) und
 * ergaenztes Fett (`added`) — die rechnet der Dienst selbst, dort gibt es
 * nichts zu pruefen.
 *
 * Nutrition5k-Prioren bleiben bewusst aussen vor: dort ist jede Zutat eine
 * Kellenladung aus einer Kantine (Median Reis 17 g), keine Tellerportion.
 */

/** Unter diesem Anteil des Medians ist keine Portion mehr plausibel. */
const LOW = 0.4;
/** Ueber diesem Vielfachen des Medians auch nicht. */
const HIGH = 2.5;
/** Unter so vielen Nennungen in menuCH ist der Median zu duenn zum Kappen. */
const MIN_N = 20;

const scale = (value, factor, fallback) =>
  Math.max(1, Math.round((Number.isFinite(value) ? value : fallback) * factor));

/**
 * Der Hinweis zu einem Posten: erst der angezeigte Name (deutsch), dann der
 * Schweizer Begriff, zuletzt der englische Suchbegriff.
 */
function hintFor(reference, slot, item) {
  for (const term of [item.term, item.swissSearchTerm, item.searchTerm]) {
    const hint = term ? reference.portionHint(slot, term) : null;
    if (hint) return hint;
  }
  return null;
}

/**
 * Prueft jeden Posten gegen menuCH. Gibt dieselbe Liste zurueck, jeder Posten
 * um `reference` ergaenzt: `{ category, median, slot, n, source, applied }`,
 * wobei `applied` `'raised'`, `'lowered'` oder `null` ist.
 */
function applyReference(items, { reference, slot = 'lunch' } = {}) {
  if (!reference || !Array.isArray(items) || items.length === 0) return items;
  return items.map((item) => {
    if (item.added || item.from === 'dish' || !(item.grams > 0)) return item;
    const hint = hintFor(reference, slot, item);
    if (!hint || !(hint.median > 0) || hint.n < MIN_N) return item;

    const floor = hint.median * LOW;
    const ceiling = hint.median * HIGH;
    const target = item.grams < floor ? floor : item.grams > ceiling ? ceiling : item.grams;
    const found = {
      category: hint.category,
      median: hint.median,
      slot: hint.slot,
      n: hint.n,
      source: hint.source,
      applied: target === item.grams ? null : target > item.grams ? 'raised' : 'lowered',
    };
    if (found.applied === null) return { ...item, reference: found };

    // Die Spanne wandert mit: sie sagt weiter, wie sicher sich das Modell war.
    const factor = target / item.grams;
    return {
      ...item,
      grams: Math.round(target),
      minGrams: scale(item.minGrams, factor, item.grams),
      maxGrams: scale(item.maxGrams, factor, item.grams),
      reference: found,
    };
  });
}

module.exports = { applyReference, HIGH, LOW, MIN_N };
