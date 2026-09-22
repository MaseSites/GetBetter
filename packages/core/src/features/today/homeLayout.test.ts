import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  blockScale,
  canvasRows,
  clampBlock,
  GRID_COLUMNS,
  moveTo,
  newBlock,
  nextVariant,
  parseLayout,
  patchBlock,
  removeBlock,
  resizeBy,
  templateLayout,
  variantOf,
} from './homeLayout';

test('newBlock: volle Breite, unter allem anderen, eindeutige Id', () => {
  const first = newBlock('band');
  assert.equal(first.kind, 'band');
  assert.equal(first.variant, 'thread');
  assert.deepEqual([first.x, first.y, first.w], [0, 0, GRID_COLUMNS]);
  assert.notEqual(first.id, newBlock('band').id);
  assert.equal(newBlock('tasks', [{ ...first, h: 5 }]).y, 5);
});

test('clampBlock: nie breiter als das Raster, nie daneben, nie kleiner als ein Feld', () => {
  const block = newBlock('tasks');
  assert.deepEqual(clampBlock({ ...block, x: -2, y: -3, w: 9, h: 0 }), {
    ...block,
    x: 0,
    y: 0,
    w: GRID_COLUMNS,
    h: 1,
  });
  // Ein schmaler Block darf rechts stehen, aber nicht darüber hinaus.
  assert.equal(clampBlock({ ...block, x: 5, w: 2 }).x, GRID_COLUMNS - 2);
});

test('moveTo: hin, wo man will — im Raster', () => {
  const block = { ...newBlock('notes'), w: 2, h: 3 };
  const moved = moveTo(block, 1, 4);
  assert.deepEqual([moved.x, moved.y], [1, 4]);
  assert.equal(moveTo(block, 9, 0).x, GRID_COLUMNS - 2);
  assert.equal(moveTo(block, 0, -5).y, 0);
});

test('resizeBy: rechts und unten wächst er, links und oben wandert der Anfang mit', () => {
  const block = { ...newBlock('news'), x: 1, y: 2, w: 2, h: 2 };
  const wider = resizeBy(block, 'br', 1, 1);
  assert.deepEqual([wider.x, wider.y, wider.w, wider.h], [1, 2, 3, 3]);

  const fromLeft = resizeBy(block, 'tl', -1, -1);
  assert.deepEqual([fromLeft.x, fromLeft.y, fromLeft.w, fromLeft.h], [0, 1, 3, 3]);

  // Kleiner als ein Feld wird er nie, und über den Rand geht er nicht.
  const tiny = resizeBy(block, 'br', -9, -9);
  assert.deepEqual([tiny.w, tiny.h], [1, 1]);
  assert.equal(resizeBy(block, 'br', 9, 0).w, GRID_COLUMNS - 1);
  assert.equal(resizeBy({ ...block, y: 0 }, 'tr', 0, -3).y, 0);
});

test('canvasRows: so hoch ist die Fläche', () => {
  assert.equal(canvasRows([]), 0);
  assert.equal(
    canvasRows([
      { ...newBlock('band'), y: 0, h: 3 },
      { ...newBlock('tasks'), y: 4, h: 2 },
    ]),
    6,
  );
});

test('variantOf und nextVariant: nur bekannte Stile, im Kreis', () => {
  assert.equal(variantOf('band', 'now'), 'now');
  assert.equal(variantOf('band', 'kachel'), 'thread');
  assert.equal(nextVariant('band', 'thread'), 'now');
  assert.equal(nextVariant('band', 'compact'), 'thread');
  assert.equal(nextVariant('apps', 'cards'), 'cards');
});

test('patchBlock und removeBlock: nur dieser Block, nur bekannte Stile', () => {
  const layout = templateLayout('grid');
  const first = layout[0];
  assert.ok(first);
  const patched = patchBlock(layout, first.id, { w: 2, variant: 'quatsch' as never });
  assert.equal(patched[0]?.w, 2);
  assert.equal(patched[0]?.variant, 'thread');
  assert.equal(patched[1]?.w, layout[1]?.w);
  assert.equal(removeBlock(layout, first.id).length, layout.length - 1);
});

test('parseLayout: liest das Raster, rechnet alte Stände um, wirft Krummes weg', () => {
  const stored = JSON.stringify([
    { id: 'a', kind: 'band', variant: 'now', x: 0, y: 0, w: 4, h: 3 },
    { id: 'b', kind: 'gibt-es-nicht' },
    { kind: 'tasks', variant: 'quatsch', x: 9, y: 2, w: 2, h: 2 },
    'kaputt',
  ]);
  const layout = parseLayout(stored);
  assert.equal(layout?.length, 2);
  assert.deepEqual(layout?.[0], { id: 'a', kind: 'band', variant: 'now', x: 0, y: 0, w: 4, h: 3 });
  assert.equal(layout?.[1]?.variant, 'page');
  assert.equal(layout?.[1]?.x, GRID_COLUMNS - 2);

  // Der alte Stand mit `span` und `size` wird zu Zeilen untereinander.
  const old = parseLayout(
    JSON.stringify([
      { id: 'x', kind: 'band', variant: 'thread', span: 'full', size: 'lg' },
      { id: 'y', kind: 'notes', variant: 'list', span: 'half', size: 'sm' },
    ]),
  );
  assert.deepEqual(
    old?.map((block) => [block.x, block.y, block.w, block.h]),
    [
      [0, 0, 4, 5],
      [0, 5, 2, 3],
    ],
  );

  assert.equal(parseLayout('[]'), null);
  assert.equal(parseLayout('kein json'), null);
  assert.equal(parseLayout(null), null);
});

test('blockScale: ein volles Element ist 1, ein halbes 0.5 — nie winziger als 0.4', () => {
  assert.equal(blockScale(GRID_COLUMNS), 1);
  assert.equal(blockScale(2), 0.5);
  assert.equal(blockScale(1), 0.4);
  assert.equal(blockScale(9), 1);
  assert.equal(blockScale(Number.NaN), 1);
});
