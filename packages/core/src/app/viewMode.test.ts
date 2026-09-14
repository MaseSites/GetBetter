import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
  REDEEM_PATH,
  allowedInView,
  beginViewing,
  isViewing,
  onReadOnlyAttempt,
  onViewChange,
  reportReadOnly,
  resetViewModeForTests,
  viewFailed,
  viewHeaders,
  viewState,
  viewTicketOf,
  viewingAccount,
  withoutViewParam,
  writesAllowed,
} from './viewMode';

const TICKET = 'a1'.repeat(32);

beforeEach(() => resetViewModeForTests());

test('viewTicketOf: nur 64 Hex-Zeichen unter ?view= gelten', () => {
  assert.equal(viewTicketOf(`?view=${TICKET}`), TICKET);
  assert.equal(viewTicketOf(`view=${TICKET}&x=1`), TICKET);
  assert.equal(viewTicketOf(`?x=1&view=${TICKET}`), TICKET);
  for (const search of ['', '?', '?view=', '?view=abc', `?view=${TICKET.toUpperCase()}`, `?view=${TICKET}0`, `?other=${TICKET}`]) {
    assert.equal(viewTicketOf(search), null, search);
  }
  assert.equal(viewTicketOf(null), null);
  assert.equal(viewTicketOf(undefined), null);
});

test('withoutViewParam: das Ticket verschwindet aus der Adresse, der Rest bleibt', () => {
  assert.equal(withoutViewParam(`http://localhost:8081/?view=${TICKET}`), '/');
  assert.equal(withoutViewParam(`http://localhost:8081/run/tasks?view=${TICKET}&task=t1#oben`), '/run/tasks?task=t1#oben');
  assert.equal(withoutViewParam('kein url'), 'kein url');
});

test('allowedInView: nur Lesen und das Einloesen gehen hinaus', () => {
  assert.equal(allowedInView('GET', '/v1/db'), true);
  assert.equal(allowedInView(undefined, '/v1/mail/messages/m1/body'), true);
  assert.equal(allowedInView('head', '/v1/health'), true);
  assert.equal(allowedInView('POST', REDEEM_PATH), true);
  assert.equal(allowedInView('POST', `${REDEEM_PATH}?x=1`), true);
  for (const [method, path] of [
    ['POST', '/v1/mail/messages/m1/seen'],
    ['PUT', '/v1/db/tasks'],
    ['PATCH', '/v1/accounts/acc_a'],
    ['DELETE', '/v1/notifications/n1'],
    ['POST', '/v1/ai/reply'],
    ['POST', '/v1/speech'],
    ['POST', '/v1/view/redeem/extra'],
  ] as const) {
    assert.equal(allowedInView(method, path), false, `${method} ${path}`);
  }
});

test('Nur-Lesen: einmal an, sendet die Kopfzeile und verbietet das Schreiben', () => {
  assert.deepEqual([isViewing(), writesAllowed(), viewHeaders()], [false, true, {}]);
  let changes = 0;
  const stop = onViewChange(() => {
    changes += 1;
  });
  // Ohne aktiven Modus aendert „fehlgeschlagen“ nichts.
  viewFailed();
  viewingAccount('anna');
  assert.equal(changes, 0);

  beginViewing();
  assert.deepEqual([isViewing(), writesAllowed(), viewHeaders()], [true, false, { 'X-Better-View': '1' }]);
  viewingAccount('anna');
  assert.deepEqual(viewState(), { active: true, username: 'anna', failed: false });
  viewFailed();
  assert.deepEqual(viewState(), { active: true, username: 'anna', failed: true });
  assert.equal(changes, 3);
  stop();
  beginViewing();
  assert.equal(changes, 3);
});

test('reportReadOnly erreicht jeden, der zuhoert', () => {
  let heard = 0;
  const stop = onReadOnlyAttempt(() => {
    heard += 1;
  });
  reportReadOnly();
  reportReadOnly();
  stop();
  reportReadOnly();
  assert.equal(heard, 2);
});
