/**
 * Importiert die offizielle Schweizer Naehrwertdatenbank fuer Better Fit.
 *
 *   node scripts/import-swiss-foods.js <datei-de.xlsx> --version 7.1 [--fr datei.xlsx] [--it datei.xlsx] [--en datei.xlsx]
 *
 * Die Datei laedt der Eigentuemer selbst von https://naehrwertdaten.ch/de/downloads/
 * herunter (kostenlos, kommerzielle Nutzung mit Quellenangabe erlaubt). Das
 * Ergebnis landet in `<datenordner>/fit-catalog-swiss.json` (nicht im Git) und
 * ersetzt beim naechsten Start des Dienstes die Beispielwerte.
 */
const fs = require('node:fs');
const path = require('node:path');

const { dataDir } = require('../services/api/config.js');
const { foodsFromSheet } = require('../services/api/fit/catalog/swiss.js');
const { readFirstSheet } = require('../services/api/fit/catalog/xlsx.js');

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

function main() {
  const file = process.argv[2];
  const version = argument('version');
  if (!file || file.startsWith('--') || !version) {
    process.stderr.write('Aufruf: node scripts/import-swiss-foods.js <datei.xlsx> --version 7.1 [--fr …] [--it …] [--en …]\n');
    process.exit(1);
  }
  const rows = readFirstSheet(fs.readFileSync(file));
  const names = {};
  for (const lang of ['fr', 'it', 'en']) {
    const other = argument(lang);
    if (other) names[lang] = readFirstSheet(fs.readFileSync(other));
  }
  const { foods, skipped } = foodsFromSheet(rows, { version, language: 'de', names });
  if (foods.length === 0) {
    process.stderr.write('Keine Lebensmittel gefunden — ist das die richtige Datei?\n');
    process.exit(1);
  }
  const out = path.join(dataDir(), 'fit-catalog-swiss.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify({
      source: 'Schweizer Nährwertdatenbank, BLV',
      url: 'https://naehrwertdaten.ch',
      version,
      importedAt: new Date().toISOString(),
      file: path.basename(file),
      foods,
    }),
  );
  process.stdout.write(`${foods.length} Lebensmittel importiert (Version ${version}), ${skipped} unplausible Zeilen uebersprungen.\n${out}\nDen Dienst neu starten, damit er sie liest.\n`);
}

main();
