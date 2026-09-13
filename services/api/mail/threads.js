/**
 * Unterhaltungen: welche Mails zusammengehoeren.
 *
 * Jede Nachricht bekommt eine `threadId` (`th_` und 24 Hex-Zeichen). Sie haengt
 * nur an den Kopfzeilen, nicht an Ordner oder Postfach — die eigene Antwort aus
 * „Gesendet“ landet deshalb in derselben Unterhaltung wie die Mail darauf.
 *
 * Die Wurzel einer Unterhaltung ist eine Message-ID:
 * 1. der erste Eintrag in `References`,
 * 2. sonst die Kette der `In-Reply-To` hinauf, soweit die Mails bekannt sind,
 * 3. sonst die eigene Message-ID — so hat die erste Mail dieselbe Wurzel wie
 *    jede Antwort, die auf sie verweist.
 *
 * Fehlen die Kopfzeilen (eine Antwort ohne `In-Reply-To`, oder gar keine
 * Message-ID), zaehlt der Betreff ohne `Re:`/`AW:`/`Fwd:`/`WG:`/`TR:`: gibt es
 * eine bekannte Mail mit diesem Betreff und einer gemeinsamen Adresse, gehoert
 * sie zu deren Unterhaltung; sonst ist die Id ein Hash aus Betreff und den
 * sortierten Adressen.
 */
const crypto = require('node:crypto');

/** `Re:`, `AW:`, `Fwd:`, `Fw:`, `WG:`, `TR:`, `Antw:` — auch mehrfach und als `Re[2]:`. */
const PREFIX = /^\s*(?:(?:re|aw|antw|fwd?|wg|tr)(?:\[\d{1,3}\]|\(\d{1,3}\))?[ \t]*:[ \t]*)+/i;

const hashOf = (kind, value) =>
  `th_${crypto.createHash('sha256').update(`${kind}\0${value}`).digest('hex').slice(0, 24)}`;

const referencesOf = (message) =>
  Array.isArray(message.references)
    ? message.references.filter((id) => typeof id === 'string')
    : [];

const replyTo = (message) =>
  typeof message.inReplyTo === 'string' && message.inReplyTo.length > 0 ? message.inReplyTo : null;

/** Der Betreff, wie er fuer alle Mails einer Unterhaltung gleich lautet. */
function normaliseSubject(subject) {
  return String(subject ?? '')
    .replace(PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const hasPrefix = (subject) => PREFIX.test(String(subject ?? ''));

/** Absender, An und Cc — klein, ohne Doppelte, sortiert. */
function participantsOf(message) {
  const addresses = [message.from, ...(message.to ?? []), ...(message.cc ?? [])]
    .map((entry) =>
      String(entry?.address ?? '')
        .trim()
        .toLowerCase(),
    )
    .filter((address) => address.length > 0);
  return [...new Set(addresses)].sort();
}

/** 1. `References`, 2. die Kette der `In-Reply-To`, 3. die eigene Message-ID. */
function rootIdOf(message, byMessageId) {
  const references = referencesOf(message);
  if (references.length > 0) return references[0];
  let current = message;
  const visited = new Set();
  for (let parentId = replyTo(current); parentId !== null; parentId = replyTo(current)) {
    // Eine Schleife: jede Mail darin soll dieselbe Wurzel bekommen.
    if (visited.has(parentId)) return [...visited].sort()[0];
    visited.add(parentId);
    const parent = byMessageId.get(parentId);
    if (!parent) return parentId;
    const above = referencesOf(parent);
    if (above.length > 0) return above[0];
    current = parent;
  }
  return typeof current.messageId === 'string' && current.messageId.length > 0
    ? current.messageId
    : null;
}

/** Die Adressen, an denen man zwei Mails als verwandt erkennt: ohne die eigenen. */
function othersOf(message, ownAddresses) {
  const all = participantsOf(message);
  const others = all.filter((address) => !ownAddresses.has(address));
  return others.length > 0 ? others : all;
}

const byDate = (a, b) =>
  (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0) || String(a.id).localeCompare(b.id);

/**
 * Rechnet fuer eine Menge Mails die Unterhaltungen aus.
 * `ownAddresses`: die Adressen der eigenen Postfaecher, klein geschrieben.
 * Zurueck kommt eine Map von Zeilen-Id auf `threadId`.
 */
function threadIdsOf(messages, { ownAddresses = new Set() } = {}) {
  const byMessageId = new Map();
  for (const message of [...messages].sort(byDate)) {
    if (typeof message.messageId === 'string' && !byMessageId.has(message.messageId)) {
      byMessageId.set(message.messageId, message);
    }
  }

  // Erst, wer sich ueber Kopfzeilen einordnen laesst.
  const ids = new Map();
  const anchors = new Map();
  for (const message of [...messages].sort(byDate)) {
    const linked = referencesOf(message).length > 0 || replyTo(message) !== null;
    // Eine Antwort ohne Kopfzeilen ist keine eigene Wurzel, auch mit Message-ID.
    const root = linked || !hasPrefix(message.subject) ? rootIdOf(message, byMessageId) : null;
    if (root === null) continue;
    const threadId = hashOf('id', root);
    ids.set(message.id, threadId);
    const subject = normaliseSubject(message.subject);
    if (subject.length > 0) anchors.set(subject, [...(anchors.get(subject) ?? []), message]);
  }

  // Dann der Rest ueber Betreff und Adressen.
  for (const message of messages) {
    if (ids.has(message.id)) continue;
    const subject = normaliseSubject(message.subject);
    const mine = new Set(othersOf(message, ownAddresses));
    const anchor = (anchors.get(subject) ?? []).find((candidate) =>
      othersOf(candidate, ownAddresses).some((address) => mine.has(address)),
    );
    ids.set(
      message.id,
      anchor ? ids.get(anchor.id) : hashOf('subject', `${subject}\0${participantsOf(message)}`),
    );
  }
  return ids;
}

/**
 * Setzt `threadId` an allen Zeilen eines Kontos (`accountId`), ueber alle
 * seine Postfaecher. Zeilen anderer Konten bleiben, wie sie sind.
 * `changed` zaehlt die Zeilen, deren Id sich geaendert hat.
 */
function assignThreads(rows, { accountId, ownAddresses = new Set() }) {
  const mine = rows.filter((row) => row.accountId === accountId);
  const ids = threadIdsOf(mine, { ownAddresses });
  let changed = 0;
  const next = rows.map((row) => {
    if (row.accountId !== accountId) return row;
    const threadId = ids.get(row.id);
    if (row.threadId === threadId) return row;
    changed += 1;
    return { ...row, threadId };
  });
  return { rows: next, changed };
}

module.exports = { assignThreads, normaliseSubject, participantsOf, threadIdsOf };
