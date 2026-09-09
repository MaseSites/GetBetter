/**
 * Die Abteilungen im Laden, in der Reihenfolge, in der man durchgeht.
 * Was keiner Abteilung zuzuordnen ist, kommt ans Ende.
 */
export const SHOPPING_CATEGORIES = [
  'produce',
  'bakery',
  'dairy',
  'meat',
  'pantry',
  'drinks',
  'household',
  'other',
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

/** Stichwoerter, an denen man die Abteilung erkennt — Schweizer Kueche. */
const KEYWORDS: Record<Exclude<ShoppingCategory, 'other'>, readonly string[]> = {
  produce: [
    'banane',
    'apfel',
    'äpfel',
    'birne',
    'orange',
    'zitrone',
    'traube',
    'beere',
    'erdbeer',
    'melone',
    'kiwi',
    'mango',
    'avocado',
    'tomate',
    'gurke',
    'salat',
    'zwiebel',
    'knoblauch',
    'kartoffel',
    'karotte',
    'rüebli',
    'peperoni',
    'brokkoli',
    'blumenkohl',
    'zucchetti',
    'spinat',
    'pilz',
    'champignon',
    'lauch',
    'sellerie',
    'obst',
    'gemüse',
    'frücht',
    'kräuter',
    'basilikum',
    'petersilie',
  ],
  bakery: ['brot', 'gipfeli', 'brötchen', 'weggli', 'zopf', 'toast', 'semmel', 'baguette', 'bürli'],
  dairy: [
    'milch',
    'käse',
    'butter',
    'joghurt',
    'jogurt',
    'quark',
    'rahm',
    'sahne',
    'eier',
    ' ei',
    'mozzarella',
    'gruyère',
    'emmentaler',
    'frischkäse',
    'margarine',
  ],
  meat: [
    'fleisch',
    'poulet',
    'huhn',
    'rind',
    'schwein',
    'kalb',
    'wurst',
    'schinken',
    'speck',
    'cervelat',
    'bratwurst',
    'salami',
    'lachs',
    'fisch',
    'crevette',
    'hackfleisch',
    'plätzli',
  ],
  pantry: [
    'pasta',
    'teigwaren',
    'nudel',
    'spaghetti',
    'reis',
    'mehl',
    'zucker',
    'salz',
    'öl',
    'essig',
    'müsli',
    'haferflocken',
    'cornflakes',
    'schoggi',
    'schokolade',
    'chips',
    'konserve',
    'dose',
    'bouillon',
    'sauce',
    'senf',
    'ketchup',
    'mayonnaise',
    'honig',
    'konfitüre',
    'guetzli',
    'biscuit',
    'nüsse',
    'linsen',
    'bohnen',
    'kichererbsen',
    'tofu',
  ],
  drinks: [
    'wasser',
    'mineral',
    'bier',
    'wein',
    'saft',
    'cola',
    'kaffee',
    'tee',
    'rivella',
    'sirup',
    'limonade',
    'prosecco',
    'sekt',
  ],
  household: [
    'wc',
    'toilettenpapier',
    'haushaltpapier',
    'seife',
    'shampoo',
    'duschgel',
    'waschmittel',
    'spülmittel',
    'abwaschmittel',
    'zahnpasta',
    'zahnbürste',
    'abfalls',
    'mülls',
    'kehrichts',
    'putzmittel',
    'schwamm',
    'windeln',
    'deo',
    'rasier',
    'batterie',
    'kerze',
    'alufolie',
    'frischhaltefolie',
    'servietten',
  ],
};

/** Raet die Abteilung aus dem Namen. Was nichts trifft, ist "Anderes". */
export function guessCategory(name: string): ShoppingCategory {
  const haystack = ` ${name.toLowerCase()}`;
  for (const [category, words] of Object.entries(KEYWORDS)) {
    if (words.some((word) => haystack.includes(word))) return category as ShoppingCategory;
  }
  return 'other';
}

export function isShoppingCategory(value: string | undefined): value is ShoppingCategory {
  return (SHOPPING_CATEGORIES as readonly string[]).includes(value ?? '');
}

/**
 * "2 Bananen" → Menge 2, Name Bananen; "500 g Mehl" → Menge "500 g".
 * Ohne Zahl vorne bleibt alles Name.
 */
export function splitQuantity(text: string): { name: string; quantity: string | null } {
  const match = /^(\d+(?:[.,]\d+)?\s*(?:kg|g|l|dl|cl|ml|x|stk\.?|pack|pkg)?)\s+(.+)$/i.exec(
    text.trim(),
  );
  if (!match || !match[1] || !match[2]) return { name: text.trim(), quantity: null };
  return { name: match[2].trim(), quantity: match[1].trim() };
}
