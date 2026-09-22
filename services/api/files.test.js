const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { readJson, writeJsonAtomic } = require('./files.js');

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'better-files-'));
}

test('readJson: gibt es die Datei nicht, kommt der Rueckfall', async () => {
  const dir = await tempDir();
  assert.deepEqual(await readJson(path.join(dir, 'gibt-es-nicht.json'), { a: 1 }), { a: 1 });
  await fs.rm(dir, { recursive: true, force: true });
});

test('readJson: liest, was geschrieben wurde', async () => {
  const dir = await tempDir();
  const file = path.join(dir, 'zustand.json');
  await writeJsonAtomic(file, { acc: { folders: {} } });
  assert.deepEqual(await readJson(file, null), { acc: { folders: {} } });
  await fs.rm(dir, { recursive: true, force: true });
});

test('readJson: eine kaputte Datei blockiert nichts — sie liegt danach als .broken daneben', async () => {
  const dir = await tempDir();
  const file = path.join(dir, 'zustand.json');
  // So sah `mail-state.json` aus, nachdem ein Schreiben halb steckengeblieben war.
  await fs.writeFile(file, '          "uidNext": 42\n  }\n}\n', 'utf8');

  assert.deepEqual(await readJson(file, {}), {});
  assert.equal(await fs.readFile(`${file}.broken`, 'utf8'), '          "uidNext": 42\n  }\n}\n');
  // Danach laesst sich wieder schreiben und lesen.
  await writeJsonAtomic(file, { neu: true });
  assert.deepEqual(await readJson(file, null), { neu: true });
  await fs.rm(dir, { recursive: true, force: true });
});
