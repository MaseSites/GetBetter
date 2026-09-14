/** „App ansehen“: Tickets gelten genau einmal und 60 Sekunden. */
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { MAX_TICKETS, TICKET_PATTERN, TTL_MS, createViewTickets } = require('./viewTickets.js');

test('ein Ticket ist 32 Zufallsbytes als Hex und gilt genau einmal', () => {
  const tickets = createViewTickets();
  const { ticket, expiresAt } = tickets.issue('acc_anna', 'getbetter');
  assert.match(ticket, TICKET_PATTERN);
  assert.equal(ticket.length, 64);
  assert.ok(expiresAt > Date.now());
  assert.notEqual(tickets.issue('acc_anna', 'getbetter').ticket, ticket);

  assert.deepEqual(tickets.redeem(ticket), { accountId: 'acc_anna', app: 'getbetter' });
  assert.equal(tickets.redeem(ticket), null);
});

test('abgelaufen, unbekannt oder krumm gilt nicht', () => {
  let time = 1_000_000;
  const tickets = createViewTickets({ now: () => time });
  const late = tickets.issue('acc_ben', 'bettergym').ticket;
  const onTime = tickets.issue('acc_ben', 'bettergym').ticket;
  time += TTL_MS - 1;
  assert.deepEqual(tickets.redeem(onTime), { accountId: 'acc_ben', app: 'bettergym' });
  time += 1;
  assert.equal(tickets.redeem(late), null);
  for (const bad of ['f'.repeat(64), 'F'.repeat(64), 'abc', '', null, undefined, 42]) {
    assert.equal(tickets.redeem(bad), null, String(bad));
  }
});

test('hoechstens so viele offene Tickets — das aelteste faellt zuerst', () => {
  const tickets = createViewTickets();
  const first = tickets.issue('acc_a', 'getbetter').ticket;
  for (let index = 0; index < MAX_TICKETS; index += 1) tickets.issue('acc_a', 'getbetter');
  assert.ok(tickets.size() <= MAX_TICKETS);
  assert.equal(tickets.redeem(first), null);
});
