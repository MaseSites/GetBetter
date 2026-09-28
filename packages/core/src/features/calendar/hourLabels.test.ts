import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hourLabelHidden } from './hourLabels';

const HOUR = 56;
const LABEL = 16;

test('um 12:40 bleibt 13:00 stehen', () => {
  assert.equal(hourLabelHidden(13, 12 * 60 + 40, HOUR, LABEL), false);
});

test('um 12:55 weicht 13:00 der Jetzt-Zeit', () => {
  assert.equal(hourLabelHidden(13, 12 * 60 + 55, HOUR, LABEL), true);
  assert.equal(hourLabelHidden(13, 13 * 60 + 5, HOUR, LABEL), true);
});

test('genau eine Zeilenhoehe Abstand ueberlagert sich nicht mehr', () => {
  // 16 pt bei 56 pt je Stunde sind gut 17 Minuten.
  assert.equal(hourLabelHidden(13, 13 * 60 - 18, HOUR, LABEL), false);
  assert.equal(hourLabelHidden(13, 13 * 60 - 17, HOUR, LABEL), true);
});

test('ohne Jetzt steht jede Stunde ausser Mitternacht', () => {
  assert.equal(hourLabelHidden(0, null, HOUR, LABEL), true);
  assert.equal(hourLabelHidden(1, null, HOUR, LABEL), false);
  assert.equal(hourLabelHidden(23, null, HOUR, LABEL), false);
});
