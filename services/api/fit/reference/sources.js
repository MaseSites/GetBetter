/**
 * Woher das Referenzwissen kommt und was die Lizenzen verlangen. Die
 * Quellenangabe ist bei allen drei Pflicht (BLV) bzw. erwuenscht (USDA) —
 * sie steht in `reference.json` und in `docs/better-fit.md`.
 */
const SOURCES = [
  {
    id: 'nutrition5k',
    name: 'Nutrition5k',
    attribution: 'Nutrition5k, Google Research (Thames et al., CVPR 2021), https://github.com/google-research-datasets/Nutrition5k',
    license: 'CC BY 4.0',
    use: 'Zutaten-Priors (Gramm je Zutat, nur train) und aehnliche Gerichte',
  },
  {
    id: 'fndds',
    name: 'USDA FNDDS 2021-2023',
    attribution: 'U.S. Department of Agriculture, Agricultural Research Service. Food and Nutrient Database for Dietary Studies 2021-2023.',
    license: 'Public Domain (U.S. Government Work)',
    use: 'Standardportionen je Gericht',
  },
  {
    id: 'menuch',
    name: 'menuCH Portionsgroessen',
    attribution: 'Quelle: BLV, Nationale Ernaehrungserhebung menuCH 2014-15 (Portionsgroessen je Mahlzeit)',
    license: 'Freie Nutzung. Quellenangabe ist Pflicht.',
    use: 'Schweizer Portion je Mahlzeit und Lebensmittelkategorie',
  },
];

module.exports = { SOURCES };
