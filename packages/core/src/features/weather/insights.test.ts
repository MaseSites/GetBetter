import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ageOf,
  compassPoint,
  dayIndexAt,
  daylightParts,
  eaqiLevel,
  feelsReason,
  hoursFrom,
  hoursOfDay,
  mainPollutant,
  nowShare,
  pressureTrend,
  protectionWindow,
  rangeBar,
  uvLevel,
  uvShare,
  visibilityLevel,
  weekSpan,
} from './insights';

const HOUR = 3_600_000;
const DAY = Date.UTC(2026, 8, 13);

test('UV nach den Stufen der WHO', () => {
  assert.equal(uvLevel(0), 'low');
  assert.equal(uvLevel(2.4), 'low');
  assert.equal(uvLevel(2.6), 'moderate');
  assert.equal(uvLevel(6), 'high');
  assert.equal(uvLevel(8), 'veryHigh');
  assert.equal(uvLevel(11), 'extreme');
  assert.equal(uvShare(5.5), 0.5);
  assert.equal(uvShare(14), 1);
});

test('Sonnenschutz von der ersten bis nach der letzten Stunde ab UV 3', () => {
  const day = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((hour) => ({
    ts: DAY + hour * HOUR,
    uv: hour >= 11 && hour <= 15 ? 5 : 1,
  }));
  assert.deepEqual(protectionWindow(day), { from: DAY + 11 * HOUR, to: DAY + 16 * HOUR });
  assert.equal(protectionWindow([{ ts: DAY, uv: 1 }]), null);
});

test('EAQI in sechs Stufen zu je 20', () => {
  assert.equal(eaqiLevel(0), 1);
  assert.equal(eaqiLevel(20), 1);
  assert.equal(eaqiLevel(21), 2);
  assert.equal(eaqiLevel(60), 3);
  assert.equal(eaqiLevel(80), 4);
  assert.equal(eaqiLevel(100), 5);
  assert.equal(eaqiLevel(140), 6);
});

test('der Hauptschadstoff ist der mit dem hoechsten Teilindex', () => {
  assert.equal(mainPollutant({ pm2_5: 18, pm10: 10, o3: 34, no2: 3, so2: 0 }), 'o3');
  assert.equal(mainPollutant({ pm2_5: 0, so2: 0 }), null);
  assert.equal(mainPollutant({}), null);
});

test('gefuehlt: warum es anders wirkt', () => {
  assert.equal(feelsReason({ temp: 18, feelsLike: 17, wind: 30, humidity: 50 }), 'similar');
  assert.equal(feelsReason({ temp: 18, feelsLike: 14, wind: 25, humidity: 50 }), 'wind');
  assert.equal(feelsReason({ temp: 18, feelsLike: 15, wind: 5, humidity: 50 }), 'colder');
  assert.equal(feelsReason({ temp: 28, feelsLike: 32, wind: 5, humidity: 75 }), 'humid');
  assert.equal(feelsReason({ temp: 20, feelsLike: 23, wind: 5, humidity: 30 }), 'warmer');
});

test('Windrichtung auf acht Himmelsrichtungen', () => {
  assert.equal(compassPoint(0), 'n');
  assert.equal(compassPoint(350), 'n');
  assert.equal(compassPoint(44), 'ne');
  assert.equal(compassPoint(225), 'sw');
  assert.equal(compassPoint(-90), 'w');
  assert.equal(compassPoint(720 + 180), 's');
});

test('Sicht und Luftdruck', () => {
  assert.equal(visibilityLevel(43_800), 'clear');
  assert.equal(visibilityLevel(12_000), 'good');
  assert.equal(visibilityLevel(5_000), 'hazy');
  assert.equal(visibilityLevel(800), 'poor');
  assert.equal(pressureTrend(1016, 1017.4), 'rising');
  assert.equal(pressureTrend(1016, 1014.9), 'falling');
  assert.equal(pressureTrend(1016, 1016.5), 'steady');
});

test('der Wochenbalken ist auf die ganze Woche skaliert', () => {
  const week = weekSpan([
    { min: 12, max: 21 },
    { min: 9, max: 23 },
    { min: 11, max: 17 },
  ]);
  assert.deepEqual(week, { min: 9, max: 23 });
  assert.deepEqual(rangeBar(9, 23, week.min, week.max), { start: 0, end: 1 });
  assert.deepEqual(rangeBar(16, 23, week.min, week.max), { start: 0.5, end: 1 });
  assert.deepEqual(rangeBar(5, 30, 5, 5), { start: 0, end: 1 });
  assert.equal(nowShare(16, 9, 23), 0.5);
  assert.equal(nowShare(40, 9, 23), 1);
  assert.equal(nowShare(16, 10, 10), 0.5);
});

test('wie alt die Daten sind', () => {
  const fresh = 20 * 60_000;
  const now = DAY + 10 * HOUR;
  assert.deepEqual(ageOf(now - 30_000, now, fresh), { kind: 'justNow' });
  assert.deepEqual(ageOf(now - 5 * 60_000, now, fresh), { kind: 'fresh' });
  assert.deepEqual(ageOf(now - 45 * 60_000, now, fresh), { kind: 'minutes', count: 45 });
  assert.deepEqual(ageOf(now - 2.5 * HOUR, now, fresh), { kind: 'hours', count: 2 });
  assert.deepEqual(ageOf(now - 30 * HOUR, now, fresh), { kind: 'days' });
  assert.deepEqual(ageOf(now + HOUR, now, fresh), { kind: 'justNow' });
});

test('Tageslicht in Stunden und Minuten', () => {
  assert.deepEqual(daylightParts(45_703), { hours: 12, minutes: 42 });
  assert.deepEqual(daylightParts(-5), { hours: 0, minutes: 0 });
});

test('Stunden ab jetzt, Stunden eines Tages und der laufende Tag', () => {
  const all = Array.from({ length: 48 }, (_, hour) => ({ ts: DAY + hour * HOUR }));
  const now = DAY + 14.5 * HOUR;
  assert.equal(hoursFrom(all, now, 3)[0]?.ts, DAY + 14 * HOUR);
  assert.equal(hoursFrom(all, now, 3).length, 3);
  assert.deepEqual(hoursFrom(all, DAY + 60 * HOUR, 3), []);
  assert.equal(hoursOfDay(all, DAY + 24 * HOUR).length, 24);
  const days = [{ ts: DAY }, { ts: DAY + 24 * HOUR }, { ts: DAY + 48 * HOUR }];
  assert.equal(dayIndexAt(days, now), 0);
  assert.equal(dayIndexAt(days, DAY + 30 * HOUR), 1);
  assert.equal(dayIndexAt(days, DAY - HOUR), 0);
});
