import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * Jede Sprache setzt sich per Spread aus Teilen zusammen (`de-fit.ts`,
 * `de-fit3.ts` …). Steht ein Schluessel in zwei Teilen, gewinnt still der
 * spaetere — der andere Text ist tot und meist die falsche Bedeutung.
 */
const folder = join(process.cwd(), 'packages', 'core', 'src', 'i18n');
const KEY = /^\s*'([^']+)':/gm;

for (const language of ['de', 'en', 'fr', 'it']) {
  test(`${language}: kein Schluessel steht in zwei Teildateien`, () => {
    const files = readdirSync(folder).filter(
      (name) =>
        (name === `${language}.ts` || name.startsWith(`${language}-`)) &&
        name.endsWith('.ts') &&
        !name.endsWith('.test.ts'),
    );
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(folder, file), 'utf8');
      for (const match of source.matchAll(KEY)) {
        const key = match[1] ?? '';
        const first = seen.get(key);
        if (first && first !== file) twice.push(`${key} (${first}, ${file})`);
        else seen.set(key, file);
      }
    }
    assert.deepEqual(twice, []);
  });
}
