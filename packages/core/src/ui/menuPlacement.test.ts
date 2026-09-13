import assert from 'node:assert/strict';
import { test } from 'node:test';

import { placeMenu, type MenuPlacementInput } from './menuPlacement';

const base: MenuPlacementInput = {
  anchor: { x: 20, y: 100, width: 120, height: 40 },
  menu: { width: 240, height: 200 },
  bounds: { x: 0, y: 0, width: 390, height: 844 },
  gap: 8,
  align: 'start',
  prefer: 'below',
};

test('Menue: unter dem Anker, linke Kanten buendig', () => {
  assert.deepEqual(placeMenu(base), { left: 20, top: 148, above: false });
});

test('Menue: am unteren Rand geht es nach oben', () => {
  const low = { ...base, anchor: { x: 20, y: 760, width: 120, height: 40 } };
  assert.deepEqual(placeMenu(low), { left: 20, top: 552, above: true });
});

test('Menue: rechts buendig bleibt im Rahmen', () => {
  const right = {
    ...base,
    align: 'end' as const,
    anchor: { x: 330, y: 100, width: 44, height: 44 },
  };
  assert.equal(placeMenu(right).left, 134);
  const edge = { ...base, anchor: { x: 300, y: 100, width: 40, height: 40 } };
  assert.equal(placeMenu(edge).left, 142);
});

test('Menue: lieber oben, wenn es dort passt', () => {
  const up = {
    ...base,
    prefer: 'above' as const,
    anchor: { x: 20, y: 600, width: 56, height: 56 },
  };
  assert.deepEqual(placeMenu(up), { left: 20, top: 392, above: true });
  const noRoom = { ...up, anchor: { x: 20, y: 60, width: 56, height: 56 } };
  assert.equal(placeMenu(noRoom).above, false);
});

test('Menue: zu hoch fuer beide Seiten bleibt trotzdem im Fenster', () => {
  const tall = { ...base, menu: { width: 240, height: 900 } };
  assert.equal(placeMenu(tall).top, 8);
});

test('Menue: ein Druckpunkt ohne Groesse taugt als Anker', () => {
  const point = { ...base, anchor: { x: 200, y: 300, width: 0, height: 0 } };
  assert.deepEqual(placeMenu(point), { left: 142, top: 308, above: false });
});
