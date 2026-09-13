import assert from 'node:assert/strict';
import { test } from 'node:test';

import { de } from './de';
import { en } from './en';
import { fr } from './fr';
import { it as italian } from './it';

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');

const catalogues: readonly (readonly [string, Readonly<Record<string, string>>])[] = [
  ['en', en],
  ['fr', fr],
  ['it', italian],
];

for (const [language, catalogue] of catalogues) {
  test(`${language}: jeder deutsche Schluessel ist uebersetzt, keiner zu viel`, () => {
    assert.deepEqual(
      Object.keys(de).filter((key) => catalogue[key] === undefined),
      [],
    );
    assert.deepEqual(
      Object.keys(catalogue).filter((key) => !(key in de)),
      [],
    );
  });

  test(`${language}: Platzhalter wie {name} stehen genauso da wie im Deutschen`, () => {
    const broken = Object.entries(de)
      .filter(([key, german]) => {
        const own = catalogue[key];
        return own !== undefined && placeholders(own) !== placeholders(german);
      })
      .map(([key]) => key);
    assert.deepEqual(broken, []);
  });

  test(`${language}: kein Text ist leer`, () => {
    assert.deepEqual(
      Object.entries(catalogue)
        .filter(([, value]) => value.trim().length === 0)
        .map(([key]) => key),
      [],
    );
  });
}
