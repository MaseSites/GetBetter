/**
 * Der Gerichtekatalog: erkennt er, was auf dem Teller liegt, und ergaenzt er
 * genau das, was die Kamera nicht sieht?
 */
const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { DISHES, dishAdditions, dishFits, matchDish, namesDish } = require('./dishes.js');
const { createCatalog } = require('./index.js');

const byId = new Map(DISHES.map((dish) => [dish.id, dish]));
const dish = (id) => {
  const found = byId.get(id);
  assert.ok(found, `Gericht ${id} fehlt`);
  return found;
};

describe('Gerichtekatalog', () => {
  test('genug Gerichte, jede Id einmal, jedes mit vier Sprachen und einem Rezept', () => {
    assert.ok(DISHES.length >= 150, `nur ${DISHES.length} Gerichte`);
    const ids = DISHES.map((entry) => entry.id);
    assert.deepEqual(
      ids.filter((id, index) => ids.indexOf(id) !== index),
      [],
    );
    for (const entry of DISHES) {
      for (const language of ['de', 'fr', 'it', 'en']) {
        assert.ok(entry.names[language], `${entry.id}: ${language} fehlt`);
      }
      assert.ok(entry.recipe.length >= 2, `${entry.id}: Rezept zu kurz`);
      assert.ok(entry.recipe.every((line) => line.grams > 0));
      const { min, typ, max } = entry.portion;
      assert.ok(min < typ && typ < max, `${entry.id}: Portionsspanne verkehrt`);
      // Das Rezept beschreibt genau eine uebliche Portion.
      assert.ok(
        entry.recipeGrams >= min * 0.5 && entry.recipeGrams <= max * 1.5,
        `${entry.id}: Rezept ${entry.recipeGrams} g passt nicht zu ${min}–${max} g`,
      );
    }
  });

  test('die Schweizer Klassiker sind dabei, in vier Sprachen gesucht', () => {
    for (const id of [
      'roesti',
      'aelplermagronen',
      'zuercher_geschnetzeltes',
      'birchermueesli',
      'kaesefondue',
      'raclette',
      'kaeseschnitte',
      'cervelat_kartoffelsalat',
      'hoernli_ghacktem',
      'fruechtewaehe',
      'zopf',
      'gipfeli',
      'spaetzli',
    ]) {
      assert.ok(byId.has(id), id);
    }
    assert.equal(matchDish('Älplermagronen').dish.id, 'aelplermagronen');
    assert.equal(matchDish('Macaronis de l’alpage').dish.id, 'aelplermagronen');
    assert.equal(matchDish('Fonduta di formaggio').dish.id, 'kaesefondue');
    assert.equal(matchDish('Bircher muesli').dish.id, 'birchermueesli');
    assert.equal(matchDish('Poke bowl').dish.id, 'poke_bowl');
    assert.equal(matchDish('Spaghetti alla carbonara').dish.id, 'spaghetti_carbonara');
  });

  test('ein Name, der das Gericht nur nebenbei nennt, zaehlt nicht', () => {
    assert.equal(matchDish('Pizza Margherita').dish.id, 'pizza_margherita');
    assert.equal(matchDish('Salat mit Pizza und Poulet'), null);
    assert.equal(matchDish('Unbekanntes Curry'), null);
    assert.equal(matchDish('Joghurt nature'), null);
    assert.equal(matchDish(''), null);
  });

  test('das Standardrezept ergaenzt nur, was man nicht sieht', () => {
    const magronen = dish('aelplermagronen');
    const hidden = magronen.recipe.filter((line) => line.hidden).map((line) => line.term);
    assert.deepEqual(hidden, ['Rahm', 'Gruyère', 'Butter']);
    // Teigwaren und Kartoffeln sieht die Kamera — die kommen nie dazu.
    assert.deepEqual(
      magronen.recipe.filter((line) => !line.hidden).map((line) => line.term),
      ['Teigwaren', 'Kartoffel', 'Zwiebel'],
    );
  });

  test('beim Fondue ist der Kaese das Gericht, nicht sein Geheimnis', () => {
    assert.deepEqual(dish('kaesefondue').recipe.filter((line) => line.hidden), []);
    assert.deepEqual(dish('raclette').recipe.filter((line) => line.hidden), []);
  });

  test('ergaenzt wird auf die geschaetzte Menge, gedeckelt und ohne Doppeltes', () => {
    const magronen = dish('aelplermagronen');
    const small = dishAdditions(magronen, [], 300);
    const large = dishAdditions(magronen, [], 600);
    assert.ok(large[0].grams > small[0].grams, 'mehr Teller, mehr Rahm');
    assert.ok(large.length <= 3);
    assert.ok(
      large.reduce((sum, line) => sum + line.grams, 0) <= 600 * 0.25,
      'nie mehr als ein Viertel der Mahlzeit',
    );
    // Was schon sichtbar ist, kommt nicht nochmals dazu.
    assert.equal(
      dishAdditions(magronen, ['Rahm'], 400).some((line) => line.term === 'Rahm'),
      false,
    );
  });

  test('zu klein geschaetzt heisst nicht zu wenig Fett: unter der Mindestportion wird nicht gerechnet', () => {
    const magronen = dish('aelplermagronen');
    assert.deepEqual(dishAdditions(magronen, [], 50), dishAdditions(magronen, [], 300));
  });

  test('passen die erkannten Bestandteile nicht zum Rezept, bleibt es dabei', () => {
    const bolognese = dish('spaghetti_bolognese');
    assert.equal(dishFits(bolognese, ['Spaghetti', 'Tomatensauce', 'Hackfleisch']), true);
    assert.equal(dishFits(bolognese, ['Glace', 'Erdbeeren', 'Waffel']), false);
    // Ein einziger Posten ist das Gericht selbst.
    assert.equal(dishFits(bolognese, ['Spaghetti Bolognese']), true);
  });

  test('kennt der Katalog das Gericht als Ganzes, steckt das Fett schon drin', () => {
    assert.equal(namesDish(dish('lasagne'), 'Lasagne Bolognese'), true);
    assert.equal(namesDish(dish('lasagne'), 'Teigwaren ohne Ei, gekocht'), false);
  });

  test('die Zutaten der Klassiker findet der Katalog wirklich', () => {
    const catalog = createCatalog({ dataDir: 'kein-ordner', mode: 'mock' });
    for (const id of ['aelplermagronen', 'roesti', 'spaghetti_carbonara', 'hoernli_ghacktem']) {
      for (const line of dish(id).recipe.filter((entry) => entry.hidden)) {
        const found = catalog.match(line.term);
        assert.ok(found && !found.uncertain, `${id}: „${line.term}“ ohne Datensatz`);
      }
    }
  });
});
