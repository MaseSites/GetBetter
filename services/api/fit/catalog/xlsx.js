/**
 * Eine XLSX-Datei lesen, ohne Fremdbibliothek: sie ist ein ZIP mit XML darin.
 * Gerade genug fuer die Schweizer Naehrwertdatenbank — erstes Blatt, Zellen
 * als Text oder Zahl, gemeinsame Zeichenketten, Inline-Text.
 */
const zlib = require('node:zlib');

/** Alle Dateien eines ZIP als Map Name -> Buffer (nur Speichern und Deflate). */
function unzip(buffer) {
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error('kein ZIP');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('ZIP-Verzeichnis kaputt');
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localName = buffer.readUInt16LE(local + 26);
    const localExtra = buffer.readUInt16LE(local + 28);
    const start = local + 30 + localName + localExtra;
    const data = buffer.subarray(start, start + compressed);
    if (method === 0) files.set(name, Buffer.from(data));
    else if (method === 8) files.set(name, zlib.inflateRawSync(data));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity) => {
    if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
    return ENTITIES[entity] ?? match;
  });
}

/** Der Text eines Elements samt aller <t>-Stuecke (formatierte Zellen haben mehrere). */
const textOf = (xml) => decode([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join(''));

function columnIndex(reference) {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? 'A';
  return [...letters].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0) - 1;
}

/** Das erste Blatt als Zeilen von Zellen (Text oder Zahl oder null). */
function readFirstSheet(buffer) {
  const files = unzip(buffer);
  const workbook = files.get('xl/workbook.xml')?.toString('utf8') ?? '';
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? '';
  const firstId = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const target = firstId ? new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? /Target="([^"]+)"[^>]*Id="${firstId}"/.exec(rels)?.[1] : null;
  const sheetPath = target ? `xl/${target.replace(/^\/?xl\//, '').replace(/^\//, '')}` : 'xl/worksheets/sheet1.xml';
  const sheet = files.get(sheetPath)?.toString('utf8');
  if (!sheet) throw new Error('kein Blatt gefunden');
  const shared = [...(files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1]));

  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
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
    rows.push(Array.from(cells, (value) => (value === undefined ? null : value)));
  }
  return rows;
}

module.exports = { readFirstSheet, unzip };
