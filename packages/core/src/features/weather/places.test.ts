import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_PLACE,
  MAX_PLACES,
  approximate,
  findPlace,
  insertedPlace,
  movedPlace,
  parsePlaceParam,
  placeKey,
  placesOf,
  withPlace,
  withPlaceFirst,
  withoutPlace,
} from './places';

const zurich = { name: 'Zürich', lat: 47.3769, lon: 8.5417 };
const bern = { name: 'Bern', lat: 46.948, lon: 7.4474 };
const basel = { name: 'Basel', lat: 47.5584, lon: 7.5733 };

const many = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ name: `Ort ${index}`, lat: index, lon: index }));

test('ein altes Konto mit nur einem Ort bekommt ihn als Liste', () => {
  assert.deepEqual(placesOf({ weatherPlace: bern }), [bern]);
});

test('die Liste gilt vor dem einzelnen Ort', () => {
  assert.deepEqual(placesOf({ weatherPlace: bern, weatherPlaces: [zurich, basel] }), [
    zurich,
    basel,
  ]);
});

test('ohne Orte gilt Zuerich, ohne Konto auch', () => {
  assert.deepEqual(placesOf({}), [DEFAULT_PLACE]);
  assert.deepEqual(placesOf(null), [DEFAULT_PLACE]);
  assert.deepEqual(placesOf({ weatherPlaces: [] }), [DEFAULT_PLACE]);
});

test('Doppelte und kaputte Orte fallen beim Lesen weg, hoechstens 20 bleiben', () => {
  const broken = { name: '', lat: 99, lon: 8 } as typeof zurich;
  assert.deepEqual(placesOf({ weatherPlaces: [zurich, broken, { ...zurich, name: 'Z' }, bern] }), [
    zurich,
    bern,
  ]);
  assert.equal(placesOf({ weatherPlaces: many(25) }).length, MAX_PLACES);
});

test('hinzufuegen: hinten an, nicht doppelt, nicht ueber 20', () => {
  assert.deepEqual(withPlace([zurich], bern), { places: [zurich, bern], result: 'added' });
  assert.equal(withPlace([zurich, bern], { ...bern, name: 'Berne' }).result, 'duplicate');
  assert.equal(withPlace(many(MAX_PLACES), bern).result, 'full');
});

test('nach vorne holen setzt den Ort an die erste Stelle, ohne ihn zu verdoppeln', () => {
  assert.deepEqual(withPlaceFirst([zurich, bern, basel], basel), [basel, zurich, bern]);
  assert.deepEqual(withPlaceFirst([zurich], bern), [bern, zurich]);
});

test('entfernen laesst den letzten Ort stehen', () => {
  assert.deepEqual(withoutPlace([zurich, bern], placeKey(zurich)), [bern]);
  assert.deepEqual(withoutPlace([zurich], placeKey(zurich)), [zurich]);
});

test('Rückgängig setzt den Ort an seine alte Stelle', () => {
  assert.deepEqual(insertedPlace([zurich, basel], bern, 1), [zurich, bern, basel]);
  assert.deepEqual(insertedPlace([zurich], bern, 9), [zurich, bern]);
  assert.deepEqual(insertedPlace([zurich, bern], bern, 0), [zurich, bern]);
});

test('umsortieren tauscht mit dem Nachbarn und bleibt am Rand stehen', () => {
  assert.deepEqual(movedPlace([zurich, bern, basel], placeKey(bern), -1), [bern, zurich, basel]);
  assert.deepEqual(movedPlace([zurich, bern, basel], placeKey(bern), 1), [zurich, basel, bern]);
  assert.deepEqual(movedPlace([zurich, bern], placeKey(zurich), -1), [zurich, bern]);
  assert.deepEqual(movedPlace([zurich, bern], 'gibt-es-nicht', 1), [zurich, bern]);
});

test('der Schluessel ist auf drei Stellen gerundet und findet den Ort', () => {
  assert.equal(placeKey(zurich), '47.377,8.542');
  assert.equal(findPlace([zurich, bern], placeKey(bern)), bern);
});

test('der Standort wird auf etwa einen Kilometer gerundet', () => {
  assert.equal(approximate(47.376912), 47.38);
  assert.equal(approximate(-8.54171), -8.54);
});

test('der Parameter place nimmt nur gueltige Koordinaten', () => {
  assert.deepEqual(parsePlaceParam('46.95,7.45'), { lat: 46.95, lon: 7.45 });
  assert.deepEqual(parsePlaceParam(['46.95, 7.45']), { lat: 46.95, lon: 7.45 });
  assert.equal(parsePlaceParam(undefined), null);
  assert.equal(parsePlaceParam('46.95'), null);
  assert.equal(parsePlaceParam('abc,7'), null);
  assert.equal(parsePlaceParam('91,7'), null);
  assert.equal(parsePlaceParam(',7'), null);
});
