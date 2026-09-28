/**
 * Wofuer eine Ausgabe war — geraten aus Notiz oder Satz. Dieselben Regeln fuer
 * den Assistenten („20 Franken fuer Pizza“) und das Ausgaben-Blatt („Migros“).
 * Die erste passende Regel gewinnt; ohne Treffer `null`, dann bleibt die Wahl.
 */

/** Die Kategorien, die es als Vorschlag gibt. Frei getippte bleiben erlaubt. */
export const EXPENSE_CATEGORIES = ['food', 'home', 'transport', 'fun', 'health', 'other'] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Ein Wort oder eine Wendung, an Wortgrenzen — auch vor und nach Umlauten. */
const words = (pattern: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'iu');

/**
 * Die Reihenfolge ist Absicht und war schon im Assistenten so: Essen vor
 * Unterwegs („Kaffee im Zug“ ist Essen), Unterwegs vor Wohnen.
 */
const RULES: readonly (readonly [RegExp, ExpenseCategory])[] = [
  [
    words(
      'essen|znacht|zmittag|zmorge|migros|coop|lidl|aldi|denner|restaurant|kaffee|lebensmittel|bäcker|baecker|pizza|food' +
        '|volg|spar|aldi suisse|coop pronto|migrolino|k kiosk|kiosk|bäckerei|baeckerei|metzgerei|takeaway|take away' +
        '|mcdonald|mcdonalds|burger king|starbucks|subway|too good to go|eat\\.ch|just eat|uber eats|smood|dominos?',
    ),
    'food',
  ],
  [
    words(
      'zug|sbb|bus|tram|benzin|tanken|taxi|parkieren|parking|velo|ticket|ga|halbtax' +
        '|zvv|bls|postauto|libero|tnw|ostwind|mobility|uber|bolt|publibike|tankstelle|diesel|vignette|parkhaus|easyride',
    ),
    'transport',
  ],
  [
    words(
      'miete|möbel|moebel|ikea|strom|haushalt|putzmittel' +
        '|swisscom|salt|sunrise|wingo|yallo|quickline|serafe|ewz|bkw|internet|handyabo|nebenkosten' +
        '|galaxus|digitec|jumbo|hornbach|bauhaus|landi|do it|interdiscount|mediamarkt|media markt|brack',
    ),
    'home',
  ],
  [
    words(
      'kino|konzert|ausgang|bar|spiel|games?|ferien|ausflug' +
        '|netflix|spotify|disney\\+?|apple music|youtube premium|dazn|blue sport|teleclub|zattoo|steam|playstation|nintendo|xbox' +
        '|ticketcorner|starticket|pathé|pathe|museum|fitnesscenter|hallenbad',
    ),
    'fun',
  ],
  [
    words(
      'apotheke|arzt|medikamente?|zahnarzt|brille|physio' +
        '|krankenkasse|helsana|css|swica|sanitas|concordia|visana|kpt|groupe mutuel|assura|atupri|sympany|ökk|oekk' +
        '|amavita|sunstore|drogerie|dropa|spital|fielmann|optiker|franchise',
    ),
    'health',
  ],
];

/** Die Kategorie zu einem Text — oder `null`, wenn keine Regel passt. */
export function guessExpenseCategory(text: string): ExpenseCategory | null {
  const lower = text.toLocaleLowerCase('de').replace(/ß/gu, 'ss');
  return RULES.find(([pattern]) => pattern.test(lower))?.[1] ?? null;
}
