/**
 * Mitteilungen fuer die Glocke. Die Sammlung gehoert dem Dienst: Apps legen
 * sie ueber `/v1/notifications` an, der Mail-Abgleich legt sie selbst an.
 *
 * `title` und `body` sind Daten (ein Name, ein Betreff), keine Saetze — den
 * Satz baut die App je `kind`.
 */
const { load, newId, rowsOf, save } = require('./store.js');

const KINDS = new Set(['calendarShare', 'calendarInvite', 'householdInvite', 'mail', 'system']);
const MAX_TITLE = 300;
const MAX_BODY = 2000;
const MAX_REF_ENTRIES = 20;
const REF_KEY = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
const APP_NAME = /^[a-z][a-z0-9]{1,31}$/;

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validRef(ref) {
  if (!isPlainObject(ref)) return false;
  const entries = Object.entries(ref);
  return (
    entries.length <= MAX_REF_ENTRIES &&
    entries.every(
      ([key, value]) => REF_KEY.test(key) && typeof value === 'string' && value.length <= 200,
    )
  );
}

/** Prueft den Koerper von `POST /v1/notifications`; `null` heisst ungueltig. */
function readNotificationInput(input) {
  if (!isPlainObject(input)) return null;
  const { accountId, kind, title, body = '', ref = {}, app } = input;
  const valid =
    typeof accountId === 'string' &&
    accountId.length > 0 &&
    accountId.length <= 100 &&
    KINDS.has(kind) &&
    typeof title === 'string' &&
    title.length <= MAX_TITLE &&
    typeof body === 'string' &&
    body.length <= MAX_BODY &&
    validRef(ref) &&
    typeof app === 'string' &&
    APP_NAME.test(app);
  return valid ? { accountId, kind, title, body, ref: { ...ref }, app } : null;
}

function buildNotification({ accountId, kind, title, body, ref, app }, now = new Date()) {
  return {
    id: newId('ntf'),
    accountId,
    kind,
    title,
    body,
    ref,
    app,
    createdAt: now.toISOString(),
    readAt: null,
  };
}

async function createNotification(input) {
  const value = readNotificationInput(input);
  if (!value) return { status: 400, body: { error: 'bad_request' } };
  const db = await load();
  if (!rowsOf(db, 'accounts').some((row) => row.id === value.accountId)) {
    return { status: 404, body: { error: 'not_found' } };
  }
  const row = buildNotification(value);
  db.tables.notifications = [...rowsOf(db, 'notifications'), row];
  await save();
  return { status: 201, body: { notification: row } };
}

async function markNotificationRead(id) {
  const db = await load();
  const rows = rowsOf(db, 'notifications');
  const row = rows.find((entry) => entry.id === id);
  if (!row) return { status: 404, body: { error: 'not_found' } };
  if (row.readAt) return { status: 200, body: { notification: row } };
  const next = { ...row, readAt: new Date().toISOString() };
  db.tables.notifications = rows.map((entry) => (entry.id === id ? next : entry));
  await save();
  return { status: 200, body: { notification: next } };
}

async function deleteNotification(id) {
  const db = await load();
  const rows = rowsOf(db, 'notifications');
  if (!rows.some((entry) => entry.id === id)) return { status: 404, body: { error: 'not_found' } };
  db.tables.notifications = rows.filter((entry) => entry.id !== id);
  await save();
  return { status: 200, body: { ok: true } };
}

async function removeNotificationsByRef(input) {
  if (!isPlainObject(input)) return { status: 400, body: { error: 'bad_request' } };
  const { accountId, kind, key, value } = input;
  const valid =
    (accountId === undefined || (typeof accountId === 'string' && accountId.length > 0)) &&
    KINDS.has(kind) &&
    typeof key === 'string' &&
    REF_KEY.test(key) &&
    typeof value === 'string';
  if (!valid) return { status: 400, body: { error: 'bad_request' } };

  const db = await load();
  const rows = rowsOf(db, 'notifications');
  const matches = (row) =>
    row.kind === kind &&
    isPlainObject(row.ref) &&
    Object.hasOwn(row.ref, key) &&
    row.ref[key] === value &&
    (accountId === undefined || row.accountId === accountId);
  const kept = rows.filter((row) => !matches(row));
  const removed = rows.length - kept.length;
  if (removed > 0) {
    db.tables.notifications = kept;
    await save();
  }
  return { status: 200, body: { removed } };
}

module.exports = {
  buildNotification,
  createNotification,
  markNotificationRead,
  deleteNotification,
  removeNotificationsByRef,
};
