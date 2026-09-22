/**
 * Allergene aus dem Namen ableiten — fuer Quellen, die keine fuehren (die
 * Schweizer Naehrwertdatenbank und USDA). Lieber einmal zu viel: ein Treffer
 * schliesst ein Lebensmittel bei einer Allergie aus, und die App sagt, dass
 * das geschaetzt ist. Deutsch, Franzoesisch, Italienisch, Englisch.
 */
const { normalize } = require('./index.js');

const WORDS = {
  gluten: ['weizen', 'mehl', 'brot', 'teigwaren', 'nudel', 'pasta', 'spaghetti', 'gerste', 'roggen', 'dinkel', 'hafer', 'griess', 'paniert', 'couscous', 'bulgur', 'ble', 'farine', 'pain', 'pates', 'orge', 'seigle', 'grano', 'farina', 'pane', 'orzo', 'wheat', 'flour', 'bread', 'barley', 'rye', 'spelt', 'oat', 'semolina', 'lasagne', 'pizza', 'kuchen', 'guetzli', 'zwieback', 'toast'],
  milk: ['milch', 'kase', 'joghurt', 'jogurt', 'rahm', 'sahne', 'butter', 'quark', 'molke', 'lait', 'fromage', 'yogourt', 'creme', 'beurre', 'latte', 'formaggio', 'panna', 'burro', 'milk', 'cheese', 'yogurt', 'cream', 'whey', 'mozzarella', 'parmesan', 'gruyere', 'feta', 'skyr', 'lasagne'],
  egg: ['ei', 'eier', 'eigelb', 'eiweiss', 'ruhrei', 'spiegelei', 'omelett', 'omelette', 'frittata', 'oeuf', 'oeufs', 'uovo', 'uova', 'egg', 'eggs', 'mayonnaise', 'teigwaren', 'eiernudeln', 'meringue'],
  nuts: ['nuss', 'nusse', 'mandel', 'haselnuss', 'baumnuss', 'walnuss', 'cashew', 'pistazie', 'pekan', 'noix', 'amande', 'noisette', 'noce', 'mandorla', 'nocciola', 'nut', 'nuts', 'almond', 'hazelnut', 'walnut', 'pistachio', 'muesli'],
  peanut: ['erdnuss', 'arachide', 'cacahuete', 'peanut'],
  soy: ['soja', 'tofu', 'soia', 'soy', 'edamame', 'tempeh'],
  fish: ['fisch', 'lachs', 'thon', 'thunfisch', 'forelle', 'kabeljau', 'sardine', 'poisson', 'saumon', 'pesce', 'salmone', 'tonno', 'fish', 'salmon', 'tuna', 'cod', 'anchovy', 'sardella'],
  crustaceans: ['crevette', 'crevetten', 'garnele', 'krebs', 'hummer', 'scampi', 'gambero', 'gamberetti', 'shrimp', 'prawn', 'lobster', 'crab'],
  molluscs: ['muschel', 'tintenfisch', 'calamari', 'moule', 'cozza', 'mussel', 'squid', 'octopus', 'oyster', 'auster'],
  celery: ['sellerie', 'celeri', 'sedano', 'celery', 'bouillon', 'brühe', 'bruhe'],
  mustard: ['senf', 'moutarde', 'senape', 'mustard'],
  sesame: ['sesam', 'sesame', 'sesamo', 'tahin', 'tahini'],
  sulphites: ['wein', 'vin', 'vino', 'wine', 'essig', 'dorrobst', 'trockenfrucht'],
  lupin: ['lupine', 'lupin', 'lupino'],
};

/** Die Allergene zu einem oder mehreren Namen, sortiert. */
function inferAllergens(...names) {
  const words = new Set(names.flatMap((name) => normalize(name).split(' ')));
  const text = names.map(normalize).join(' ');
  const found = Object.entries(WORDS).filter(([, list]) =>
    list.some((word) => {
      const plain = normalize(word);
      // Kurze Woerter nur als ganzes Wort („ei“ nicht in „Reis“), lange auch als Teil („Vollkornmehl“).
      return plain.length <= 3 ? words.has(plain) : text.includes(plain);
    }),
  );
  return found.map(([allergen]) => allergen).sort();
}

module.exports = { inferAllergens };
