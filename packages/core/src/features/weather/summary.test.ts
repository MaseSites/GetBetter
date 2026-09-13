import assert from 'node:assert/strict';
import { test } from 'node:test';

import { kindOfCode, kindOfHour } from './kinds';
import { dayText, nextHoursText, summarizeDay, summarizeNextHours } from './summary';

const HOUR = 3_600_000;
/** Mitternacht am Ort, als fester Zeitpunkt. */
const DAY = Date.UTC(2026, 8, 13);

const CLEAR = 0;
const CLOUDY = 3;
const RAIN = 61;
const SHOWERS = 80;
const SNOW = 71;

type Hour = { ts: number; code: number; rain: number; precip: number };

/** Stunden ab `fromHour` (des Tages), je Stunde bestimmt `at` das Wetter. */
function hours(fromHour: number, count: number, at: (hour: number) => Omit<Hour, 'ts'>): Hour[] {
  return Array.from({ length: count }, (_, index) => {
    const hour = fromHour + index;
    return { ts: DAY + hour * HOUR, ...at(hour) };
  });
}

const dry = (code: number) => ({ code, rain: 5, precip: 0 });
const wet = (code: number, rain = 80) => ({ code, rain, precip: 1.2 });

/** Ein t(), das Schluessel und Werte zeigt. */
const say = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key;
const hourLabel = (ts: number) => String(((ts - DAY) / HOUR) % 24);

test('ein nasser Code mit kleiner Wahrscheinlichkeit ist noch kein Regen', () => {
  assert.equal(kindOfCode(RAIN), 'rain');
  assert.equal(kindOfHour({ ts: 0, code: RAIN, rain: 10, precip: 0 }), 'cloudy');
  assert.equal(kindOfHour({ ts: 0, code: RAIN, rain: 10, precip: 0.4 }), 'rain');
  assert.equal(kindOfHour({ ts: 0, code: CLOUDY, rain: 70, precip: 0 }), 'rain');
});

test('„Ab 16 Uhr Regen. Morgen früh klar.“', () => {
  const next = hours(14, 24, (hour) => {
    if (hour >= 16 && hour <= 20) return wet(RAIN);
    if (hour >= 30) return dry(CLEAR);
    return dry(CLOUDY);
  });
  const summary = summarizeNextHours(next, DAY + 24 * HOUR);
  assert.deepEqual(summary, {
    lead: { type: 'from', kind: 'rain', ts: DAY + 16 * HOUR },
    tomorrow: 'clear',
  });
  assert.equal(
    summary && nextHoursText(summary, say, hourLabel),
    'weather.summary.from.rain(16) weather.summary.tomorrow.clear',
  );
});

test('regnet es jetzt, sagt der Satz, wann es aufhoert', () => {
  const next = hours(9, 24, (hour) => (hour < 12 ? wet(RAIN) : dry(CLOUDY)));
  const summary = summarizeNextHours(next, DAY + 24 * HOUR);
  assert.deepEqual(summary?.lead, { type: 'until', kind: 'rain', ts: DAY + 12 * HOUR });
  assert.equal(summary?.tomorrow, null);
});

test('Regen ohne Ende und Regen morgen früh: ein Satz reicht', () => {
  const next = hours(18, 24, () => wet(RAIN));
  assert.deepEqual(summarizeNextHours(next, DAY + 24 * HOUR), {
    lead: { type: 'steady', kind: 'rain' },
    tomorrow: null,
  });
});

test('trocken und klar bis morgen: nur „Die nächsten Stunden klar.“', () => {
  const next = hours(10, 24, () => dry(CLEAR));
  const summary = summarizeNextHours(next, DAY + 24 * HOUR);
  assert.deepEqual(summary, { lead: { type: 'steady', kind: 'clear' }, tomorrow: null });
  assert.equal(summary && nextHoursText(summary, say, hourLabel), 'weather.summary.steady.clear');
});

test('nach dem Regen kommt morgen früh Schnee — das ist ein zweiter Satz', () => {
  const next = hours(14, 24, (hour) => {
    if (hour < 16) return wet(RAIN);
    if (hour >= 30 && hour < 34) return wet(SNOW);
    return dry(CLOUDY);
  });
  assert.deepEqual(summarizeNextHours(next, DAY + 24 * HOUR), {
    lead: { type: 'until', kind: 'rain', ts: DAY + 16 * HOUR },
    tomorrow: 'snow',
  });
});

test('ohne Stunden gibt es keinen Satz', () => {
  assert.equal(summarizeNextHours([], null), null);
});

test('Tag: „Vormittags sonnig, ab 17 Uhr Schauer (60 %).“', () => {
  const day = hours(0, 24, (hour) => (hour >= 17 && hour <= 19 ? wet(SHOWERS, 60) : dry(CLEAR)));
  const summary = summarizeDay(day, DAY);
  assert.deepEqual(summary, {
    type: 'dryThenWet',
    dry: 'clear',
    wet: 'rain',
    ts: DAY + 17 * HOUR,
    percent: 60,
    early: false,
  });
  assert.equal(
    summary && dayText(summary, say, hourLabel),
    'weather.daySummary.sentence(weather.daySummary.morning.clear,weather.daySummary.from.rain(17,60))',
  );
});

test('Tag: Regen schon um 9 heisst „Zuerst …“ statt „Vormittags …“', () => {
  const day = hours(0, 24, (hour) => (hour >= 9 && hour <= 11 ? wet(RAIN, 70) : dry(CLOUDY)));
  const summary = summarizeDay(day, DAY);
  assert.equal(summary?.type, 'dryThenWet');
  assert.equal(summary?.type === 'dryThenWet' && summary.early, true);
});

test('Tag: ohne Regen, morgens klar und nachmittags bewoelkt', () => {
  const day = hours(0, 24, (hour) => dry(hour < 12 ? CLEAR : CLOUDY));
  assert.deepEqual(summarizeDay(day, DAY), { type: 'split', morning: 'clear', later: 'cloudy' });
});

test('Tag: fast immer Regen heisst den ganzen Tag, mit der hoechsten Wahrscheinlichkeit', () => {
  const day = hours(0, 24, (hour) =>
    hour === 21 ? dry(CLOUDY) : wet(RAIN, hour === 12 ? 90 : 70),
  );
  const summary = summarizeDay(day, DAY);
  assert.deepEqual(summary, { type: 'whole', kind: 'rain', percent: 90 });
  assert.equal(summary && dayText(summary, say, hourLabel), 'weather.daySummary.whole.rain(90)');
});

test('Tag: Regen bis 11 Uhr, danach klar', () => {
  const day = hours(0, 24, (hour) => (hour < 11 ? wet(RAIN, 80) : dry(CLEAR)));
  const summary = summarizeDay(day, DAY);
  assert.deepEqual(summary, {
    type: 'wetThenDry',
    wet: 'rain',
    ts: DAY + 11 * HOUR,
    percent: 80,
    dry: 'clear',
  });
  assert.equal(
    summary && dayText(summary, say, hourLabel),
    'weather.daySummary.sentence(weather.daySummary.until.rain(11,80),weather.daySummary.after.clear)',
  );
});

test('Tag ohne Stunden am Tag: kein Satz', () => {
  assert.equal(
    summarizeDay(
      hours(0, 5, () => dry(CLEAR)),
      DAY,
    ),
    null,
  );
});
