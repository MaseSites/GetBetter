import assert from 'node:assert/strict';
import { test } from 'node:test';

import { budgetPace, daysInMonthOf } from './pace';

test('kennt die Laenge jedes Monats, Februar im Schaltjahr', () => {
  assert.equal(daysInMonthOf('2026-01-15'), 31);
  assert.equal(daysInMonthOf('2026-02-01'), 28);
  assert.equal(daysInMonthOf('2028-02-10'), 29);
  assert.equal(daysInMonthOf('2026-04-30'), 30);
  assert.equal(daysInMonthOf('2026-09-25'), 30);
  assert.equal(daysInMonthOf('2026-12-31'), 31);
});

test('ohne Budget gibt es kein Tempo', () => {
  assert.equal(budgetPace({ spent: 100, limit: null, today: '2026-09-10' }), null);
  assert.equal(budgetPace({ spent: 100, limit: 0, today: '2026-09-10' }), null);
});

test('im Plan: was pro Tag noch geht, heute mitgezaehlt', () => {
  // September: 30 Tage, am 10. bleiben 21 Tage. 900 − 200 = 700, 700 / 21 = 33.33.
  const pace = budgetPace({ spent: 200, limit: 900, today: '2026-09-10' });
  assert.equal(pace?.status, 'ok');
  assert.equal(pace?.daysLeft, 21);
  assert.equal(pace?.left, 700);
  assert.equal(pace?.perDayLeft, 33);
  assert.equal(pace?.overBy, 0);
});

test('schneller als der Plan: um wie viel', () => {
  // Plan bis zum 10.: 900 × 10 / 30 = 300. Ausgegeben 340 → 40 drueber.
  const pace = budgetPace({ spent: 340, limit: 900, today: '2026-09-10' });
  assert.equal(pace?.status, 'ahead');
  assert.equal(pace?.overBy, 40);
  assert.equal(pace?.perDayLeft, 26);
  assert.equal(pace?.projected, 1020);
});

test('ein Franken Spielraum ist noch im Plan', () => {
  const pace = budgetPace({ spent: 300.5, limit: 900, today: '2026-09-10' });
  assert.equal(pace?.status, 'ok');
});

test('ueber dem Budget: wie viel drueber, nichts mehr pro Tag', () => {
  const pace = budgetPace({ spent: 950.4, limit: 900, today: '2026-09-20' });
  assert.equal(pace?.status, 'over');
  assert.equal(pace?.overBy, 50.4);
  assert.equal(pace?.perDayLeft, 0);
  assert.equal(pace?.left, -50.4);
});

test('am letzten Tag zaehlt nur noch heute', () => {
  const pace = budgetPace({ spent: 850, limit: 900, today: '2026-02-28' });
  assert.equal(pace?.daysLeft, 1);
  assert.equal(pace?.perDayLeft, 50);
  assert.equal(pace?.status, 'ok');
  // Am 31. eines langen Monats ebenso.
  assert.equal(budgetPace({ spent: 0, limit: 310, today: '2026-12-31' })?.daysLeft, 1);
});

test('am ersten Tag steht das ganze Budget auf alle Tage verteilt', () => {
  const pace = budgetPace({ spent: 0, limit: 310, today: '2026-10-01' });
  assert.equal(pace?.daysLeft, 31);
  assert.equal(pace?.perDayLeft, 10);
});

test('unter einem Franken pro Tag zaehlen die Rappen', () => {
  const pace = budgetPace({ spent: 895.5, limit: 900, today: '2026-09-21' });
  // 4.50 auf 10 Tage → 0.45
  assert.equal(pace?.perDayLeft, 0.45);
});

test('ohne Tag nimmt es heute in Zuerich', () => {
  const pace = budgetPace({ spent: 0, limit: 100 });
  assert.ok(pace !== null && pace.daysLeft >= 1 && pace.daysLeft <= 31);
});
