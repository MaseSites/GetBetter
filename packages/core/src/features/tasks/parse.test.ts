import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chipsOf, parseTaskInput, type ParseOptions } from './parse';

/** Mittwoch, 16. September 2026. */
const today = '2026-09-16';

const parse = (text: string, extra: Partial<ParseOptions> = {}) =>
  parseTaskInput(text, { today, projects: ['Umzug', 'Haus bauen'], ...extra });

test('das Beispiel aus dem Bauplan', () => {
  const result = parse('Steuererklärung Freitag 17 Uhr !! #admin');
  assert.equal(result.title, 'Steuererklärung');
  assert.equal(result.day, '2026-09-18');
  assert.equal(result.time, '17:00');
  assert.equal(result.priority, 2);
  assert.deepEqual(result.tags, ['admin']);
  assert.deepEqual(
    chipsOf(result).map((chip) => chip.kind),
    ['when', 'priority', 'tag'],
  );
});

test('ohne Erkanntes bleibt alles Titel', () => {
  const result = parse('  Velo-Service buchen ');
  assert.equal(result.title, 'Velo-Service buchen');
  assert.equal(result.day, null);
  assert.equal(result.time, null);
  assert.equal(result.repeat, null);
  assert.equal(result.priority, 0);
  assert.deepEqual(result.tokens, []);
});

test('heute, morgen, übermorgen', () => {
  assert.equal(parse('Einkaufen heute').day, '2026-09-16');
  assert.equal(parse('morgen Einkaufen').day, '2026-09-17');
  assert.equal(parse('Einkaufen übermorgen').day, '2026-09-18');
  assert.equal(parse('Einkaufen uebermorgen').day, '2026-09-18');
  assert.equal(parse('bis morgen Offerte').title, 'Offerte');
});

test('Tageszeiten nach heute und morgen', () => {
  const evening = parse('Anrufen heute Abend');
  assert.equal(evening.day, '2026-09-16');
  assert.equal(evening.time, '18:00');
  assert.equal(evening.title, 'Anrufen');
  assert.equal(parse('Joggen morgen früh').time, '09:00');
  assert.equal(parse('Joggen heute Morgen').day, '2026-09-16');
  assert.equal(parse('Joggen heute Morgen').time, '09:00');
});

test('Wochentage: der nächste solche Tag, heute zählt mit', () => {
  assert.equal(parse('Zahnarzt Mittwoch').day, '2026-09-16');
  assert.equal(parse('Zahnarzt Montag').day, '2026-09-21');
  assert.equal(parse('Zahnarzt Fr').day, '2026-09-18');
  assert.equal(parse('Zahnarzt So.').day, '2026-09-20');
  const grill = parse('am Sonntag grillen');
  assert.equal(grill.day, '2026-09-20');
  assert.equal(grill.title, 'grillen');
  assert.equal(parse('nächsten Mittwoch Sitzung').day, '2026-09-23');
  assert.equal(parse('Sitzung kommenden Freitag').day, '2026-09-18');
});

test('mehrdeutige Wochentage bleiben Text', () => {
  const surname = parse('Anna Freitag anrufen');
  assert.equal(surname.day, null);
  assert.equal(surname.title, 'Anna Freitag anrufen');
  assert.equal(parse('Mo anrufen').day, null);
  assert.equal(parse('Das passt so').day, null);
  assert.equal(parse('Mai fragen').day, null);
});

test('in N Tagen, nächste Woche, Ende Monat, Wochenende', () => {
  assert.equal(parse('Rechnung in 3 Tagen').day, '2026-09-19');
  assert.equal(parse('Rechnung in zwei Wochen').day, '2026-09-30');
  assert.equal(parse('Rechnung in einem Monat').day, '2026-10-16');
  assert.equal(parse('Rechnung nächste Woche').day, '2026-09-21');
  assert.equal(parse('Rechnung nächsten Monat').day, '2026-10-01');
  assert.equal(parse('Rechnung Ende Monat').day, '2026-09-30');
  const end = parse('Rechnung bis Ende des Monats');
  assert.equal(end.day, '2026-09-30');
  assert.equal(end.title, 'Rechnung');
  assert.equal(parse('Rechnung Monatsende').day, '2026-09-30');
  assert.equal(parse('Velo putzen Wochenende').day, '2026-09-19');
  assert.equal(parse('in 0 Tagen').day, null);
});

test('Datum mit Zahlen: das Jahr wird ergänzt', () => {
  assert.equal(parse('Vignette 20.9.').day, '2026-09-20');
  assert.equal(parse('Vignette 15.9.').day, '2027-09-15');
  assert.equal(parse('Vignette 3.1.2027').day, '2027-01-03');
  assert.equal(parse('Vignette 3.1.27').day, '2027-01-03');
  const party = parse('am 20.9. Party');
  assert.equal(party.day, '2026-09-20');
  assert.equal(party.title, 'Party');
  const impossible = parse('Vignette 31.2.');
  assert.equal(impossible.day, null);
  assert.equal(impossible.title, 'Vignette 31.2.');
});

test('Datum mit Monatsnamen', () => {
  assert.equal(parse('Geburtstag 15. September').day, '2027-09-15');
  assert.equal(parse('Geburtstag 1. Oktober').day, '2026-10-01');
  const withYear = parse('Geburtstag 1. Okt. 2028');
  assert.equal(withYear.day, '2028-10-01');
  assert.equal(withYear.title, 'Geburtstag');
  assert.equal(parse('Geburtstag 29. Februar').day, '2028-02-29');
});

test('Uhrzeit', () => {
  const call = parse('Call 14:30');
  assert.equal(call.time, '14:30');
  assert.equal(call.title, 'Call');
  assert.equal(call.day, null);
  assert.equal(parse('Call um 9').time, '09:00');
  assert.equal(parse('Call 14 Uhr').time, '14:00');
  assert.equal(parse('Call um 9:15 Uhr').time, '09:15');
  assert.equal(parse('Call 12.30 Uhr').time, '12:30');
  assert.equal(parse('Call 14Uhr').time, '14:00');
});

test('ungültige Uhrzeiten bleiben Text', () => {
  const room = parse('Raum 25:00');
  assert.equal(room.time, null);
  assert.equal(room.title, 'Raum 25:00');
  assert.equal(parse('um 24 Uhr').time, null);
  assert.equal(parse('Preis 12.30').time, null);
  assert.equal(parse('um die Ecke').time, null);
});

test('Wiederholung', () => {
  const plants = parse('Pflanzen giessen alle 7 Tage');
  assert.equal(plants.title, 'Pflanzen giessen');
  assert.deepEqual(plants.repeat, { every: 7, unit: 'day', fromCompletion: false });
  assert.deepEqual(parse('Zähne jeden Tag').repeat, {
    every: 1,
    unit: 'day',
    fromCompletion: false,
  });
  assert.deepEqual(parse('Abfall alle 2 Wochen').repeat, {
    every: 2,
    unit: 'week',
    fromCompletion: false,
  });
  assert.deepEqual(parse('Miete monatlich').repeat, {
    every: 1,
    unit: 'month',
    fromCompletion: false,
  });
  assert.deepEqual(parse('Steuern jedes Jahr').repeat, {
    every: 1,
    unit: 'year',
    fromCompletion: false,
  });
  assert.equal(parse('Miete wöchentlich').repeat?.unit, 'week');
});

test('Wiederholung an Wochentagen setzt den ersten Termin', () => {
  const team = parse('Teamsitzung jeden Montag');
  assert.deepEqual(team.repeat, { every: 1, unit: 'week', weekdays: [1], fromCompletion: false });
  assert.equal(team.day, '2026-09-21');
  assert.equal(team.title, 'Teamsitzung');
  const work = parse('Stempeln werktags');
  assert.deepEqual(work.repeat?.weekdays, [1, 2, 3, 4, 5]);
  assert.equal(work.day, '2026-09-16');
  // Ein ausdrückliches Datum schlägt den ersten Termin.
  assert.equal(parse('Teamsitzung jeden Montag ab 5.10.').day, '2026-10-05');
});

test('Priorität: !, !! und !!! nur allein stehend', () => {
  assert.equal(parse('Offerte !').priority, 1);
  assert.equal(parse('!!! Offerte').priority, 3);
  const wow = parse('Wow!');
  assert.equal(wow.priority, 0);
  assert.equal(wow.title, 'Wow!');
  assert.equal(parse('Offerte !!!!').priority, 0);
});

test('Tags ohne Doppelte, Projekte nur bekannte', () => {
  const shopping = parse('Einkaufen #haushalt #Haushalt #wochenende');
  assert.deepEqual(shopping.tags, ['haushalt', 'wochenende']);
  assert.equal(shopping.day, null);
  const boxes = parse('@umzug Kisten packen');
  assert.equal(boxes.project, 'Umzug');
  assert.equal(boxes.title, 'Kisten packen');
  assert.equal(parse('Offerte @Haus-bauen').project, 'Haus bauen');
  const unknown = parse('Offerte @Unbekannt');
  assert.equal(unknown.project, null);
  assert.equal(unknown.title, 'Offerte @Unbekannt');
  assert.equal(parse('Mail an anna@example.ch').title, 'Mail an anna@example.ch');
  assert.equal(parse('Kiste #').title, 'Kiste #');
});

test('nur an Wortgrenzen', () => {
  assert.equal(parse('Morgenrot fotografieren').day, null);
  assert.equal(parse('heutejournal schauen').day, null);
  assert.equal(parse('am Morgen joggen').day, null);
  assert.equal(parse('Tagesmenü planen').repeat, null);
  assert.equal(parse('Milch 2.5 dl').day, null);
});

test('nur das erste Datum zählt, der Rest bleibt Text', () => {
  const result = parse('morgen oder übermorgen');
  assert.equal(result.day, '2026-09-17');
  assert.equal(result.title, 'oder übermorgen');
});

test('Kommas hinter erkannten Wörtern', () => {
  const result = parse('Steuererklärung, Freitag, 17 Uhr');
  assert.equal(result.title, 'Steuererklärung');
  assert.equal(result.day, '2026-09-18');
  assert.equal(result.time, '17:00');
});

test('Tokens tragen Position und Text', () => {
  const result = parse('Call morgen um 9');
  assert.deepEqual(
    result.tokens.map((token) => [token.kind, token.text, token.start]),
    [
      ['date', 'morgen', 5],
      ['time', 'um 9', 12],
    ],
  );
});

test('✕ hebt die Erkennung auf, die Wörter bleiben im Titel', () => {
  const text = 'Steuererklärung Freitag 17 Uhr';
  const when = chipsOf(parse(text)).find((chip) => chip.kind === 'when');
  assert.ok(when);
  const again = parse(text, { ignored: new Set(when.keys) });
  assert.equal(again.title, text);
  assert.equal(again.day, null);
  assert.equal(again.time, null);

  const meeting = 'Termin am Freitag';
  const first = parse(meeting);
  assert.equal(first.day, '2026-09-18');
  const without = parse(meeting, { ignored: new Set(first.tokens.map((token) => token.key)) });
  assert.equal(without.day, null);
  assert.equal(without.title, meeting);
});

test('✕ bei einem Tag lässt die anderen stehen', () => {
  const text = 'Einkaufen #haushalt #migros';
  const chips = chipsOf(parse(text));
  const migros = chips.find((chip) => chip.tag === 'migros');
  assert.ok(migros);
  const result = parse(text, { ignored: new Set(migros.keys) });
  assert.deepEqual(result.tags, ['haushalt']);
  assert.equal(result.title, 'Einkaufen #migros');
});
