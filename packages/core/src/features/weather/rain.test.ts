import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rainOutlook } from './rain';

const QUARTER = 15 * 60_000;
const START = Date.UTC(2026, 8, 13, 14, 0);

/** Viertelstunden ab 14:00 mit diesen Mengen. */
const quarters = (amounts: readonly number[]) =>
  amounts.map((precip, index) => ({ ts: START + index * QUARTER, precip }));

test('ohne Regen in zwei Stunden gibt es kein Modul', () => {
  assert.equal(rainOutlook(quarters([0, 0, 0.05, 0, 0, 0, 0, 0]), START), null);
  assert.equal(rainOutlook([], START), null);
});

test('„Regen beginnt in 25 Min“: gemessen ab jetzt, nicht ab der Viertelstunde', () => {
  const outlook = rainOutlook(quarters([0, 0, 0.4, 0.8, 0.2, 0, 0, 0]), START + 5 * 60_000);
  assert.equal(outlook?.state, 'starts');
  assert.equal(outlook?.minutes, 25);
  assert.equal(outlook?.max, 0.8);
  assert.equal(outlook?.slots.length, 8);
});

test('regnet es schon, sagt es, wann es aufhoert', () => {
  const outlook = rainOutlook(quarters([0.6, 0.3, 0.1, 0, 0, 0, 0, 0]), START);
  assert.equal(outlook?.state, 'stops');
  assert.equal(outlook?.minutes, 45);
});

test('Regen die ganzen zwei Stunden', () => {
  const outlook = rainOutlook(quarters([0.6, 0.3, 0.2, 0.2, 0.3, 0.5, 0.4, 0.2, 0]), START);
  assert.equal(outlook?.state, 'continues');
  assert.equal(outlook?.slots.length, 8);
});

test('vergangene Viertelstunden zaehlen nicht mit', () => {
  const outlook = rainOutlook(quarters([2, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.9]), START + 20 * 60_000);
  assert.equal(outlook?.slots[0]?.ts, START + QUARTER);
  assert.equal(outlook?.slots.length, 8);
  assert.equal(outlook?.state, 'starts');
  assert.equal(outlook?.minutes, 100);
});
