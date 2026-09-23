const assert = require('node:assert/strict');
const os = require('node:os');
const { describe, test } = require('node:test');

const { createCatalog, normalize, stateOf } = require('./index.js');

const catalog = createCatalog({ dataDir: os.tmpdir() + '/fit-catalog-none', mode: 'mock' });

describe('Katalog', () => {
  test('normalisiert Umlaute, Akzente und ß', () => {
    assert.equal(normalize('Süsskartoffel'), 'susskartoffel');
    assert.equal(normalize('Straße, Crème'), 'strasse creme');
  });

  test('erkennt roh und gekocht in vier Sprachen', () => {
    assert.equal(stateOf('Reis gekocht'), 'cooked');
    assert.equal(stateOf('riz cuit'), 'cooked');
    assert.equal(stateOf('pasta cruda'), 'raw');
    assert.equal(stateOf('Reis'), null);
  });

  test('Synonyme und Mehrzahl finden den Datensatz', () => {
    assert.equal(catalog.match('Bananen').food.id, 'mock:banana');
    assert.equal(catalog.match('Poulet').food.id, 'mock:chicken_breast');
    assert.equal(catalog.match('Rüebli').food.id, 'mock:carrot');
  });

  test('gekocht waehlt den gekochten Datensatz, nicht still den rohen', () => {
    assert.equal(catalog.match('Reis', { preparation: 'gekocht' }).food.id, 'mock:rice_cooked');
    assert.equal(
      catalog.match('Spaghetti', { preparation: 'gekocht' }).food.id,
      'mock:pasta_cooked',
    );
    const raw = catalog.match('Reis', { preparation: 'roh' });
    assert.equal(raw.food.id, 'mock:rice');
  });

  test('was die Person frueher bestaetigt hat, gewinnt', () => {
    const plain = catalog.match('Brot');
    assert.equal(plain.food.id, 'mock:bread');
    const remembered = catalog.match('Brot', { history: { brot: 'mock:toast' } });
    assert.equal(remembered.food.id, 'mock:toast');
  });

  test('Unbekanntes bleibt leer statt geraten', () => {
    assert.equal(catalog.match('Xylophon'), null);
  });
});

describe('Katalog mit Namen der Schweizer Naehrwertdatenbank', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-catalog-swiss-'));
  const per100 = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 3 };
  const food = (id, de, state = null) => ({
    id: `swiss:${id}`,
    source: 'swiss',
    names: { de },
    synonyms: [],
    state,
    per100,
  });
  fs.writeFileSync(
    path.join(dir, 'fit-catalog-swiss.json'),
    JSON.stringify({
      version: '7.1',
      foods: [
        food(
          1,
          'Teigwaren, frisch, gefüllt mit Fleisch, gekocht (ohne Zugabe von Fett und Salz)',
          'cooked',
        ),
        food(2, 'Teigwaren ohne Ei, gekocht im Salzwasser (unjodiert)', 'cooked'),
        food(3, 'Teigwaren mit Ei, gekocht im Salzwasser (unjodiert)', 'cooked'),
        food(4, 'Banane, gedörrt'),
        food(5, 'Banane, roh', 'raw'),
        food(6, 'Rucola, roh', 'raw'),
        food(7, 'Pizza mit Mascarpone und Rucola, gebacken', 'cooked'),
        food(8, 'Bolognaisesauce'),
        food(9, 'Rind, Gehacktes, gebraten (ohne Zusatz von Fett und Salz)', 'cooked'),
        food(10, 'Sojasauce'),
        food(11, 'Kochspeck'),
        {
          ...food(12, 'Crêpes mit Speck, zubereitet', 'cooked'),
          category: 'Gerichte/Sonstige salzige/rezente Gerichte',
        },
        food(13, 'Zuckermelone (Honigmelone), roh', 'raw'),
        food(14, 'Wurst, vegan, aus Seitan oder Weizeneiweiss'),
        food(15, 'Kalbsbratwurst'),
        { ...food(16, 'Fleischlasagne, zubereitet', 'cooked'), category: 'Gerichte/Kuchen und Gratins' },
      ],
    }),
  );
  const swiss = createCatalog({ dataDir: dir, mode: 'live' });

  test('lange amtliche Namen werden nicht abgewertet, die Grundform gewinnt', () => {
    const pasta = swiss.match('Spaghetti (gekocht)', { preparation: 'gekocht' });
    assert.equal(pasta.food.id, 'swiss:2');
    assert.equal(pasta.uncertain, false);
    assert.equal(swiss.match('Banane').food.id, 'swiss:5');
  });

  test('Alternativen, Klammern und Alltagswoerter', () => {
    assert.equal(swiss.match('Blattsalat / Rucola', { preparation: 'roh' }).food.id, 'swiss:6');
    assert.equal(swiss.match('Bolognese-Sauce (Hackfleisch-Tomatensauce)').food.id, 'swiss:8');
    assert.equal(swiss.match('Hackfleisch', { preparation: 'gebraten' }).food.id, 'swiss:9');
  });

  // Der Datenbank-Pruefstand (`scripts/fit-db-benchmark.js`) hat diese Regel
  // verdient: sie senkte den kcal-Fehler ueber 400 Gerichte von 16.7 % auf
  // 14.7 % und liess keinen Posten mehr ohne Treffer (vorher 33).
  test('ist der Katalog genauer als die Frage, zaehlt das Wortende', () => {
    // Vorher fand „Melone“ die Zuckermelone gar nicht und „Speck“ den Kochspeck
    // nicht: im Deutschen steht das Hauptwort hinten, geprueft wurde aber nur
    // der umgekehrte Fall.
    assert.equal(swiss.match('Melone', { preparation: 'roh' }).food.id, 'swiss:13');
    const speck = swiss.search('Speck').map((hit) => hit.food.id);
    assert.ok(speck.includes('swiss:11'));
    // Offen: ein Gericht, das die Zutat bloss enthaelt („Crêpes mit Speck“),
    // kann sie weiterhin ueberholen. Der Versuch, das ueber das erste Wort zu
    // kappen, verschlechterte den Pruefstand deutlich (14.7 % -> 22.0 %) und
    // ist darum bewusst nicht drin.
  });

  // Auch diese Regel hat der Pruefstand verdient: 13.5 % -> 13.3 % ueber 4728 Teller.
  test('wer eine Zutat nennt, meint nicht das Gericht darin', () => {
    // „Crêpes mit Speck“ (Kategorie „Gerichte/…“) nennt ausser Speck noch Crêpes.
    assert.equal(swiss.match('Speck').food.id, 'swiss:11');
    // Ein Gericht, das nur sich selbst nennt, bleibt unangetastet.
    assert.equal(swiss.match('Lasagne').food.id, 'swiss:16');
  });

  test('ein Ersatzprodukt gilt nur, wenn danach gefragt wird', () => {
    assert.equal(swiss.match('Wurst').food.id, 'swiss:15');
    assert.equal(swiss.match('Wurst vegan').food.id, 'swiss:14');
  });
});

// Gefunden beim Durchspielen: In der Live-Datenbank waren die Beispielwerte
// gar nicht durchsuchbar. „Backpulver“ fand „Kakaogetraenk, gezuckert, Pulver“,
// „Sojadrink“ einen „Energy Drink mit Koffein, Taurin“, „Molkenprotein“ nichts.
// Drei Zutaten der Rezeptbibliothek liessen sich so nie in den Vorrat legen.
describe('Was der Schweizer Datenbank fehlt', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-gap-'));
  const per100 = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 3 };
  const swissFood = (id, de) => ({
    id: `swiss:${id}`,
    source: 'swiss',
    names: { de },
    synonyms: [],
    state: null,
    per100,
  });
  fs.writeFileSync(
    path.join(dir, 'fit-catalog-swiss.json'),
    JSON.stringify({
      version: '7.1',
      foods: [
        swissFood(100, 'Kakaogetränk, gezuckert, Pulver'),
        swissFood(101, 'Energy Drink mit Koffein, Taurin und Vitaminen'),
        swissFood(102, 'Milch (Durchschnitt)'),
      ],
    }),
  );
  const live = createCatalog({ dataDir: dir, mode: 'live' });

  test('Backpulver, Molkenprotein und Sojadrink sind auffindbar', () => {
    assert.equal(live.match('Backpulver').food.id, 'mock:baking_powder');
    assert.equal(live.match('Molkenprotein').food.id, 'mock:whey');
    assert.equal(live.match('Proteinpulver').food.id, 'mock:whey');
    assert.equal(live.match('Sojadrink').food.id, 'mock:soy_drink');
  });

  test('sie verdraengen aber nichts aus der amtlichen Datenbank', () => {
    assert.equal(live.match('Milch').food.source, 'swiss');
    // Und es kommen nur diese drei dazu, nicht die ganze Beispielliste.
    assert.equal(live.info().foods, 6);
  });
});
