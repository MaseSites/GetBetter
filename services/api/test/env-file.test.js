/**
 * `server.js` muss `.env.local` lesen, bevor irgendein eigenes Modul laedt.
 * Am 24.09.2026 ging die Zeile beim Zusammenfuehren verloren, und Better Fit
 * lief danach unbemerkt im Mock-Modus — mit Beispielwerten statt Gemini.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('server.js laedt .env.local vor allen eigenen Modulen', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const loads = source.indexOf("require('./env.js').loadEnvFile()");
  assert.ok(loads > 0, 'loadEnvFile() fehlt in server.js');
  const firstOwn = source.search(/require\('\.\/(?!env\.js)/);
  assert.ok(firstOwn > loads, 'loadEnvFile() muss vor dem ersten eigenen require stehen');
  assert.match(source.slice(0, loads + 60), /BETTER_SKIP_ENV_FILE !== '1'/);
});
