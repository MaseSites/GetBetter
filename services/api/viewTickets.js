/**
 * „App ansehen“ im Admin: ein Einmal-Ticket, mit dem eine App ein Konto nur
 * zum Ansehen laedt. Kein dauerhafter Link, keine Anmeldung.
 *
 * Der Admin laeuft im Prozess des Dienstes: er stellt aus (`issue`), der Dienst
 * loest ein (`redeem`, `POST /v1/view/redeem`). Ein Ticket sind 32 Zufallsbytes
 * als Hex, gilt 60 Sekunden und genau einmal. Alles liegt nur im Speicher —
 * ein Neustart macht offene Tickets ungueltig.
 */
const crypto = require('node:crypto');

const TICKET_BYTES = 32;
const TICKET_PATTERN = /^[a-f0-9]{64}$/;
const TTL_MS = 60_000;
/** Mehr offene Tickets braucht niemand; das aelteste faellt zuerst. */
const MAX_TICKETS = 200;

/** `createViewTickets({ now? })` — `now` nur fuer Tests. */
function createViewTickets({ now = Date.now } = {}) {
  const tickets = new Map();

  function sweep() {
    const time = now();
    for (const [ticket, entry] of tickets) if (entry.expiresAt <= time) tickets.delete(ticket);
    while (tickets.size >= MAX_TICKETS) tickets.delete(tickets.keys().next().value);
  }

  /** Ein frisches Ticket fuer dieses Konto -> `{ ticket, expiresAt }` (ms). */
  function issue(accountId, app) {
    sweep();
    const ticket = crypto.randomBytes(TICKET_BYTES).toString('hex');
    const expiresAt = now() + TTL_MS;
    tickets.set(ticket, { accountId, app, expiresAt });
    return { ticket, expiresAt };
  }

  /** Einmal einloesen -> `{ accountId, app }`; unbekannt, benutzt oder abgelaufen -> null. */
  function redeem(ticket) {
    if (typeof ticket !== 'string' || !TICKET_PATTERN.test(ticket)) return null;
    const entry = tickets.get(ticket);
    tickets.delete(ticket);
    if (!entry || entry.expiresAt <= now()) return null;
    return { accountId: entry.accountId, app: entry.app };
  }

  return { issue, redeem, size: () => tickets.size };
}

/** Das eine Buch fuer Dienst und Admin im selben Prozess. */
const viewTickets = createViewTickets();

module.exports = { MAX_TICKETS, TICKET_PATTERN, TTL_MS, createViewTickets, viewTickets };
