import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isRotating, nextAssignee } from './rotation';

test('nach dem Erledigen ist die nächste Person dran', () => {
  const rotation = ['anna', 'ben', 'cleo'];
  assert.equal(nextAssignee({ assignedTo: 'anna', rotation }), 'ben');
  assert.equal(nextAssignee({ assignedTo: 'cleo', rotation }), 'anna');
});

test('ohne Zuteilung oder fremd beginnt es vorne', () => {
  assert.equal(nextAssignee({ assignedTo: null, rotation: ['anna', 'ben'] }), 'anna');
  assert.equal(nextAssignee({ assignedTo: 'dan', rotation: ['anna', 'ben'] }), 'anna');
});

test('ohne Reihum bleibt es bei der Person', () => {
  assert.equal(nextAssignee({ assignedTo: 'anna' }), 'anna');
  assert.equal(nextAssignee({ assignedTo: null, rotation: [] }), null);
});

test('Ausgetretene werden übersprungen', () => {
  const chore = { assignedTo: 'anna', rotation: ['anna', 'ben', 'cleo'] };
  assert.equal(nextAssignee(chore, ['anna', 'cleo']), 'cleo');
  assert.equal(nextAssignee({ assignedTo: 'ben', rotation: ['ben'] }, []), 'ben');
});

test('Reihum heisst mindestens zwei', () => {
  assert.equal(isRotating({ rotation: ['anna'] }), false);
  assert.equal(isRotating({ rotation: ['anna', 'ben'] }), true);
  assert.equal(isRotating({}), false);
});
