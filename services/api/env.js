/**
 * Liest `services/api/.env.local`, falls es die Datei gibt — dort traegt der
 * Eigentuemer seine Schluessel ein (nie ins Git: `.env*.local` ist ignoriert).
 * Was schon in der Umgebung steht, gewinnt.
 *
 * Nur einfache Zeilen `NAME=wert`, `#` fuer Kommentare, Anfuehrungszeichen
 * duerfen um den Wert stehen.
 */
const fs = require('node:fs');
const path = require('node:path');

function parseEnv(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function loadEnvFile(file = path.join(__dirname, '.env.local'), env = process.env) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const loaded = [];
  for (const [name, value] of Object.entries(parseEnv(text))) {
    if (env[name] === undefined) {
      env[name] = value;
      loaded.push(name);
    }
  }
  return loaded;
}

module.exports = { loadEnvFile, parseEnv };
