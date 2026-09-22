/**
 * Bilder einer laufenden Analyse — nur so lange, wie es ein zweites Foto
 * brauchen koennte, hoechstens eine Stunde, ohne Metadaten. Mit
 * ausdruecklicher Zustimmung (und nur mit `STORE_ORIGINAL_MEAL_IMAGES`) bleibt
 * eine Abschrift in `fit-images/` — hoechstens `keptDays` Tage (Standard 30).
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_AGE_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXTENSION = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const ID_PATTERN = /^[a-f0-9]{32}$/;

function createTempImages({ dataDir, now = () => Date.now(), keptDays = 30 }) {
  const tempDir = path.join(dataDir, 'fit-tmp');
  const keepDir = path.join(dataDir, 'fit-images');

  async function save(image) {
    await fs.mkdir(tempDir, { recursive: true });
    const id = crypto.randomBytes(16).toString('hex');
    await fs.writeFile(path.join(tempDir, `${id}.${EXTENSION[image.mime]}`), image.bytes, { mode: 0o600 });
    return { id, mime: image.mime };
  }

  async function load(ref) {
    if (!ID_PATTERN.test(ref?.id ?? '') || !EXTENSION[ref.mime]) return null;
    try {
      return { mime: ref.mime, bytes: await fs.readFile(path.join(tempDir, `${ref.id}.${EXTENSION[ref.mime]}`)) };
    } catch {
      return null;
    }
  }

  async function remove(refs) {
    for (const ref of refs ?? []) {
      if (!ID_PATTERN.test(ref?.id ?? '') || !EXTENSION[ref.mime]) continue;
      await fs.rm(path.join(tempDir, `${ref.id}.${EXTENSION[ref.mime]}`), { force: true });
    }
  }

  /** Nur mit Zustimmung: eine Abschrift ohne Metadaten, dem Konto zugeordnet. */
  async function keep(ownerId, image) {
    await fs.mkdir(keepDir, { recursive: true });
    const id = crypto.randomBytes(16).toString('hex');
    const owner = crypto.createHash('sha256').update(ownerId).digest('hex').slice(0, 16);
    await fs.writeFile(path.join(keepDir, `${owner}-${id}.${EXTENSION[image.mime]}`), image.bytes, { mode: 0o600 });
    return id;
  }

  /** Alle behaltenen Bilder eines Kontos loeschen — beim Loeschen der Daten. */
  async function removeKept(ownerId) {
    const owner = crypto.createHash('sha256').update(ownerId).digest('hex').slice(0, 16);
    let names = [];
    try {
      names = await fs.readdir(keepDir);
    } catch {
      return;
    }
    for (const name of names.filter((entry) => entry.startsWith(`${owner}-`))) await fs.rm(path.join(keepDir, name), { force: true });
  }

  /** Alles in `dir`, was aelter als `maxAgeMs` ist, loeschen. */
  async function dropOlder(dir, maxAgeMs) {
    let names = [];
    try {
      names = await fs.readdir(dir);
    } catch {
      return 0;
    }
    let dropped = 0;
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        const stat = await fs.stat(file);
        if (now() - stat.mtimeMs > maxAgeMs) {
          await fs.rm(file, { force: true });
          dropped += 1;
        }
      } catch {
        // Schon weg.
      }
    }
    return dropped;
  }

  /**
   * Was aelter als eine Stunde ist, faellt weg — auch nach einem Absturz.
   * Behaltene Fotos nach ihrer Aufbewahrungsfrist ebenso.
   */
  async function sweep() {
    const temp = await dropOlder(tempDir, MAX_AGE_MS);
    const kept = await dropOlder(keepDir, keptDays * DAY_MS);
    return { temp, kept };
  }

  return { save, load, remove, keep, removeKept, sweep };
}

module.exports = { createTempImages, MAX_AGE_MS, ID_PATTERN };
