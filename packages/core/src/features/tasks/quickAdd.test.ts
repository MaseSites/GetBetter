import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatTaskDay } from './format';
import { parseTaskInput } from './parse';
import {
  draftOf,
  lastWord,
  NO_DEFAULTS,
  replaceLastWord,
  suggestionsFor,
  tokenOf,
  type QuickAddDefaults,
} from './quickAdd';

const today = '2026-09-16';
const projects = [
  { id: 'p1', name: 'Umzug' },
  { id: 'p2', name: 'Haus bauen' },
];
const names = projects.map((project) => project.name);

const draft = (text: string, defaults: QuickAddDefaults = NO_DEFAULTS, manual = {}) =>
  draftOf(parseTaskInput(text, { today, projects: names }), manual, defaults, projects, today);

test('Heute gibt das Datum vor, der Satz schlägt es', () => {
  const inToday = { ...NO_DEFAULTS, day: today };
  assert.equal(draft('Einkaufen', inToday).day, today);
  assert.equal(draft('Einkaufen morgen', inToday).day, '2026-09-17');
  assert.equal(draft('Einkaufen', NO_DEFAULTS).day, null);
});

test('Uhrzeit ohne Tag gilt heute, mit Erinnerung zur Uhrzeit', () => {
  const result = draft('Call 14:30');
  assert.equal(result.day, today);
  assert.equal(result.time, '14:30');
  assert.equal(result.reminderOffsetMinutes, 0);
  assert.equal(draft('Call').reminderOffsetMinutes, null);
});

test('Die Leiste schlägt den Satz', () => {
  const result = draft('Call morgen 14:30 !', NO_DEFAULTS, {
    day: null,
    priority: 3,
    reminder: 15,
  });
  assert.equal(result.day, null);
  assert.equal(result.time, null);
  assert.equal(result.reminderOffsetMinutes, null);
  assert.equal(result.priority, 3);
  const later = draft('Call morgen 14:30', NO_DEFAULTS, { reminder: 15 });
  assert.equal(later.reminderOffsetMinutes, 15);
});

test('Projekt: aus dem Satz, sonst aus der Ansicht, mit Abschnitt nur dort', () => {
  const inProject = { day: null, projectId: 'p1', section: 'Vorbereitung' };
  const here = draft('Kisten kaufen', inProject);
  assert.equal(here.projectId, 'p1');
  assert.equal(here.section, 'Vorbereitung');
  const elsewhere = draft('Offerte @Haus-bauen', inProject);
  assert.equal(elsewhere.projectId, 'p2');
  assert.equal(elsewhere.section, null);
  assert.equal(draft('Kisten', inProject, { projectId: null }).projectId, null);
});

test('Wiederholung ohne Tag beginnt heute', () => {
  const result = draft('Zähne putzen jeden Tag');
  assert.equal(result.day, today);
  assert.equal(result.repeat?.unit, 'day');
  assert.equal(result.title, 'Zähne putzen');
});

test('Vorschläge für # und @', () => {
  assert.equal(lastWord('Einkaufen #hau'), '#hau');
  assert.equal(lastWord('Einkaufen '), '');
  assert.deepEqual(suggestionsFor('Einkaufen #hau', ['haushalt', 'Hausbau', 'post'], names), [
    { kind: 'tag', value: 'haushalt' },
    { kind: 'tag', value: 'Hausbau' },
  ]);
  assert.deepEqual(suggestionsFor('Offerte @ha', [], names), [
    { kind: 'project', value: 'Haus bauen' },
  ]);
  assert.deepEqual(suggestionsFor('Offerte @umzug', [], names), []);
  assert.deepEqual(suggestionsFor('Offerte', ['a'], names), []);
  assert.equal(
    replaceLastWord('Offerte @ha', tokenOf({ kind: 'project', value: 'Haus bauen' })),
    'Offerte @Haus-bauen ',
  );
});

test('Datum kurz: Fr 18. Sep', () => {
  assert.equal(formatTaskDay('de', '2026-09-18'), 'Fr 18. Sep');
  assert.equal(formatTaskDay('de', '2026-03-02'), 'Mo 2. Mär');
});
