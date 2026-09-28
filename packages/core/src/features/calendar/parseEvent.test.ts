import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hasEventParts, parseEventInput, quickPatch, type ParsedEvent } from './parseEvent';

/** Mittwoch, 23. September 2026, 10 Uhr. */
const NOW = new Date(2026, 8, 23, 10, 0);

function expect(text: string, wanted: Partial<ParsedEvent>) {
  const parsed = parseEventInput(text, NOW);
  const picked = Object.fromEntries(
    Object.keys(wanted).map((key) => [key, parsed[key as keyof ParsedEvent]]),
  );
  assert.deepEqual(picked, wanted, `„${text}“`);
}

test('parseEventInput: Tag und Uhrzeit ohne „um“', () => {
  expect('Zahnarzt morgen 9', {
    title: 'Zahnarzt',
    day: '2026-09-24',
    start: '09:00',
    end: null,
    location: null,
  });
  expect('Team-Meeting 24.9. 1830', { title: 'Team-Meeting', day: '2026-09-24', start: '18:30' });
  expect('Physio Freitag 8:15', { title: 'Physio', day: '2026-09-25', start: '08:15' });
  // Dieselbe Regel wie beim Assistenten: 1–7 Uhr ohne „früh“ ist Nachmittag.
  expect('Physio Freitag 7:15', { start: '19:15' });
  expect('Flug morgen früh um 6', { title: 'Flug', start: '06:00' });
});

test('parseEventInput: „um 3“ ist bei einem Termin am Nachmittag', () => {
  expect('Coiffeur Freitag um 3', { title: 'Coiffeur', day: '2026-09-25', start: '15:00' });
  expect('Mittagessen mit dem Team um 12', { title: 'Mittagessen mit dem Team', start: '12:00' });
  expect('Joggen morgen früh', { title: 'Joggen', day: '2026-09-24', start: '09:00' });
  expect('Kino heute Abend', { title: 'Kino', day: '2026-09-23', start: '18:00' });
  expect('Znacht bei Müllers morgen halb 7', {
    title: 'Znacht bei Müllers',
    day: '2026-09-24',
    start: '18:30',
  });
});

test('parseEventInput: Spannen', () => {
  expect('Essen mit Anna von 18 bis 20 Uhr', {
    title: 'Essen mit Anna',
    day: null,
    start: '18:00',
    end: '20:00',
  });
  expect('Sitzung morgen 15–17', { title: 'Sitzung', day: '2026-09-24', start: '15:00', end: '17:00' });
  expect('Sitzung morgen 15-17', { start: '15:00', end: '17:00' });
  expect('Training übermorgen zwischen 3 und 5', {
    title: 'Training',
    day: '2026-09-25',
    start: '15:00',
    end: '17:00',
  });
  expect('Besprechung 9:30 bis 11', { title: 'Besprechung', start: '09:30', end: '11:00' });
});

test('parseEventInput: @Ort', () => {
  expect('Elternabend am Dienstag 19:30 @Schulhaus Letzi', {
    title: 'Elternabend',
    day: '2026-09-29',
    start: '19:30',
    location: 'Schulhaus Letzi',
  });
  expect('Arzttermin nächsten Montag um 10 Uhr @Praxis_Dr_Meier', {
    title: 'Arzttermin',
    day: '2026-09-28',
    start: '10:00',
    location: 'Praxis Dr Meier',
  });
  expect('Zahnarzt morgen 9 @Bahnhofstrasse', {
    title: 'Zahnarzt',
    start: '09:00',
    location: 'Bahnhofstrasse',
  });
  expect('Treffen @', { title: 'Treffen @', location: null });
});

test('parseEventInput: ganztägig nur, wenn es dasteht', () => {
  expect('Ferien Tessin ganztägig am 3.10.', {
    title: 'Ferien Tessin',
    day: '2026-10-03',
    allDay: true,
    start: null,
  });
  expect('Grillfest den ganzen Tag am Samstag', {
    title: 'Grillfest',
    day: '2026-09-26',
    allDay: true,
  });
  expect('Umzug Samstag', { title: 'Umzug', day: '2026-09-26', allDay: false, start: null });
});

test('parseEventInput: was keine Uhrzeit ist, bleibt Titel', () => {
  expect('Einkaufen morgen 3 Bananen', {
    title: 'Einkaufen 3 Bananen',
    day: '2026-09-24',
    start: null,
  });
  expect('Velo 2-3 Stunden putzen', { start: null, end: null });
  // Ein Wochentag ohne „am“ zaehlt nur am Ende (wie in den Aufgaben).
  expect('Kaffee mit Frau Freitag im Büro', {
    title: 'Kaffee mit Frau Freitag im Büro',
    day: null,
  });
  expect('zahnarzt', { title: 'Zahnarzt' });
});

test('quickPatch: nur was sich aendert, Ende eine Stunde spaeter', () => {
  const at = (text: string) => parseEventInput(text, NOW);
  assert.deepEqual(quickPatch(at(''), at('Zahnarzt morgen 9')), {
    title: 'Zahnarzt',
    day: '2026-09-24',
    start: '09:00',
    end: '10:00',
  });
  // Weitertippen am Ort aendert Zeit und Tag nicht noch einmal.
  assert.deepEqual(quickPatch(at('Zahnarzt morgen 9'), at('Zahnarzt morgen 9 @Bern')), {
    location: 'Bern',
  });
  assert.deepEqual(quickPatch(at('Sitzung 15'), at('Sitzung 15–17')).end, '17:00');
  assert.deepEqual(quickPatch(at('Party um 23:30'), at('Party um 23:30')), {});
  assert.equal(quickPatch(at(''), at('Party morgen um 23:30')).end, '00:30');
  // Der Tag verschwindet aus dem Satz: das Datum bleibt, der Titel nicht.
  assert.deepEqual(quickPatch(at('Kino morgen'), at('Kino')), {});
  assert.deepEqual(quickPatch(at('Kino'), at('Kino ganztägig')), { allDay: true });
});

test('hasEventParts: nur wenn etwas die Felder fuellt', () => {
  assert.equal(hasEventParts(parseEventInput('Zahnarzt', NOW)), false);
  assert.equal(hasEventParts(parseEventInput('', NOW)), false);
  assert.equal(hasEventParts(parseEventInput('Zahnarzt morgen', NOW)), true);
  assert.equal(hasEventParts(parseEventInput('Zahnarzt @Bern', NOW)), true);
});
