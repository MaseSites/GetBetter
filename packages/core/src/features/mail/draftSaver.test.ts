import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { MailDraftInput } from '../../db/mail';
import { DraftSaver } from './draftSaver';

const input = (draftId: string | null): MailDraftInput => ({
  accountId: 'acc',
  mailAccountId: 'ma_1',
  to: [],
  subject: 'Offerte',
  text: '',
  ...(draftId ? { draftId } : {}),
});

test('sichert nur Neues, der Reihe nach, und gibt die letzte draftId weiter', async () => {
  const calls: (string | undefined)[] = [];
  let counter = 0;
  const saver = new DraftSaver(async (draft) => {
    calls.push(draft.draftId);
    counter += 1;
    return { ok: true, data: { draftId: `dft_${counter}` } };
  });

  await Promise.all([saver.save('a', input), saver.save('a', input), saver.save('b', input)]);
  assert.deepEqual(calls, [undefined, 'dft_1']);
  assert.equal(saver.id, 'dft_2');
});

test('nach finish wird nichts mehr gesichert, die laufende zaehlt noch', async () => {
  const saver = new DraftSaver(async () => ({ ok: true, data: { draftId: 'dft_9' } }));
  const pending = saver.save('a', input);
  assert.equal(await saver.finish(), 'dft_9');
  assert.equal(await pending, true);
  assert.equal(await saver.save('b', () => assert.fail('darf nicht sichern')), true);
  saver.resume();
  saver.reset('mm_draft', 'b');
  assert.equal(saver.id, 'mm_draft');
});

test('ein Fehler laesst den Stand ungesichert, ohne Postfach wird nicht gesichert', async () => {
  const saver = new DraftSaver(async () => ({ ok: false, error: 'offline' }));
  assert.equal(await saver.save('a', input), false);
  assert.equal(await saver.save('a', () => null), false);
  assert.equal(saver.id, null);
});
