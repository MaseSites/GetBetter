/**
 * Kleine Dateihelfer fuer Tresor und Abgleich-Zustand: lesen mit Rueckfall,
 * schreiben ueber eine Zwischendatei, damit ein Absturz nichts halb stehen laesst.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Liest eine JSON-Datei. Gibt es sie nicht, kommt der Rueckfall. Ist sie
 * **kaputt** (halb geschrieben, von Hand veraendert), legt sie sich als
 * `<name>.broken` zur Seite und der Rueckfall gilt auch dann: ein
 * unlesbarer Zustand darf nicht jeden weiteren Abgleich zum Scheitern
 * bringen — er baut sich beim naechsten Mal neu auf.
 */
async function readJson(file, fallback) {
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch {
    await fs.rename(file, `${file}.broken`).catch(() => undefined);
    process.stderr.write(
      `[api] ${path.basename(file)} war unlesbar und liegt jetzt als .broken daneben
`,
    );
    return fallback;
  }
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  try {
    await fs.rename(temp, file);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}

/** Haengt Schreibvorgaenge hintereinander, damit keiner den anderen ueberholt. */
function createQueue() {
  let tail = Promise.resolve();
  return (task) => {
    const run = tail.catch(() => {}).then(task);
    tail = run;
    return run;
  };
}

module.exports = { readJson, writeJsonAtomic, createQueue };
