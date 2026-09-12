import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  availableModules,
  builtModulesOf,
  cleanFavorites,
  favoriteKey,
  hasFavorite,
  parseFavoriteKey,
  reachableApps,
  resolveFavorites,
  toggleFavorite,
  type ModuleCatalog,
} from './favorites';

type TestModule = { id: string; name: string };

const catalog: ModuleCatalog<TestModule> = {
  appIds: ['getbetter', 'betterfamily', 'bettergym', 'bettermoney'],
  appModules: {
    getbetter: ['calendar', 'tasks', 'draft'],
    betterfamily: ['calendar', 'shopping'],
    bettergym: ['fitness'],
    bettermoney: ['later'],
  },
  builtIds: ['calendar', 'tasks', 'shopping', 'fitness'],
  modules: [
    { id: 'calendar', name: 'Kalender' },
    { id: 'tasks', name: 'Aufgaben' },
    { id: 'draft', name: 'Entwurf' },
    { id: 'shopping', name: 'Einkaufsliste' },
    { id: 'fitness', name: 'Training' },
    { id: 'later', name: 'Später' },
  ],
};

test('baut und liest den Schluessel appId:moduleId', () => {
  assert.equal(favoriteKey('betterfamily', 'shopping'), 'betterfamily:shopping');
  assert.deepEqual(parseFavoriteKey('betterfamily:shopping'), {
    appId: 'betterfamily',
    moduleId: 'shopping',
  });
});

test('verwirft Schluessel ohne App, ohne Modul oder mit zu vielen Teilen', () => {
  assert.equal(parseFavoriteKey('shopping'), null);
  assert.equal(parseFavoriteKey(':shopping'), null);
  assert.equal(parseFavoriteKey('betterfamily:'), null);
  assert.equal(parseFavoriteKey('a:b:c'), null);
});

test('raeumt Doppelte und kaputte Eintraege weg, die Reihenfolge bleibt', () => {
  assert.deepEqual(
    cleanFavorites(['getbetter:tasks', 'kaputt', 'bettergym:fitness', 'getbetter:tasks']),
    ['getbetter:tasks', 'bettergym:fitness'],
  );
});

test('haengt einen neuen Favoriten hinten an', () => {
  const keys = Object.freeze(['getbetter:tasks']);
  assert.deepEqual(toggleFavorite(keys, 'betterfamily:shopping'), [
    'getbetter:tasks',
    'betterfamily:shopping',
  ]);
});

test('entfernt einen vorhandenen Favoriten, ohne die Liste zu veraendern', () => {
  const keys = Object.freeze(['getbetter:tasks', 'betterfamily:shopping']);
  const next = toggleFavorite(keys, 'getbetter:tasks');
  assert.deepEqual(next, ['betterfamily:shopping']);
  assert.deepEqual(keys, ['getbetter:tasks', 'betterfamily:shopping']);
  assert.notEqual(next, keys);
});

test('nimmt keinen kaputten Schluessel auf', () => {
  assert.deepEqual(toggleFavorite(['getbetter:tasks'], 'tasks'), ['getbetter:tasks']);
});

test('derselbe Kalender ist in zwei Apps ein eigener Favorit', () => {
  const keys = toggleFavorite(['getbetter:calendar'], 'betterfamily:calendar');
  assert.equal(hasFavorite(keys, 'getbetter:calendar'), true);
  assert.equal(hasFavorite(keys, 'betterfamily:calendar'), true);
});

test('die laufende App kommt zuerst, dann die freigeschalteten in fester Reihenfolge', () => {
  assert.deepEqual(reachableApps(catalog.appIds, 'bettergym', ['bettermoney', 'getbetter']), [
    'bettergym',
    'getbetter',
    'bettermoney',
  ]);
});

test('die laufende App zaehlt auch ohne Eintrag, eine unbekannte nicht', () => {
  assert.deepEqual(reachableApps(catalog.appIds, 'getbetter', []), ['getbetter']);
  assert.deepEqual(reachableApps(catalog.appIds, 'unbekannt', ['bettergym']), ['bettergym']);
});

test('bietet nur gebaute Module an, in der Reihenfolge der App', () => {
  assert.deepEqual(
    builtModulesOf(catalog, 'getbetter').map((module) => module.id),
    ['calendar', 'tasks'],
  );
  assert.deepEqual(builtModulesOf(catalog, 'nirgends'), []);
});

test('verfuegbar sind diese App und die freigeschalteten, Apps ohne Gebautes fallen weg', () => {
  const groups = availableModules(catalog, 'getbetter', ['bettermoney', 'betterfamily']);
  assert.deepEqual(
    groups.map((group) => [group.appId, group.modules.map((module) => module.id)]),
    [
      ['getbetter', ['calendar', 'tasks']],
      ['betterfamily', ['calendar', 'shopping']],
    ],
  );
});

test('macht aus den Schluesseln Karten und laesst weg, was es nicht gibt', () => {
  const entries = resolveFavorites(
    [
      'betterfamily:shopping',
      'getbetter:draft',
      'getbetter:unbekannt',
      'bettergym:fitness',
      'betterfamily:shopping',
      'getbetter:shopping',
    ],
    catalog,
  );
  assert.deepEqual(
    entries.map((entry) => [entry.key, entry.appId, entry.module.name]),
    [
      ['betterfamily:shopping', 'betterfamily', 'Einkaufsliste'],
      ['bettergym:fitness', 'bettergym', 'Training'],
    ],
  );
});
