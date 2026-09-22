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
});
