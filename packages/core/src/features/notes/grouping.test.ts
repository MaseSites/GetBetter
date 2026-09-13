import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupOf, rowStampOf, sectionNotes, sortNotes } from './grouping';

/** Ortszeit, damit die Tests in jeder Zeitzone dieselben Tage meinen. */
function at(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

const now = new Date(2026, 8, 13, 9, 14);

function note(id: string, updated: string, extra: { pinned?: boolean; title?: string } = {}) {
  return {
    id,
    title: extra.title ?? id,
    pinned: extra.pinned,
    createdAt: at(2020, 1, 1),
    updatedAt: updated,
  };
}

test('Gruppen: heute, letzte 7 Tage, Monat, Jahr', () => {
  assert.deepEqual(groupOf(at(2026, 9, 13, 0), now), { kind: 'today' });
  assert.deepEqual(groupOf(at(2026, 9, 12), now), { kind: 'week' });
  assert.deepEqual(groupOf(at(2026, 9, 6), now), { kind: 'week' });
  assert.deepEqual(groupOf(at(2026, 9, 5), now), { kind: 'month', year: 2026, month: 8 });
  assert.deepEqual(groupOf(at(2026, 2, 1), now), { kind: 'month', year: 2026, month: 1 });
  assert.deepEqual(groupOf(at(2025, 12, 31), now), { kind: 'year', year: 2025 });
  // Eine Uhr, die vorgeht, macht keine Zukunft: das ist heute.
  assert.deepEqual(groupOf(at(2026, 9, 14), now), { kind: 'today' });
});

test('Abschnitte: Angeheftete zuerst, dann nach Datum', () => {
  const sections = sectionNotes(
    [
      note('alt', at(2025, 3, 3)),
      note('heute', at(2026, 9, 13, 8)),
      note('pin', at(2024, 1, 1), { pinned: true }),
      note('gestern', at(2026, 9, 12)),
      note('sept', at(2026, 9, 1)),
      note('frueh', at(2026, 9, 13, 7)),
    ],
    { sort: 'edited', groupByDate: true, now },
  );
  assert.deepEqual(
    sections.map((section) => [section.key, section.notes.map((entry) => entry.id)]),
    [
      ['pinned', ['pin']],
      ['today', ['heute', 'frueh']],
      ['week', ['gestern']],
      ['month-2026-8', ['sept']],
      ['year-2025', ['alt']],
    ],
  );
});

test('Abschnitte: nach Titel oder ohne Gruppieren ein einziger Block', () => {
  const notes = [note('b', at(2026, 9, 13)), note('a', at(2025, 1, 1))];
  assert.deepEqual(
    sectionNotes(notes, { sort: 'title', groupByDate: true, now }).map((section) => section.key),
    ['all'],
  );
  assert.deepEqual(
    sectionNotes(notes, { sort: 'edited', groupByDate: false, now })[0]?.notes.map((n) => n.id),
    ['b', 'a'],
  );
  assert.deepEqual(sectionNotes([], { sort: 'edited', groupByDate: true, now }), []);
});

test('Sortieren nach Titel: ohne Titel ans Ende', () => {
  const sorted = sortNotes(
    [
      note('x', at(2026, 1, 1), { title: '' }),
      note('y', at(2026, 1, 1), { title: 'Zug' }),
      note('z', at(2026, 1, 1), { title: 'Apfel' }),
    ],
    'title',
  );
  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ['z', 'y', 'x'],
  );
});

test('Zeitstempel einer Zeile', () => {
  assert.equal(rowStampOf(at(2026, 9, 13, 8), now), 'time');
  assert.equal(rowStampOf(at(2026, 9, 12, 23), now), 'yesterday');
  assert.equal(rowStampOf(at(2026, 9, 8), now), 'weekday');
  assert.equal(rowStampOf(at(2026, 9, 3), now), 'date');
});
