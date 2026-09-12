/**
 * Kleine Dateihelfer fuer Tresor und Abgleich-Zustand: lesen mit Rueckfall,
 * schreiben ueber eine Zwischendatei, damit ein Absturz nichts halb stehen laesst.
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
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
