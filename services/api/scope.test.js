'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { mergeCollection, visibleTables } = require('./scope.js');

/** Anna und Ben teilen einen Haushalt; Cleo hat Anna ihren Kalender freigegeben; Dan ist fremd. */
function world() {
  return {
    accounts: [
      {
        id: 'anna',
        email: 'anna@test.ch',
        username: 'anna',
        firstName: 'Anna',
        passwordHash: 'h',
        createdAt: '2026-01-01',
      },
      {
        id: 'ben',
        email: 'ben@test.ch',
        username: 'ben',
        firstName: 'Ben',
        createdAt: '2026-01-02',
      },
      {
        id: 'cleo',
        email: 'cleo@test.ch',
        username: 'cleo',
        firstName: 'Cleo',
        createdAt: '2026-01-03',
      },
      {
        id: 'dan',
        email: 'dan@test.ch',
        username: 'dan',
        firstName: 'Dan',
        createdAt: '2026-01-04',
      },
    ],
    households: [
      { id: 'h1', name: 'Zuhause', createdBy: 'ben', inviteCode: 'ABCDEF' },
      { id: 'h2', name: 'WG Dan', createdBy: 'dan', inviteCode: 'GHJKLM' },
    ],
    householdMembers: [
      { id: 'm1', householdId: 'h1', accountId: 'ben', role: 'admin', status: 'accepted' },
      { id: 'm2', householdId: 'h1', accountId: 'anna', role: 'member', status: 'accepted' },
      { id: 'm3', householdId: 'h2', accountId: 'dan', role: 'admin', status: 'accepted' },
    ],
    calendars: [{ id: 'c1', ownerId: 'dan', name: 'Verein' }],
    calendarMembers: [{ id: 'cm1', calendarId: 'c1', accountId: 'dan', status: 'accepted' }],
    calendarShares: [{ id: 's1', ownerId: 'cleo', viewerId: 'anna', status: 'accepted' }],
    events: [
      { id: 'e-anna', accountId: 'anna', householdId: null, calendarId: null, isPrivate: false },
      { id: 'e-house', accountId: 'ben', householdId: 'h1', calendarId: null, isPrivate: false },
      {
        id: 'e-ben-private',
        accountId: 'ben',
        householdId: null,
        calendarId: null,
        isPrivate: true,
      },
      { id: 'e-ben-open', accountId: 'ben', householdId: null, calendarId: null, isPrivate: false },
      {
        id: 'e-cleo-open',
        accountId: 'cleo',
        householdId: null,
        calendarId: null,
        isPrivate: false,
      },
      {
        id: 'e-cleo-private',
        accountId: 'cleo',
        householdId: null,
        calendarId: null,
        isPrivate: true,
      },
      { id: 'e-dan', accountId: 'dan', householdId: null, calendarId: 'c1', isPrivate: false },
    ],
    tasks: [
      { id: 't-anna', accountId: 'anna', title: 'meins' },
      { id: 't-dan', accountId: 'dan', title: 'fremd' },
    ],
    shoppingItems: [
      { id: 'sh-house', accountId: 'ben', householdId: 'h1', name: 'Milch' },
      { id: 'sh-dan', accountId: 'dan', householdId: 'h2', name: 'Bier' },
    ],
    trips: [{ id: 'tr-dan', accountId: 'dan', name: 'Rom' }],
    packingItems: [{ id: 'p-dan', tripId: 'tr-dan', name: 'Pass' }],
    mailAccounts: [{ id: 'ma-anna', accountId: 'anna', email: 'anna@test.ch' }],
    mailMessages: [
      { id: 'mm-anna', mailAccountId: 'ma-anna', accountId: 'anna', subject: 'Hallo' },
      { id: 'mm-dan', mailAccountId: 'ma-dan', accountId: 'dan', subject: 'Fremd' },
    ],
    notifications: [
      { id: 'n-anna', accountId: 'anna', kind: 'x' },
      { id: 'n-dan', accountId: 'dan', kind: 'x' },
    ],
    stray: [{ id: 'no-owner', name: 'ohne Besitzer' }],
  };
}

const ids = (rows) => rows.map((row) => row.id).sort();

test('visibleTables: Anna sieht sich, ihren Haushalt, die Freigabe — und sonst nichts', () => {
  const seen = visibleTables(world(), 'anna');
  // Konten: sich selbst ganz, Ben und Cleo nur oeffentlich, Dan gar nicht.
  assert.deepEqual(ids(seen.accounts), ['anna', 'ben', 'cleo']);
  const ben = seen.accounts.find((row) => row.id === 'ben');
  assert.deepEqual(Object.keys(ben).sort(), ['createdAt', 'firstName', 'id', 'username']);
  assert.equal(seen.accounts.find((row) => row.id === 'anna').email, 'anna@test.ch');

  assert.deepEqual(ids(seen.households), ['h1']);
  assert.deepEqual(ids(seen.householdMembers), ['m1', 'm2']);
  assert.deepEqual(ids(seen.calendars), []);
  assert.deepEqual(ids(seen.calendarShares), ['s1']);
  // Termine: eigene, die des Haushalts, Bens und Cleos nicht private — nie Dans Vereinskalender.
  assert.deepEqual(ids(seen.events), ['e-anna', 'e-ben-open', 'e-cleo-open', 'e-house']);
  assert.deepEqual(ids(seen.tasks), ['t-anna']);
  assert.deepEqual(ids(seen.shoppingItems), ['sh-house']);
  assert.deepEqual(ids(seen.packingItems), []);
  assert.deepEqual(ids(seen.mailMessages), ['mm-anna']);
  assert.deepEqual(ids(seen.notifications), ['n-anna']);
  assert.deepEqual(ids(seen.stray), []);
});

test('visibleTables: Dan sieht seinen Kalender samt Terminen und seine Kinderzeilen', () => {
  const seen = visibleTables(world(), 'dan');
  assert.deepEqual(ids(seen.accounts), ['dan']);
  assert.deepEqual(ids(seen.events), ['e-dan']);
  assert.deepEqual(ids(seen.packingItems), ['p-dan']);
  assert.deepEqual(ids(seen.households), ['h2']);
});

test('mergeCollection: die App ersetzt nur, was sie sieht — Fremdes bleibt, Untergeschobenes faellt weg', () => {
  const tables = world();
  const merged = mergeCollection(tables, 'tasks', 'anna', [
    { id: 't-anna', accountId: 'anna', title: 'geaendert' },
    { id: 't-neu', accountId: 'anna', title: 'neu' },
    // Versucht, Dans Aufgabe zu ueberschreiben und ihm eine unterzuschieben.
    { id: 't-dan', accountId: 'dan', title: 'gekapert' },
    { id: 't-fremd', accountId: 'dan', title: 'untergeschoben' },
  ]);
  assert.deepEqual(merged.map((row) => [row.id, row.title]).sort(), [
    ['t-anna', 'geaendert'],
    ['t-dan', 'fremd'],
    ['t-neu', 'neu'],
  ]);
  // Weglassen heisst loeschen — aber nur bei Eigenem.
  assert.deepEqual(ids(mergeCollection(tables, 'tasks', 'anna', [])), ['t-dan']);
});

test('mergeCollection: Haushalt und erste Mitgliedschaft darf man selbst anlegen, fremde nicht', () => {
  const tables = world();
  const households = mergeCollection(tables, 'households', 'anna', [
    ...tables.households.filter((row) => row.id === 'h1'),
    { id: 'h-neu', name: 'Neu', createdBy: 'anna', inviteCode: 'NPQRST' },
    { id: 'h-fremd', name: 'Fremd', createdBy: 'dan', inviteCode: 'UVWXYZ' },
    { id: 'h2', name: 'gekapert', createdBy: 'anna', inviteCode: 'GHJKLM' },
  ]);
  assert.deepEqual(ids(households), ['h-neu', 'h1', 'h2']);
  assert.equal(households.find((row) => row.id === 'h2').name, 'WG Dan');

  const withNew = { ...tables, households };
  const members = mergeCollection(withNew, 'householdMembers', 'anna', [
    ...tables.householdMembers.filter((row) => row.householdId === 'h1'),
    { id: 'm-neu', householdId: 'h-neu', accountId: 'anna', role: 'admin', status: 'accepted' },
    { id: 'm-dan', householdId: 'h2', accountId: 'anna', role: 'admin', status: 'accepted' },
  ]);
  assert.deepEqual(ids(members), ['m-neu', 'm1', 'm2', 'm3']);
});

test('mergeCollection: keine Freigabe an sich selbst, kein Termin im Kalender eines anderen', () => {
  const tables = world();
  const shares = mergeCollection(tables, 'calendarShares', 'anna', [
    ...tables.calendarShares,
    // Anfragen darf sie — erteilen nicht.
    { id: 's-ask', ownerId: 'dan', viewerId: 'anna', status: 'pending' },
    { id: 's-grab', ownerId: 'dan', viewerId: 'anna', status: 'accepted' },
    { id: 's-give', ownerId: 'anna', viewerId: 'dan', status: 'accepted' },
  ]);
  assert.deepEqual(ids(shares), ['s-ask', 's-give', 's1']);

  const events = mergeCollection(tables, 'events', 'anna', [
    ...visibleTables(tables, 'anna').events,
    { id: 'e-neu', accountId: 'anna', householdId: null, calendarId: null, isPrivate: false },
    { id: 'e-in-house', accountId: 'anna', householdId: 'h1', calendarId: null, isPrivate: false },
    { id: 'e-as-ben', accountId: 'ben', householdId: null, calendarId: null, isPrivate: false },
    { id: 'e-in-c1', accountId: 'anna', householdId: null, calendarId: 'c1', isPrivate: false },
  ]);
  assert.deepEqual(ids(events), [
    'e-anna',
    'e-ben-open',
    'e-ben-private',
    'e-cleo-open',
    'e-cleo-private',
    'e-dan',
    'e-house',
    'e-in-house',
    'e-neu',
  ]);
});

test('mergeCollection: Konten — nur die eigene Zeile, und die geht nie verloren', () => {
  const tables = world();
  const merged = mergeCollection(tables, 'accounts', 'anna', [
    {
      id: 'anna',
      email: 'anna@test.ch',
      username: 'anna',
      firstName: 'Änni',
      createdAt: '2026-01-01',
    },
    {
      id: 'ben',
      email: 'ben@test.ch',
      username: 'ben',
      firstName: 'Hacker',
      createdAt: '2026-01-02',
    },
  ]);
  assert.equal(merged.find((row) => row.id === 'anna').firstName, 'Änni');
  assert.equal(merged.find((row) => row.id === 'ben').firstName, 'Ben');
  assert.equal(merged.length, 4);
  assert.equal(
    mergeCollection(tables, 'accounts', 'anna', []).some((row) => row.id === 'anna'),
    true,
  );
});
