import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bpCategoryOf } from './bloodPressure';

test('die Grenzen nach ESC 2024', () => {
  assert.equal(bpCategoryOf(119, 69), 'normal');
  assert.equal(bpCategoryOf(120, 69), 'elevated');
  assert.equal(bpCategoryOf(119, 70), 'elevated');
  assert.equal(bpCategoryOf(139, 89), 'elevated');
  assert.equal(bpCategoryOf(140, 60), 'hypertension');
  assert.equal(bpCategoryOf(115, 90), 'hypertension');
});

test('die hoehere Kategorie zaehlt', () => {
  assert.equal(bpCategoryOf(150, 65), 'hypertension');
  assert.equal(bpCategoryOf(110, 85), 'elevated');
});

test('ohne unteren Wert zaehlt der obere', () => {
  assert.equal(bpCategoryOf(128, null), 'elevated');
});
