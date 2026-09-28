import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filterChats, sortChats } from './chatList';

const chats = [
  { id: 'a', title: 'Rezept für Rösti', updatedAt: '2026-09-20T10:00:00Z' },
  { id: 'b', title: 'Ferien planen', updatedAt: '2026-09-24T10:00:00Z' },
  {
    id: 'c',
    title: 'Steuern',
    updatedAt: '2026-09-10T10:00:00Z',
    pinnedAt: '2026-09-22T10:00:00Z',
  },
];
const messages = [
  { chatId: 'b', text: 'Wir wollen nach Lissabon' },
  { chatId: 'a', text: 'Mit Käse bitte' },
];

test('angeheftete zuerst, dann das Neueste', () => {
  assert.deepEqual(
    sortChats(chats).map((chat) => chat.id),
    ['c', 'b', 'a'],
  );
});

test('unter mehreren Angehefteten steht das zuletzt Angeheftete vorne', () => {
  const pinned = [
    { id: 'x', title: '', updatedAt: '2026-09-25T00:00:00Z', pinnedAt: '2026-09-01T00:00:00Z' },
    { id: 'y', title: '', updatedAt: '2026-09-01T00:00:00Z', pinnedAt: '2026-09-02T00:00:00Z' },
  ];
  assert.deepEqual(
    sortChats(pinned).map((chat) => chat.id),
    ['y', 'x'],
  );
});

test('sucht im Titel und in den Nachrichten, ohne Akzente und Gross/klein', () => {
  assert.deepEqual(
    filterChats(chats, messages, 'rosti').map((chat) => chat.id),
    ['a'],
  );
  assert.deepEqual(
    filterChats(chats, messages, 'LISSABON').map((chat) => chat.id),
    ['b'],
  );
  assert.deepEqual(
    filterChats(chats, messages, 'käse rezept').map((chat) => chat.id),
    ['a'],
  );
  assert.deepEqual(filterChats(chats, messages, 'käse ferien'), []);
});

test('leere Suche: alle, sortiert', () => {
  assert.equal(filterChats(chats, messages, '   ').length, 3);
});
