const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { describe, test } = require('node:test');

const { inferAllergens } = require('./allergens.js');
const { foodsFromSheet } = require('./swiss.js');
const { readFirstSheet } = require('./xlsx.js');

/** Ein kleines ZIP, wie Excel es schreibt: Deflate, Verzeichnis am Ende. */
function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = zlib.deflateRawSync(Buffer.from(text, 'utf8'));
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(text), 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(Buffer.byteLength(text), 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const columns = 'ABCDEFGHIJKLMN';
function sheetXml(rows, shared) {
  const cell = (value, reference) => {
    if (value === null) return '';
    if (typeof value === 'number') return `<c r="${reference}"><v>${value}</v></c>`;
    shared.push(value);
    return `<c r="${reference}" t="s"><v>${shared.length - 1}</v></c>`;
  };
  return `<worksheet><sheetData>${rows.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => cell(value, `${columns[column]}${index + 1}`)).join('')}</row>`).join('')}</sheetData></worksheet>`;
}

function workbook(rows) {
  const shared = [];
  const sheet = sheetXml(rows, shared);
  return zip({
    'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Daten" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst>${shared.map((text) => `<si><t>${text.replace(/&/g, '&amp;')}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet1.xml': sheet,
  });
}

const HEADER = ['ID', 'Name', 'Synonyme', 'Kategorie', 'Bezugseinheit', 'Dichte', 'Energie, Kilojoule (kJ)', 'Energie, Kalorien (kcal)', 'Fett, total (g)', 'Kohlenhydrate, verfügbar (g)', 'Zucker (g)', 'Nahrungsfasern (g)', 'Protein (g)', 'Salz (NaCl) (g)'];

describe('Schweizer Naehrwertdatenbank', () => {
  const german = workbook([
    ['Schweizer Nährwertdatenbank V7.1', null, null, null, null, null, null, null, null, null, null, null, null, null],
    [],
    HEADER,
    [100, 'Apfel, roh', 'Apfel', 'Früchte', 'pro 100g essbarer Anteil', null, 218, 52, 0.2, 11.4, 10.3, 2.4, 0.3, 'tr.'],
    [200, 'Vollmilch, UHT', 'Milch', 'Milch & Milchprodukte', 'pro 100 ml', 1.03, 270, 65, 3.5, 4.8, 4.8, 0, 3.3, 0.1],
    [300, 'Spaghetti, gekocht', 'Teigwaren', 'Getreideprodukte', 'pro 100g', null, 600, 150, 0.8, 29.5, '<0.1', 1.6, 5.3, 0],
    [400, 'Kaputter Eintrag', null, 'Diverses', 'pro 100g', null, 9000, 2100, 10, 10, 1, 1, 10, 0],
  ]);
  const french = workbook([
    ['ID', 'Nom', 'Synonymes', 'Catégorie', 'Unité de référence', 'Densité', 'Énergie, kilojoules (kJ)', 'Énergie, calories (kcal)', 'Lipides, totaux (g)', 'Glucides, disponibles (g)', 'Sucres (g)', 'Fibres alimentaires (g)', 'Protéines (g)', 'Sel (NaCl) (g)'],
    [100, 'Pomme, crue', null, 'Fruits', 'par 100g', null, 218, 52, 0.2, 11.4, 10.3, 2.4, 0.3, 0],
  ]);

  test('XLSX lesen: gemeinsame Texte, Zahlen, Leerzeilen', () => {
    const rows = readFirstSheet(german);
    assert.equal(rows[2][1], 'Name');
    assert.equal(rows[3][7], 52);
    assert.equal(rows[3][13], 'tr.');
  });

  test('Spalten ueber Ueberschriften, Spuren als 0, 100 ml ueber die Dichte, Unsinn faellt weg', () => {
    const { foods, skipped } = foodsFromSheet(readFirstSheet(german), { version: '7.1', names: { fr: readFirstSheet(french) } });
    assert.equal(skipped, 1);
    assert.deepEqual(foods.map((food) => food.id), ['swiss:100', 'swiss:200', 'swiss:300']);
    const [apple, milk, pasta] = foods;
    assert.deepEqual(apple.names, { de: 'Apfel, roh', fr: 'Pomme, crue' });
    assert.equal(apple.per100.saltG, 0);
    assert.equal(apple.shopCategory, 'produce');
    assert.equal(apple.sourceVersion, '7.1');
    assert.equal(apple.state, 'raw');
    assert.equal(milk.per100.kcal, 63);
    assert.deepEqual(milk.allergens, ['milk']);
    assert.equal(milk.shopCategory, 'dairy');
    assert.equal(pasta.state, 'cooked');
    assert.equal(pasta.per100.sugarG, 0);
    assert.ok(pasta.allergens.includes('gluten'));
  });

  test('Allergene aus dem Namen: kurze Woerter nur ganz', () => {
    assert.deepEqual(inferAllergens('Reis, gekocht'), []);
    assert.deepEqual(inferAllergens('Rührei'), ['egg']);
    assert.deepEqual(inferAllergens('Kreis, Weise'), []);
    assert.deepEqual(inferAllergens('Ei, gekocht'), ['egg']);
    assert.deepEqual(inferAllergens('Vollkornmehl'), ['gluten']);
    assert.deepEqual(inferAllergens('Crevetten'), ['crustaceans']);
  });
});
