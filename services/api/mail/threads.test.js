const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { assignThreads, normaliseSubject, threadIdsOf } = require('./threads.js');

const ME = 'user@example.ch';

let counter = 0;
const mail = (overrides = {}) => {
  counter += 1;
  return {
    id: `mm_${counter}`,
    accountId: 'acc_1',
    messageId: `<m${counter}@x>`,
    inReplyTo: null,
    references: [],
    from: { name: 'Anna', address: 'anna@example.ch' },
    to: [{ name: '', address: ME }],
    cc: [],
    subject: 'Offerte Maler',
    date: `2026-09-${String(10 + (counter % 15)).padStart(2, '0')}T09:00:00.000Z`,
    ...overrides,
  };
};

const own = { ownAddresses: new Set([ME]) };

describe('normaliseSubject', () => {
  test('strips reply and forward prefixes in several languages', () => {
    for (const subject of [
      'Offerte Maler',
      'Re: Offerte Maler',
      'AW: Offerte Maler',
      'RE: AW: Fwd: Offerte  Maler',
      'WG: Offerte Maler',
      'TR : Offerte Maler',
      'Fw: Re[2]: Offerte Maler',
    ]) {
      assert.equal(normaliseSubject(subject), 'offerte maler', subject);
    }
    assert.equal(normaliseSubject('Treffen: Montag'), 'treffen: montag');
    assert.equal(normaliseSubject('Reisen'), 'reisen');
  });
});

describe('threadIdsOf', () => {
  test('groups a thread by its root in References, across folders', () => {
    const root = mail({ messageId: '<root@x>' });
    const reply = mail({
      messageId: '<r1@x>',
      inReplyTo: '<root@x>',
      references: ['<root@x>'],
      subject: 'Re: Offerte Maler',
      from: { name: '', address: ME },
      to: [{ name: 'Anna', address: 'anna@example.ch' }],
      folder: 'Sent',
    });
    const answer = mail({
      messageId: '<r2@x>',
      inReplyTo: '<r1@x>',
      references: ['<root@x>', '<r1@x>'],
      subject: 'AW: Offerte Maler',
    });
    const other = mail({ messageId: '<solo@x>', subject: 'Etwas anderes' });
    const ids = threadIdsOf([answer, other, reply, root], own);
    assert.match(ids.get(root.id), /^th_[a-f0-9]{24}$/);
    assert.equal(ids.get(reply.id), ids.get(root.id));
    assert.equal(ids.get(answer.id), ids.get(root.id));
    assert.notEqual(ids.get(other.id), ids.get(root.id));
  });

  test('follows In-Reply-To through known mail when References are missing', () => {
    const root = mail({ messageId: '<a@x>' });
    const middle = mail({ messageId: '<b@x>', inReplyTo: '<a@x>', subject: 'Re: Offerte Maler' });
    const last = mail({ messageId: '<c@x>', inReplyTo: '<b@x>', subject: 'Re: Offerte Maler' });
    const ids = threadIdsOf([last, middle, root], own);
    assert.equal(ids.get(middle.id), ids.get(root.id));
    assert.equal(ids.get(last.id), ids.get(root.id));
  });

  test('uses an unknown parent as root, so later replies still meet', () => {
    const one = mail({ inReplyTo: '<weg@x>', subject: 'Re: Alt' });
    const two = mail({ references: ['<weg@x>', '<zwischen@x>'], subject: 'Re: Alt' });
    const ids = threadIdsOf([one, two], own);
    assert.equal(ids.get(one.id), ids.get(two.id));
  });

  test('survives a loop in In-Reply-To', () => {
    const a = mail({ messageId: '<loop-a@x>', inReplyTo: '<loop-b@x>' });
    const b = mail({ messageId: '<loop-b@x>', inReplyTo: '<loop-a@x>' });
    const ids = threadIdsOf([a, b], own);
    assert.equal(ids.size, 2);
    assert.equal(ids.get(a.id), ids.get(b.id));
  });

  test('falls back to the subject for replies without headers', () => {
    const original = mail({ messageId: '<orig@x>', subject: 'Znacht am Freitag' });
    const bare = mail({ messageId: '<bare@x>', subject: 'Re: Znacht am Freitag' });
    const stranger = mail({
      messageId: '<fremd@x>',
      subject: 'AW: Znacht am Freitag',
      from: { name: 'Zoe', address: 'zoe@example.ch' },
    });
    const ids = threadIdsOf([bare, stranger, original], own);
    assert.equal(ids.get(bare.id), ids.get(original.id));
    // Gleicher Betreff, aber niemand gemeinsam ausser mir selbst: eigene Unterhaltung.
    assert.notEqual(ids.get(stranger.id), ids.get(original.id));
  });

  test('hashes subject and participants when nothing else is there', () => {
    const one = mail({ messageId: null, subject: 'Re: Ohne Kopf' });
    const two = mail({
      messageId: null,
      subject: 'Ohne Kopf',
      from: { name: '', address: ME },
      to: [{ name: '', address: 'anna@example.ch' }],
    });
    const ids = threadIdsOf([one, two], own);
    assert.equal(ids.get(one.id), ids.get(two.id));
    assert.match(ids.get(one.id), /^th_[a-f0-9]{24}$/);
  });

  test('gives the same id no matter the order', () => {
    const rows = [
      mail({ messageId: '<o1@x>' }),
      mail({ messageId: '<o2@x>', references: ['<o1@x>'] }),
      mail({ messageId: '<o3@x>', subject: 'Re: Offerte Maler' }),
    ];
    const forward = threadIdsOf(rows, own);
    const backward = threadIdsOf([...rows].reverse(), own);
    for (const row of rows) assert.equal(forward.get(row.id), backward.get(row.id));
  });
});

describe('assignThreads', () => {
  test('sets threadId on one account only and counts changes', () => {
    const root = mail({ messageId: '<t1@x>' });
    const reply = mail({ messageId: '<t2@x>', references: ['<t1@x>'] });
    const foreign = mail({ accountId: 'acc_2', threadId: 'th_fremd' });
    const first = assignThreads([root, reply, foreign], { accountId: 'acc_1', ...own });
    assert.equal(first.changed, 2);
    assert.equal(first.rows[0].threadId, first.rows[1].threadId);
    assert.equal(first.rows[2], foreign);
    assert.equal(root.threadId, undefined, 'rows are copied, not changed');

    const again = assignThreads(first.rows, { accountId: 'acc_1', ...own });
    assert.equal(again.changed, 0);
  });
});
