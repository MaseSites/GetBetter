/**
 * Die E-Mail-Schnittstellen des Dienstes: Anbieter raten, Postfach verbinden
 * und trennen, abgleichen, gelesen markieren, loeschen und senden.
 *
 * Jede Funktion antwortet mit `{ status, body }`; server.js schickt es nur ab.
 * Passwoerter kommen nur hier herein und gehen direkt in den Tresor.
 */
const path = require('node:path');

const { load, newId, rowsOf, save } = require('../store.js');
const { MailError } = require('./connection.js');
const { connectImap, findSent, findTrash, withImap } = require('./imap.js');
const { parseAddressList } = require('./mime.js');
const { detectProvider, requiresOAuth } = require('./providers.js');
const { buildMessage, sendMail } = require('./smtp.js');
const { createMailSync } = require('./sync.js');
const { createVault } = require('./vault.js');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOST_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const MAX_RECIPIENTS = 50;
const MAX_SUBJECT = 500;
const MAX_TEXT = 100_000;

const reply = (status, body) => ({ status, body });
const badRequest = () => reply(400, { error: 'bad_request' });
const notFound = (status = 404) => reply(status, { error: 'not_found' });

// ------------------------------------------------------------------ Eingaben

function isEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value);
}

function isHostname(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 253 &&
    value.split('.').every((label) => HOST_LABEL.test(label))
  );
}

/** `undefined` = nicht angegeben, `NaN` = ungueltig. */
function readPort(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const port = typeof value === 'string' && /^\d{1,5}$/.test(value) ? Number(value) : value;
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : Number.NaN;
}

const singleLine = (value) => typeof value === 'string' && !/[\r\n\0]/.test(value);

function readAccountForm(input) {
  if (!input || typeof input !== 'object') return null;
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const form = {
    accountId: input.accountId,
    email,
    password: input.password,
    displayName: input.displayName === undefined ? '' : input.displayName,
    username: input.username === undefined || input.username === '' ? email : input.username,
    imapHost: input.imapHost === undefined || input.imapHost === '' ? undefined : input.imapHost,
    smtpHost: input.smtpHost === undefined || input.smtpHost === '' ? undefined : input.smtpHost,
    imapPort: readPort(input.imapPort),
    smtpPort: readPort(input.smtpPort),
    imapSecure: input.imapSecure,
    smtpSecure: input.smtpSecure,
  };
  const valid =
    typeof form.accountId === 'string' &&
    form.accountId.length > 0 &&
    isEmail(email) &&
    typeof form.password === 'string' &&
    form.password.length > 0 &&
    form.password.length <= 1024 &&
    singleLine(form.displayName) &&
    form.displayName.length <= 200 &&
    singleLine(form.username) &&
    form.username.length <= 320 &&
    (form.imapHost === undefined || isHostname(form.imapHost)) &&
    (form.smtpHost === undefined || isHostname(form.smtpHost)) &&
    !Number.isNaN(form.imapPort) &&
    !Number.isNaN(form.smtpPort) &&
    (form.imapSecure === undefined || typeof form.imapSecure === 'boolean') &&
    (form.smtpSecure === undefined || typeof form.smtpSecure === 'boolean');
  return valid ? { ...form, displayName: form.displayName.trim() } : null;
}

/** Eine Empfaengerliste: jede Angabe genau eine gueltige Adresse (auch `Name <a@b.ch>`). */
function readRecipients(value, required) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length > MAX_RECIPIENTS) return null;
  if (required && value.length === 0) return null;
  const addresses = value.map((entry) => {
    if (typeof entry !== 'string' || entry.length > 500) return null;
    const parsed = parseAddressList(entry);
    return parsed.length === 1 && isEmail(parsed[0].address) ? parsed[0].address : null;
  });
  return addresses.every((address) => address !== null) ? addresses : null;
}

// ------------------------------------------------------------------ Fehler

const CONNECT_ERRORS = new Set(['auth_failed', 'unreachable', 'tls_failed', 'timeout']);

function connectError(error) {
  const code = error instanceof MailError ? error.code : '';
  return CONNECT_ERRORS.has(code) ? code : 'unreachable';
}

function sendError(error) {
  const code = error instanceof MailError ? error.code : '';
  return ['auth_failed', 'send_failed', 'bad_request'].includes(code) ? code : 'unreachable';
}

// ------------------------------------------------------------------ Dienst

function createMailService({ dataDir }) {
  const vault = createVault(dataDir);
  const sync = createMailSync({ vault, stateFile: path.join(dataDir, 'mail-state.json') });

  function providers(email) {
    const address = String(email ?? '')
      .trim()
      .toLowerCase();
    return isEmail(address) ? reply(200, detectProvider(address)) : badRequest();
  }

  async function verifyLogin(settings, form) {
    const client = await connectImap({
      host: settings.imapHost,
      port: settings.imapPort,
      secure: settings.imapSecure,
      username: form.username,
      password: form.password,
    });
    await client.logout();
  }

  async function connectAccount(input) {
    const form = readAccountForm(input);
    if (!form) return badRequest();
    const isDuplicate = (db) =>
      rowsOf(db, 'mailAccounts').some(
        (row) => row.accountId === form.accountId && row.email === form.email,
      );
    const db = await load();
    if (!rowsOf(db, 'accounts').some((row) => row.id === form.accountId)) return badRequest();
    if (isDuplicate(db)) return reply(400, { error: 'already_connected' });

    const preset = detectProvider(form.email);
    const settings = {
      imapHost: form.imapHost ?? preset.imapHost,
      imapPort: form.imapPort ?? preset.imapPort,
      imapSecure: form.imapSecure ?? preset.imapSecure,
      smtpHost: form.smtpHost ?? preset.smtpHost,
      smtpPort: form.smtpPort ?? preset.smtpPort,
      smtpSecure: form.smtpSecure ?? preset.smtpSecure,
    };
    const ownHost = form.imapHost !== undefined && !requiresOAuth(form.imapHost);
    if ((preset.note === 'oauth_only' && !ownHost) || requiresOAuth(settings.imapHost)) {
      return reply(400, { error: 'oauth_required' });
    }

    try {
      await verifyLogin(settings, form);
    } catch (error) {
      const code = connectError(error);
      const hint = code === 'auth_failed' && preset.note ? { note: preset.note } : {};
      return reply(400, { error: code, ...hint });
    }

    const row = {
      id: newId('mac'),
      accountId: form.accountId,
      email: form.email,
      displayName: form.displayName,
      provider: preset.provider,
      username: form.username,
      ...settings,
      connectedAt: new Date().toISOString(),
      lastSyncAt: null,
      lastError: null,
    };
    // Erst das Geheimnis, dann die Zeile — ein Abgleich soll nie eine Zeile ohne Passwort sehen.
    await vault.put(row.id, form.password);
    const current = await load();
    if (isDuplicate(current)) {
      await vault.remove(row.id);
      return reply(400, { error: 'already_connected' });
    }
    current.tables.mailAccounts = [...rowsOf(current, 'mailAccounts'), row];
    await save();
    // Der erste Abgleich laeuft im Hintergrund; Fehler landen in `lastError`.
    void sync.syncMailAccount(row.id, { manual: true });
    return reply(201, { mailAccount: row });
  }

  async function removeAccount(id) {
    const db = await load();
    const accounts = rowsOf(db, 'mailAccounts');
    if (!accounts.some((row) => row.id === id)) return notFound();
    const messages = rowsOf(db, 'mailMessages');
    const gone = new Set(messages.filter((row) => row.mailAccountId === id).map((row) => row.id));
    db.tables.mailAccounts = accounts.filter((row) => row.id !== id);
    db.tables.mailMessages = messages.filter((row) => row.mailAccountId !== id);
    db.tables.notifications = rowsOf(db, 'notifications').filter(
      (row) =>
        !(
          row.kind === 'mail' &&
          (row.ref?.mailAccountId === id || gone.has(row.ref?.mailMessageId))
        ),
    );
    await save();
    await vault.remove(id);
    await sync.forget(id);
    return reply(200, { ok: true });
  }

  async function syncAccount(input) {
    const accountId = input && typeof input === 'object' ? input.accountId : undefined;
    if (typeof accountId !== 'string' || accountId.length === 0) return badRequest();
    return reply(200, await sync.syncAccountsOf(accountId));
  }

  /** Oeffnet den Ordner einer Nachricht und prueft, dass ihre UID noch gilt. */
  async function onMessage(message, account, task) {
    const password = await vault.get(account.id).catch(() => null);
    if (password === null) throw new MailError('auth_failed');
    const state = await sync.stateOf(account.id);
    await withImap(sync.imapOptions(account, password), async (client) => {
      const box = await client.select(message.folder);
      if (state && box.uidValidity !== null && state.uidValidity !== box.uidValidity) {
        throw new MailError('stale');
      }
      await task(client, String(message.uid));
    });
  }

  async function findMessage(id) {
    const db = await load();
    const message = rowsOf(db, 'mailMessages').find((row) => row.id === id);
    const account = message
      ? rowsOf(db, 'mailAccounts').find((row) => row.id === message.mailAccountId)
      : undefined;
    return message && account ? { message, account } : null;
  }

  async function markSeen(id, input) {
    const seen = input && typeof input === 'object' ? input.seen : undefined;
    if (typeof seen !== 'boolean') return badRequest();
    const found = await findMessage(id);
    if (!found) return notFound();
    try {
      await onMessage(found.message, found.account, (client, uid) =>
        client.uidStore(uid, seen ? '+FLAGS.SILENT' : '-FLAGS.SILENT', ['\\Seen']),
      );
    } catch (error) {
      if (error instanceof MailError && error.code === 'stale') return notFound();
      return reply(400, { error: connectError(error) });
    }
    sync.touch(id);
    const db = await load();
    const now = new Date().toISOString();
    db.tables.mailMessages = rowsOf(db, 'mailMessages').map((row) =>
      row.id === id ? { ...row, seen } : row,
    );
    if (seen) {
      db.tables.notifications = rowsOf(db, 'notifications').map((row) =>
        row.kind === 'mail' && row.ref?.mailMessageId === id && !row.readAt
          ? { ...row, readAt: now }
          : row,
      );
    }
    await save();
    return reply(200, { ok: true });
  }

  async function deleteMessage(id) {
    const found = await findMessage(id);
    if (!found) return notFound();
    try {
      await onMessage(found.message, found.account, async (client, uid) => {
        const trash = findTrash(await client.list());
        if (trash && trash !== found.message.folder) await client.uidMove(uid, trash);
        else await client.expungeUids(uid);
      });
    } catch (error) {
      if (error instanceof MailError && error.code === 'stale') return notFound();
      return reply(400, { error: connectError(error) });
    }
    sync.markDeleted(found.account.id, found.message.uid);
    const db = await load();
    const messages = rowsOf(db, 'mailMessages');
    // Auch eine Kopie, die ein gleichzeitiger Abgleich eben neu angelegt hat.
    const sameMail = (row) =>
      row.id === id ||
      (row.mailAccountId === found.account.id &&
        row.folder === found.message.folder &&
        row.uid === found.message.uid);
    const gone = new Set(messages.filter(sameMail).map((row) => row.id));
    db.tables.mailMessages = messages.filter((row) => !gone.has(row.id));
    db.tables.notifications = rowsOf(db, 'notifications').filter(
      (row) => !(row.kind === 'mail' && gone.has(row.ref?.mailMessageId)),
    );
    await save();
    return reply(200, { ok: true });
  }

  /** Legt eine Kopie in „Gesendet“ ab. Gmail macht das selbst — dort doppelt es nur. */
  function storeInSent(account, password, raw) {
    if (account.provider === 'gmail') return;
    withImap(sync.imapOptions(account, password), async (client) => {
      const sent = findSent(await client.list());
      if (sent) await client.append(sent, ['\\Seen'], raw);
    }).catch((error) => {
      process.stderr.write(`[mail] Ablage in Gesendet fehlgeschlagen: ${connectError(error)}\n`);
    });
  }

  async function send(input) {
    if (!input || typeof input !== 'object') return badRequest();
    const to = readRecipients(input.to, true);
    const cc = readRecipients(input.cc, false);
    const { mailAccountId, subject, text, inReplyTo } = input;
    const valid =
      typeof mailAccountId === 'string' &&
      to !== null &&
      cc !== null &&
      typeof subject === 'string' &&
      subject.length <= MAX_SUBJECT &&
      typeof text === 'string' &&
      text.length <= MAX_TEXT &&
      (inReplyTo === undefined || inReplyTo === null || typeof inReplyTo === 'string');
    if (!valid) return badRequest();

    const db = await load();
    const account = rowsOf(db, 'mailAccounts').find((row) => row.id === mailAccountId);
    if (!account) return notFound(400);
    const parent =
      typeof inReplyTo === 'string'
        ? rowsOf(db, 'mailMessages').find(
            (row) => row.id === inReplyTo && row.accountId === account.accountId,
          )
        : null;
    if (parent === undefined) return notFound(400);

    const password = await vault.get(account.id).catch(() => null);
    if (password === null) return reply(400, { error: 'auth_failed' });
    try {
      const { raw } = buildMessage({
        from: { name: account.displayName, address: account.email },
        to,
        cc,
        subject,
        text,
        inReplyTo: parent?.messageId ?? null,
      });
      await sendMail({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        username: account.username,
        password,
        from: account.email,
        recipients: [...to, ...cc],
        raw,
      });
      storeInSent(account, password, raw);
    } catch (error) {
      return reply(400, { error: sendError(error) });
    }
    return reply(200, { ok: true });
  }

  return {
    providers,
    connectAccount,
    removeAccount,
    syncAccount,
    markSeen,
    deleteMessage,
    send,
    startScheduler: (intervalMs) => sync.startScheduler(intervalMs),
  };
}

module.exports = { createMailService, readAccountForm, readRecipients };
