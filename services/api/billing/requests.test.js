/** Abo-Anfragen, die reinen Teile — die Routen prueft test/server.test.js. */
const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { decideRows, pendingRequests, settleRequests } = require('./requests.js');

const AT = '2026-09-14T10:00:00.000Z';

const tables = () => ({
  accounts: [
    { id: 'acc_a', email: 'a@test.ch', username: 'anna', firstName: 'Anna', paidApps: ['bettergym'] },
    { id: 'acc_b', email: 'b@test.ch', username: 'ben' },
  ],
  planRequests: [
    { id: 'r3', accountId: 'acc_a', app: 'betterai', status: 'pending', createdAt: '2026-09-13T09:00:00.000Z', decidedAt: null },
    { id: 'r1', accountId: 'acc_a', app: 'getbetter', status: 'pending', createdAt: '2026-09-12T09:00:00.000Z', decidedAt: null },
    { id: 'r2', accountId: 'acc_b', app: 'getbetter', status: 'declined', createdAt: '2026-09-11T09:00:00.000Z', decidedAt: AT },
    { id: 'r4', accountId: 'acc_weg', app: 'getbetter', status: 'pending', createdAt: '2026-09-10T09:00:00.000Z', decidedAt: null },
    { id: 'r5', accountId: 'acc_b', app: 'bettergym', status: 'pending', createdAt: '2026-09-14T08:00:00.000Z', decidedAt: null },
  ],
  notifications: [{ id: 'n0', accountId: 'acc_b', kind: 'mail' }],
});

describe('Abo-Anfragen', () => {
  test('pendingRequests: offen, mit Konto, die aelteste zuerst', () => {
    assert.deepEqual(
      pendingRequests(tables()).map((row) => [row.id, row.email, row.username, row.app]),
      [
        ['r1', 'a@test.ch', 'anna', 'getbetter'],
        ['r3', 'a@test.ch', 'anna', 'betterai'],
        ['r5', 'b@test.ch', 'ben', 'bettergym'],
      ],
    );
    assert.deepEqual(pendingRequests(tables(), 'acc_b').map((row) => row.id), ['r5']);
    assert.deepEqual(pendingRequests({}), []);
    assert.deepEqual(Object.keys(pendingRequests(tables())[0]).sort(), [
      'accountId',
      'app',
      'createdAt',
      'email',
      'firstName',
      'id',
      'username',
    ]);
  });

  test('decideRows: freischalten traegt die App einmal ein, mit Mitteilung', () => {
    const before = tables();
    const request = before.planRequests[1];
    const approved = decideRows(before, request, 'approve', AT);
    assert.deepEqual(approved.accounts[0].paidApps, ['bettergym', 'getbetter']);
    assert.deepEqual(approved.request, { ...request, status: 'approved', decidedAt: AT });
    assert.equal(approved.planRequests.find((row) => row.id === 'r1').status, 'approved');
    const notice = approved.notifications.at(-1);
    assert.deepEqual(
      [notice.accountId, notice.kind, notice.title, notice.body, notice.ref, notice.app, notice.createdAt, notice.readAt],
      ['acc_a', 'planApproved', 'GetBetter', '', { app: 'getbetter', requestId: 'r1' }, 'getbetter', AT, null],
    );
    // Die Eingabe bleibt, wie sie war.
    assert.equal(before.planRequests[1].status, 'pending');
    assert.deepEqual(before.accounts[0].paidApps, ['bettergym']);

    const twice = decideRows(approved, { ...request, id: 'r1' }, 'approve', AT);
    assert.deepEqual(twice.accounts[0].paidApps, ['bettergym', 'getbetter']);

    const declined = decideRows(tables(), tables().planRequests[4], 'decline', AT);
    assert.equal(declined.accounts[1].paidApps, undefined);
    assert.equal(declined.request.status, 'declined');
    assert.deepEqual([declined.notifications.at(-1).kind, declined.notifications.at(-1).title], ['planDeclined', 'BetterGym']);
  });

  test('settleRequests: der Abo-Schalter erledigt nur offene Anfragen dieser Apps', () => {
    const settled = settleRequests(tables(), 'acc_a', ['getbetter', 'bettermoney'], AT);
    assert.deepEqual(settled.settled.map((row) => row.id), ['r1']);
    assert.deepEqual(
      settled.planRequests.map((row) => [row.id, row.status]),
      [['r3', 'pending'], ['r1', 'approved'], ['r2', 'declined'], ['r4', 'pending'], ['r5', 'pending']],
    );
    assert.deepEqual(settled.notifications.map((row) => row.kind), ['mail', 'planApproved']);

    const nothing = settleRequests(tables(), 'acc_b', ['getbetter'], AT);
    assert.deepEqual([nothing.settled, nothing.notifications.length], [[], 1]);
  });
});
