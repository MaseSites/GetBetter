import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MIN_CARD, TIMELINE_HOUR, minutesIn, placeDay, scrollTargetOf } from './timeline';

// Dienstag, 22. September 2026, Mitternacht Ortszeit.
const DAY = new Date(2026, 8, 22);
const at = (hours: number, minutes = 0) => new Date(2026, 8, 22, hours, minutes).toISOString();

test('minutesIn: auf den Tag begrenzt', () => {
  assert.equal(minutesIn(at(10, 30), DAY), 630);
  assert.equal(minutesIn(new Date(2026, 8, 21, 22).toISOString(), DAY), 0);
  assert.equal(minutesIn(new Date(2026, 8, 23, 2).toISOString(), DAY), 24 * 60);
});

test('placeDay: so hoch, wie es dauert — mindestens ein Finger', () => {
  // Nach Beginn sortiert: zuerst der Wecker, dann der Coiffeur.
  const [alarm, coiffeur] = placeDay(
    [
      { key: 'coiffeur', at: at(10), until: at(11, 30) },
      { key: 'alarm', at: at(6, 40) },
    ],
    DAY,
  );
  assert.equal(alarm?.key, 'alarm');
  assert.equal(alarm?.height, MIN_CARD);
  assert.equal(coiffeur?.key, 'coiffeur');
  assert.equal(coiffeur?.top, 10 * TIMELINE_HOUR);
  assert.equal(coiffeur?.height, 1.5 * TIMELINE_HOUR);
  assert.deepEqual([coiffeur?.column, coiffeur?.columns], [0, 1]);
});

test('placeDay: was sich überschneidet, steht nebeneinander', () => {
  const placed = placeDay(
    [
      { key: 'a', at: at(9), until: at(11) },
      { key: 'b', at: at(10), until: at(12) },
      { key: 'c', at: at(11, 30), until: at(13) },
      { key: 'd', at: at(15), until: at(16) },
    ],
    DAY,
  );
  const of = (key: string) => placed.find((entry) => entry.key === key);
  assert.deepEqual([of('a')?.column, of('a')?.columns], [0, 2]);
  assert.deepEqual([of('b')?.column, of('b')?.columns], [1, 2]);
  // c beginnt, wenn a frei ist: wieder die erste Spalte.
  assert.deepEqual([of('c')?.column, of('c')?.columns], [0, 2]);
  assert.deepEqual([of('d')?.column, of('d')?.columns], [0, 1]);
  // Zwei Punkte zur selben Zeit überschneiden sich durch die Mindesthöhe.
  const same = placeDay(
    [
      { key: 'x', at: at(8) },
      { key: 'y', at: at(8) },
    ],
    DAY,
  );
  assert.deepEqual(
    same.map((entry) => entry.columns),
    [2, 2],
  );
});

test('placeDay: spät am Abend passt die Karte noch ins Raster', () => {
  const [late] = placeDay([{ key: 'late', at: at(23, 55) }], DAY);
  assert.equal((late?.top ?? 0) + (late?.height ?? 0), 24 * TIMELINE_HOUR);
});

test('scrollTargetOf: angetippt, sonst jetzt, sonst das Erste — mit einer Stunde Luft', () => {
  assert.equal(scrollTargetOf(14 * 60, 9 * 60, 8 * 60), 13 * TIMELINE_HOUR);
  assert.equal(scrollTargetOf(null, 9 * 60, 8 * 60), 8 * TIMELINE_HOUR);
  assert.equal(scrollTargetOf(null, null, 8 * 60), 7 * TIMELINE_HOUR);
  assert.equal(scrollTargetOf(null, null, null), 6 * TIMELINE_HOUR);
  assert.equal(scrollTargetOf(20, null, null), 0);
});
