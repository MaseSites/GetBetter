/**
 * Der Katalog des Mock-Modus: gaengige Grundnahrungsmittel mit **gerundeten
 * Richtwerten** je 100 g. Das sind ausdruecklich keine Daten der Schweizer
 * Naehrwertdatenbank und keine kopierten Webseitenwerte — die kommen erst mit
 * dem Import der offiziellen Datei (`scripts/import-swiss-foods.js`). Die App
 * zeigt als Quelle „Beispielwerte“.
 *
 * Spalten: id, de, en, fr, it, Abteilung, Zustand, kcal, Protein, KH, Fett,
 * Ballaststoffe, Allergene, Ernaehrungsform, g je Stueck, g je ml, Synonyme.
 * Ernaehrungsform: vg vegan, v vegetarisch, p pescetarisch, o nur omnivor.
 */
const ROWS = [
  ['banana', 'Banane', 'Banana', 'Banane', 'Banana', 'produce', 'raw', 89, 1.1, 20.2, 0.3, 2.6, [], 'vg', 120, null, ['bananen']],
  ['apple', 'Apfel', 'Apple', 'Pomme', 'Mela', 'produce', 'raw', 52, 0.3, 11.4, 0.2, 2.4, [], 'vg', 150, null, ['äpfel']],
  ['lemon', 'Zitrone', 'Lemon', 'Citron', 'Limone', 'produce', 'raw', 29, 1.1, 5.4, 0.3, 2.8, [], 'vg', 100, null, []],
  ['strawberry', 'Erdbeeren', 'Strawberries', 'Fraises', 'Fragole', 'produce', 'raw', 32, 0.7, 5.5, 0.3, 2, [], 'vg', 15, null, ['erdbeere']],
  ['blueberry', 'Heidelbeeren', 'Blueberries', 'Myrtilles', 'Mirtilli', 'produce', 'raw', 57, 0.7, 12, 0.3, 2.4, [], 'vg', null, null, ['blaubeeren']],
  ['avocado', 'Avocado', 'Avocado', 'Avocat', 'Avocado', 'produce', 'raw', 160, 2, 1.9, 14.7, 6.7, [], 'vg', 150, null, []],
  ['broccoli', 'Broccoli', 'Broccoli', 'Brocoli', 'Broccoli', 'produce', 'raw', 34, 2.8, 4, 0.4, 2.6, [], 'vg', 400, null, ['brokkoli']],
  ['broccoli_cooked', 'Broccoli, gekocht', 'Broccoli, cooked', 'Brocoli, cuit', 'Broccoli, cotti', 'produce', 'cooked', 35, 2.4, 4.5, 0.4, 3.3, [], 'vg', null, null, ['brokkoli gekocht']],
  ['carrot', 'Karotte', 'Carrot', 'Carotte', 'Carota', 'produce', 'raw', 36, 0.9, 7, 0.2, 2.8, [], 'vg', 80, null, ['karotten', 'rüebli', 'möhre']],
  ['bell_pepper', 'Peperoni', 'Bell pepper', 'Poivron', 'Peperone', 'produce', 'raw', 31, 1, 5.3, 0.3, 2.1, [], 'vg', 160, null, ['paprika']],
  ['zucchini', 'Zucchetti', 'Zucchini', 'Courgette', 'Zucchina', 'produce', 'raw', 17, 1.2, 2.2, 0.3, 1.1, [], 'vg', 250, null, ['zucchini']],
  ['tomato', 'Tomate', 'Tomato', 'Tomate', 'Pomodoro', 'produce', 'raw', 18, 0.9, 2.6, 0.2, 1.2, [], 'vg', 100, null, ['tomaten']],
  ['onion', 'Zwiebel', 'Onion', 'Oignon', 'Cipolla', 'produce', 'raw', 40, 1.1, 8, 0.1, 1.7, [], 'vg', 100, null, ['zwiebeln']],
  ['garlic', 'Knoblauch', 'Garlic', 'Ail', 'Aglio', 'produce', 'raw', 149, 6.4, 28, 0.5, 2.1, [], 'vg', 5, null, ['knoblauchzehe']],
  ['potato', 'Kartoffel', 'Potato', 'Pomme de terre', 'Patata', 'produce', 'raw', 77, 2, 15.6, 0.1, 2.2, [], 'vg', 150, null, ['kartoffeln', 'härdöpfel']],
  ['sweet_potato', 'Süsskartoffel', 'Sweet potato', 'Patate douce', 'Patata dolce', 'produce', 'raw', 86, 1.6, 17, 0.1, 3, [], 'vg', 250, null, []],
  ['spinach', 'Spinat', 'Spinach', 'Épinards', 'Spinaci', 'produce', 'raw', 23, 2.9, 1.4, 0.4, 2.2, [], 'vg', null, null, []],
  ['mixed_veg_cooked', 'Gemüsemischung, gekocht', 'Mixed vegetables, cooked', 'Légumes mélangés, cuits', 'Verdure miste, cotte', 'produce', 'cooked', 50, 2.5, 7.5, 0.5, 3.5, [], 'vg', null, null, ['gemüse', 'mischgemüse']],
  ['peas', 'Erbsen, tiefgekühlt', 'Peas, frozen', 'Petits pois, surgelés', 'Piselli, surgelati', 'produce', 'raw', 80, 5.4, 10.5, 0.4, 5, [], 'vg', null, null, ['erbsli']],
  ['cucumber', 'Gurke', 'Cucumber', 'Concombre', 'Cetriolo', 'produce', 'raw', 15, 0.6, 2.2, 0.1, 0.5, [], 'vg', 400, null, []],
  ['lettuce', 'Kopfsalat', 'Lettuce', 'Laitue', 'Lattuga', 'produce', 'raw', 15, 1.2, 1.5, 0.2, 1.3, [], 'vg', 300, null, ['salat']],
  ['mushroom', 'Champignons', 'Mushrooms', 'Champignons', 'Funghi', 'produce', 'raw', 22, 3.1, 0.6, 0.3, 1, [], 'vg', 20, null, ['pilze']],
  ['flour', 'Weissmehl', 'Wheat flour', 'Farine blanche', 'Farina bianca', 'pantry', 'raw', 348, 10, 72, 1.2, 3.4, ['gluten'], 'vg', null, 0.55, ['mehl', 'weizenmehl', 'farine', 'farina', 'flour']],
  ['flour_wholewheat', 'Vollkornmehl', 'Whole wheat flour', 'Farine complète', 'Farina integrale', 'pantry', 'raw', 330, 12, 62, 2, 10, ['gluten'], 'vg', null, 0.55, ['ruchmehl']],
  ['sugar', 'Zucker', 'Sugar', 'Sucre', 'Zucchero', 'pantry', 'raw', 400, 0, 100, 0, 0, [], 'vg', null, 0.85, ['kristallzucker']],
  ['baking_powder', 'Backpulver', 'Baking powder', 'Poudre à lever', 'Lievito in polvere', 'pantry', 'raw', 53, 0, 13, 0, 0, [], 'vg', null, null, []],
  ['salt', 'Salz', 'Salt', 'Sel', 'Sale', 'pantry', 'raw', 0, 0, 0, 0, 0, [], 'vg', null, 1.2, []],
  ['rapeseed_oil', 'Rapsöl', 'Rapeseed oil', 'Huile de colza', 'Olio di colza', 'pantry', 'raw', 884, 0, 0, 100, 0, [], 'vg', null, 0.92, ['öl', 'speiseöl']],
  ['olive_oil', 'Olivenöl', 'Olive oil', "Huile d'olive", "Olio d'oliva", 'pantry', 'raw', 884, 0, 0, 100, 0, [], 'vg', null, 0.92, []],
  ['oats', 'Haferflocken', 'Rolled oats', "Flocons d'avoine", "Fiocchi d'avena", 'pantry', 'raw', 372, 13.5, 58.7, 7, 10, ['gluten'], 'vg', null, 0.4, ['hafer']],
  ['muesli', 'Birchermüesli, ungezuckert', 'Muesli, unsweetened', 'Muesli, non sucré', 'Muesli, non zuccherato', 'pantry', 'raw', 360, 10, 60, 7, 9, ['gluten', 'nuts'], 'vg', null, 0.45, ['müesli', 'müsli']],
  ['rice', 'Reis, roh', 'Rice, raw', 'Riz, cru', 'Riso, crudo', 'pantry', 'raw', 356, 7, 78, 0.6, 1.4, [], 'vg', null, 0.85, ['reis']],
  ['rice_cooked', 'Reis, gekocht', 'Rice, cooked', 'Riz, cuit', 'Riso, cotto', 'pantry', 'cooked', 130, 2.7, 28.2, 0.3, 0.4, [], 'vg', null, null, ['gekochter reis']],
  ['pasta', 'Teigwaren, roh', 'Pasta, dry', 'Pâtes, crues', 'Pasta, cruda', 'pantry', 'raw', 358, 12.5, 70, 1.5, 3, ['gluten'], 'vg', null, null, ['pasta', 'spaghetti', 'penne', 'nudeln']],
  ['pasta_cooked', 'Teigwaren, gekocht', 'Pasta, cooked', 'Pâtes, cuites', 'Pasta, cotta', 'pantry', 'cooked', 150, 5.3, 29.5, 0.8, 1.6, ['gluten'], 'vg', null, null, ['pasta gekocht', 'spaghetti gekocht']],
  ['quinoa', 'Quinoa, roh', 'Quinoa, raw', 'Quinoa, cru', 'Quinoa, crudo', 'pantry', 'raw', 370, 14, 64, 6, 7, [], 'vg', null, 0.8, []],
  ['lentils', 'Rote Linsen, roh', 'Red lentils, dry', 'Lentilles corail, crues', 'Lenticchie rosse, crude', 'pantry', 'raw', 330, 24, 50, 1.5, 11, [], 'vg', null, 0.8, ['linsen']],
  ['chickpeas', 'Kichererbsen, Dose, abgetropft', 'Chickpeas, canned, drained', 'Pois chiches, en boîte', 'Ceci, in scatola', 'pantry', 'cooked', 130, 7, 16, 2.5, 6, [], 'vg', null, null, ['kichererbsen']],
  ['passata', 'Tomatensauce (Passata)', 'Tomato sauce (passata)', 'Sauce tomate (passata)', 'Passata di pomodoro', 'pantry', 'prepared', 35, 1.5, 6, 0.3, 1.5, [], 'vg', null, 1.03, ['tomatensauce', 'passata', 'tomatensugo']],
  ['tomato_paste', 'Tomatenpüree', 'Tomato paste', 'Concentré de tomates', 'Concentrato di pomodoro', 'pantry', 'prepared', 90, 4.3, 14, 0.5, 4, [], 'vg', null, null, ['tomatenmark']],
  ['broth', 'Gemüsebouillon, zubereitet', 'Vegetable stock, prepared', 'Bouillon de légumes', 'Brodo vegetale', 'pantry', 'prepared', 5, 0.2, 0.5, 0.2, 0, ['celery'], 'vg', null, 1, ['bouillon', 'brühe']],
  ['coconut_milk', 'Kokosmilch', 'Coconut milk', 'Lait de coco', 'Latte di cocco', 'pantry', 'raw', 200, 2, 3, 20, 0, [], 'vg', null, 1, []],
  ['soy_sauce', 'Sojasauce', 'Soy sauce', 'Sauce soja', 'Salsa di soia', 'pantry', 'prepared', 60, 8, 6, 0, 0, ['soy', 'gluten'], 'vg', null, 1.2, []],
  ['corn', 'Mais, Dose', 'Sweet corn, canned', 'Maïs, en boîte', 'Mais, in scatola', 'pantry', 'cooked', 80, 3, 14, 1.2, 2, [], 'vg', null, null, []],
  ['honey', 'Honig', 'Honey', 'Miel', 'Miele', 'pantry', 'raw', 305, 0.4, 76, 0, 0, [], 'v', null, 1.4, []],
  ['peanut_butter', 'Erdnussbutter', 'Peanut butter', "Beurre d'arachide", "Burro d'arachidi", 'pantry', 'raw', 600, 25, 14, 50, 6, ['peanut'], 'vg', null, null, []],
  ['almonds', 'Mandeln', 'Almonds', 'Amandes', 'Mandorle', 'pantry', 'raw', 610, 21, 8, 52, 12, ['nuts'], 'vg', 1.2, null, []],
  ['dark_chocolate', 'Dunkle Schokolade 70 %', 'Dark chocolate 70%', 'Chocolat noir 70 %', 'Cioccolato fondente 70%', 'pantry', 'raw', 560, 8, 34, 41, 11, [], 'vg', null, null, ['schokolade']],
  ['whey', 'Molkenprotein-Pulver', 'Whey protein powder', 'Protéine de lactosérum', 'Proteine del siero', 'pantry', 'raw', 380, 75, 8, 6, 0, ['milk'], 'v', null, null, ['proteinpulver', 'whey']],
  ['bread', 'Ruchbrot', 'Bread (wheat, dark)', 'Pain mi-blanc', 'Pane semibianco', 'bakery', 'prepared', 240, 8.5, 45, 1.5, 6, ['gluten'], 'vg', 50, null, ['brot']],
  ['toast', 'Toastbrot', 'Toast bread', 'Pain toast', 'Pane in cassetta', 'bakery', 'prepared', 265, 8, 48, 3.5, 3, ['gluten'], 'vg', 25, null, ['toast']],
  ['egg', 'Ei', 'Egg', 'Œuf', 'Uovo', 'dairy', 'raw', 143, 12.6, 0.7, 9.5, 0, ['egg'], 'v', 55, null, ['eier', 'oeufs', 'uova', 'eggs']],
  ['milk', 'Vollmilch', 'Whole milk', 'Lait entier', 'Latte intero', 'dairy', 'raw', 64, 3.3, 4.8, 3.5, 0, ['milk'], 'v', null, 1.03, ['milch', 'lait', 'latte', 'milk']],
  ['soy_drink', 'Sojadrink', 'Soy drink', 'Boisson au soja', 'Bevanda di soia', 'dairy', 'raw', 40, 3.3, 2.5, 1.8, 0.5, ['soy'], 'vg', null, 1.02, ['sojamilch']],
  ['butter', 'Butter', 'Butter', 'Beurre', 'Burro', 'dairy', 'raw', 740, 0.7, 0.6, 82, 0, ['milk'], 'v', null, 0.91, []],
  ['cream', 'Vollrahm', 'Double cream', 'Crème entière', 'Panna intera', 'dairy', 'raw', 340, 2.1, 3, 35, 0, ['milk'], 'v', null, 1, ['rahm', 'sahne']],
  ['yogurt', 'Joghurt nature', 'Plain yogurt', 'Yogourt nature', 'Yogurt al naturale', 'dairy', 'raw', 65, 3.8, 4.7, 3.5, 0, ['milk'], 'v', 180, 1.03, ['jogurt']],
  ['quark', 'Magerquark', 'Low-fat quark', 'Séré maigre', 'Quark magro', 'dairy', 'raw', 70, 12.5, 4, 0.3, 0, ['milk'], 'v', null, null, ['quark']],
  ['skyr', 'Skyr', 'Skyr', 'Skyr', 'Skyr', 'dairy', 'raw', 63, 11, 4, 0.2, 0, ['milk'], 'v', null, null, []],
  ['cottage_cheese', 'Hüttenkäse', 'Cottage cheese', 'Cottage cheese', 'Fiocchi di latte', 'dairy', 'raw', 100, 12, 3, 4.5, 0, ['milk'], 'v', null, null, []],
  ['gruyere', 'Gruyère', 'Gruyère cheese', 'Gruyère', 'Groviera', 'dairy', 'raw', 410, 29, 0, 33, 0, ['milk'], 'v', null, null, ['käse', 'hartkäse']],
  ['mozzarella', 'Mozzarella', 'Mozzarella', 'Mozzarella', 'Mozzarella', 'dairy', 'raw', 250, 18, 1, 19.5, 0, ['milk'], 'v', 125, null, []],
  ['feta', 'Feta', 'Feta', 'Feta', 'Feta', 'dairy', 'raw', 265, 14, 1, 23, 0, ['milk'], 'v', null, null, []],
  ['parmesan', 'Parmesan', 'Parmesan', 'Parmesan', 'Parmigiano', 'dairy', 'raw', 400, 33, 0, 29.5, 0, ['milk'], 'v', null, null, ['parmigiano']],
  ['chicken_breast', 'Pouletbrust, roh', 'Chicken breast, raw', 'Blanc de poulet, cru', 'Petto di pollo, crudo', 'meat', 'raw', 108, 23, 0, 1.5, 0, [], 'o', 150, null, ['poulet', 'hähnchen', 'huhn', 'pouletbrust']],
  ['chicken_breast_cooked', 'Pouletbrust, gebraten', 'Chicken breast, cooked', 'Blanc de poulet, cuit', 'Petto di pollo, cotto', 'meat', 'cooked', 150, 31, 0, 2.5, 0, [], 'o', null, null, ['poulet gebraten', 'gebratenes poulet']],
  ['turkey_breast', 'Trutenbrust, roh', 'Turkey breast, raw', 'Blanc de dinde, cru', 'Petto di tacchino, crudo', 'meat', 'raw', 105, 24, 0, 1, 0, [], 'o', null, null, ['truthahn']],
  ['beef_mince', 'Rindshackfleisch, roh', 'Beef mince, raw', 'Viande hachée de bœuf', 'Carne macinata di manzo', 'meat', 'raw', 215, 18.5, 0, 15.5, 0, [], 'o', null, null, ['hackfleisch', 'gehacktes']],
  ['bacon', 'Speck', 'Bacon', 'Lard', 'Pancetta', 'meat', 'raw', 330, 15, 0.5, 30, 0, [], 'o', null, null, ['bratspeck', 'speckwürfel', 'pancetta']],
  ['ham', 'Schinken, gekocht', 'Ham, cooked', 'Jambon cuit', 'Prosciutto cotto', 'meat', 'prepared', 115, 19, 1, 4, 0, [], 'o', 25, null, ['schinken']],
  ['salmon', 'Lachs, roh', 'Salmon, raw', 'Saumon, cru', 'Salmone, crudo', 'meat', 'raw', 200, 20, 0, 13.5, 0, ['fish'], 'p', 125, null, ['lachs']],
  ['tuna', 'Thon in Wasser, abgetropft', 'Tuna in water, drained', "Thon à l'eau", "Tonno al naturale", 'pantry', 'prepared', 110, 25, 0, 1, 0, ['fish'], 'p', null, null, ['thunfisch', 'thon']],
  ['shrimp', 'Crevetten', 'Shrimp', 'Crevettes', 'Gamberetti', 'meat', 'raw', 80, 18, 0, 1, 0, ['crustaceans'], 'p', null, null, []],
  ['tofu', 'Tofu nature', 'Tofu', 'Tofu nature', 'Tofu al naturale', 'dairy', 'raw', 125, 13, 1.5, 7.5, 1, ['soy'], 'vg', null, null, []],
  ['orange_juice', 'Orangensaft', 'Orange juice', "Jus d'orange", "Succo d'arancia", 'drinks', 'raw', 45, 0.7, 10, 0.2, 0.2, [], 'vg', null, 1.04, ['o-saft']],
  ['coffee', 'Kaffee, schwarz', 'Coffee, black', 'Café noir', 'Caffè nero', 'drinks', 'prepared', 2, 0.1, 0.3, 0, 0, [], 'vg', null, 1, ['kaffee']],
  ['water', 'Wasser', 'Water', 'Eau', 'Acqua', 'drinks', 'raw', 0, 0, 0, 0, 0, [], 'vg', null, 1, []],
  ['lasagne', 'Lasagne Bolognese', 'Lasagne bolognese', 'Lasagne bolognaise', 'Lasagne alla bolognese', 'other', 'prepared', 150, 8, 13, 7, 1, ['gluten', 'milk', 'celery'], 'o', null, null, ['lasagne', 'lasagna']],
];

const DIET = {
  vg: { vegan: true, vegetarian: true, pescetarian: true },
  v: { vegan: false, vegetarian: true, pescetarian: true },
  p: { vegan: false, vegetarian: false, pescetarian: true },
  o: { vegan: false, vegetarian: false, pescetarian: false },
};

const MOCK_FOODS = ROWS.map(
  ([id, de, en, fr, it, shopCategory, state, kcal, proteinG, carbsG, fatG, fiberG, allergens, diet, gramsPerPiece, gramsPerMl, synonyms]) => ({
    id: `mock:${id}`,
    source: 'mock',
    sourceId: id,
    sourceVersion: '2026-09',
    names: { de, en, fr, it },
    synonyms,
    shopCategory,
    state,
    per100: { kcal, proteinG, carbsG, fatG, fiberG },
    allergens,
    diet: DIET[diet],
    gramsPerPiece,
    gramsPerMl,
    quality: 0.5,
  }),
);

/**
 * Lebensmittel, die der Schweizer Datenbank fehlen, ohne die aber Rezepte und
 * ein normaler Vorrat nicht funktionieren. Die 1200 importierten Eintraege des
 * BLV kennen weder Backpulver noch Eiweisspulver noch Sojadrink — gesucht
 * wurde danach trotzdem, und die Suche antwortete mit Unsinn:
 *
 * - „Backpulver“  -> „Kakaogetraenk, gezuckert, Pulver“
 * - „Molkenprotein“ -> gar nichts
 * - „Sojadrink“   -> „Energy Drink mit Koffein, Taurin …“
 *
 * Darum sind genau diese drei auch im Live-Betrieb auffindbar. Sie behalten
 * `source: 'mock'` und damit die ehrliche Herkunft („Beispielwerte, keine
 * offiziellen Daten“) — fallen sie eines Tages im Import an, verschwinden sie
 * hier. Nie die ganze Beispielliste dazunehmen: sie wuerde echte Werte
 * ueberdecken.
 */
const GAP_KEYS = ['baking_powder', 'whey', 'soy_drink'];
const GAP_FOODS = MOCK_FOODS.filter((food) => GAP_KEYS.includes(food.id.replace(/^mock:/, '')));

module.exports = { GAP_FOODS, GAP_KEYS, MOCK_FOODS };
