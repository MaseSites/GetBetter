import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { NoteBlock } from '../../db/types';
import { NoteDraft, SAVE_DELAY_MS, type DraftStore, type DraftTimers } from './draft';

function fakeStore() {
  const calls: string[] = [];
  const store: DraftStore = {
    create: async (blocks) => {
      calls.push(`create:${blocks[0]?.text ?? ''}`);
      return 'nt_1';
    },
    save: async (id, blocks) => {
      calls.push(`save:${id}:${blocks[0]?.text ?? ''}`);
    },
    discard: async (id) => {
      calls.push(`discard:${id}`);
    },
  };
  return { store, calls };
}

function fakeTimers() {
  let pending: { run: () => void; ms: number } | null = null;
  const timers: DraftTimers = {
    set: (run, ms) => {
      pending = { run, ms };
      return pending;
    },
    clear: (handle) => {
      if (handle === pending) pending = null;
    },
  };
  return {
    timers,
    fire: () => {
      const current = pending;
      pending = null;
      current?.run();
    },
    delay: () => pending?.ms ?? null,
  };
}

const text = (value: string): NoteBlock[] => [{ id: 'a', kind: 'title', text: value }];

test('Entwurf: neue Notiz entsteht erst mit dem ersten Zeichen', async () => {
  const { store, calls } = fakeStore();
  const clock = fakeTimers();
  const draft = new NoteDraft({ store, noteId: null, timers: clock.timers });

  draft.change(text(''));
  assert.equal(await draft.commit(), null);
  assert.deepEqual(calls, []);

  // Was bis zum Anlegen noch getippt wird, kommt gleich mit.
  draft.change(text('E'));
  draft.change(text('Ei'));
  assert.equal(await draft.commit(), 'nt_1');
  assert.deepEqual(calls, ['create:Ei']);

  draft.change(text('Eis'));
  await draft.commit();
  assert.deepEqual(calls, ['create:Ei', 'save:nt_1:Eis']);
});

test('Entwurf: sichert 500 ms nach der letzten Eingabe', async () => {
  const { store, calls } = fakeStore();
  const clock = fakeTimers();
  const draft = new NoteDraft({ store, noteId: 'nt_9', timers: clock.timers });

  draft.change(text('a'));
  draft.change(text('ab'));
  assert.equal(clock.delay(), SAVE_DELAY_MS);
  assert.deepEqual(calls, []);
  clock.fire();
  await draft.commit();
  assert.deepEqual(calls, ['save:nt_9:ab']);
});

test('Entwurf: eine neue, leer gebliebene Notiz verschwindet beim Verlassen', async () => {
  const { store, calls } = fakeStore();
  const clock = fakeTimers();
  const draft = new NoteDraft({ store, noteId: null, timers: clock.timers });

  const created: string[] = [];
  const counted = new NoteDraft({
    store,
    noteId: null,
    timers: clock.timers,
    onCreated: (id) => created.push(id),
  });
  counted.change(text('x'));
  await counted.commit();
  counted.change(text(''));
  await counted.leave();
  assert.deepEqual(calls, ['create:x', 'save:nt_1:', 'discard:nt_1']);
  assert.deepEqual(created, ['nt_1']);
  assert.equal(counted.id, null);

  // Wieder geleert, bevor gesichert wurde: es entsteht gar nichts.
  draft.change(text('y'));
  draft.change(text(''));
  await draft.leave();
  assert.equal(calls.length, 3);
});

test('Entwurf: eine bestehende Notiz bleibt, auch leer', async () => {
  const { store, calls } = fakeStore();
  const clock = fakeTimers();
  const draft = new NoteDraft({ store, noteId: 'nt_9', timers: clock.timers });

  await draft.leave();
  assert.deepEqual(calls, []);
  draft.change(text(''));
  await draft.leave();
  assert.deepEqual(calls, ['save:nt_9:']);
});

test('Entwurf: Fehler beim Sichern gehen an onError', async () => {
  const errors: unknown[] = [];
  const clock = fakeTimers();
  const draft = new NoteDraft({
    store: {
      create: async () => {
        throw new Error('offline');
      },
      save: async () => undefined,
      discard: async () => undefined,
    },
    noteId: null,
    timers: clock.timers,
    onError: (error) => errors.push(error),
  });
  draft.change(text('x'));
  assert.equal(await draft.commit(), null);
  assert.equal(errors.length, 1);
});
