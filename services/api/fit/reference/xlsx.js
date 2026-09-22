/**
 * Alle Blaetter einer XLSX-Datei lesen, ohne Fremdbibliothek. Das Entpacken
 * kommt aus `catalog/xlsx.js`; das Lesen der Zellen ist hier nachgebaut, weil
 * jenes nur das erste Blatt kennt (menuCH hat sechs: DE, FR, EN je mit
 * Beschreibung).
 */
const { unzip } = require('../catalog/xlsx.js');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity) => {
    if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
    return ENTITIES[entity] ?? match;
  });
}

const textOf = (xml) => decode([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join(''));

function columnIndex(reference) {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? 'A';
  return [...letters].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0) - 1;
}

/** Ein Blatt-XML als Zeilen von Zellen (Text, Zahl oder null). */
function parseSheet(sheet, shared) {
  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1];
      const inner = cell[2] ?? '';
      const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1] ?? 'A1';
      const type = /\bt="(\w+)"/.exec(attributes)?.[1] ?? 'n';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = null;
      if (type === 's' && raw !== undefined) value = shared[Number(raw)] ?? null;
      else if (type === 'inlineStr') value = textOf(inner);
      else if (type === 'str' && raw !== undefined) value = decode(raw);
      else if (raw !== undefined && raw !== '') value = Number.isFinite(Number(raw)) ? Number(raw) : decode(raw);
      cells[columnIndex(reference)] = value;
    }
    // Leere Zeilen dazwischen mitzaehlen, damit Zeilennummern stimmen.
    const number = Number(/\br="(\d+)"/.exec(rowMatch[1])?.[1] ?? rows.length + 1);
    while (rows.length < number - 1) rows.push([]);
    rows.push(Array.from(cells, (value) => (value === undefined ? null : value)));
  }
  return rows;
}

/** Alle Blaetter als Liste { name, rows } in der Reihenfolge des Arbeitsbuchs. */
function readSheets(buffer) {
  const files = unzip(buffer);
  const workbook = files.get('xl/workbook.xml')?.toString('utf8') ?? '';
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? '';
  const shared = [...(files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1]));
  const sheets = [];
  for (const match of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const tag = match[0];
    const name = decode(/\bname="([^"]*)"/.exec(tag)?.[1] ?? '');
    const id = /\br:id="([^"]+)"/.exec(tag)?.[1];
    const rel = id ? [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${id}"`)) : null;
    const target = rel ? /Target="([^"]+)"/.exec(rel)?.[1] : null;
    if (!target) continue;
    const path = `xl/${target.replace(/^\/?xl\//, '').replace(/^\//, '')}`;
    const xml = files.get(path)?.toString('utf8');
    if (xml) sheets.push({ name: name.trim(), rows: parseSheet(xml, shared) });
  }
  return sheets;
}

module.exports = { readSheets, parseSheet };
