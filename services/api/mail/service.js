/**
 * Die E-Mail-Schnittstellen des Dienstes: Anbieter raten, Postfach verbinden
 * und trennen, abgleichen, senden (auch verzoegert, als Antwort oder
 * Weiterleitung), Entwuerfe — und die Handgriffe an einer oder vielen
 * Nachrichten (gelesen, markiert, verschoben, geloescht).
 *
 * Jede Funktion antwortet mit `{ status, body }`; server.js schickt es nur ab.
 * Passwoerter kommen nur hier herein und gehen direkt in den Tresor.
 * HTML und Anhaenge liefert `bodies.js`, Entwuerfe `drafts.js`, das Warten vor
 * dem Senden `outbox.js`.
 */
const path = require('node:path');

const { buildNotification } = require('../notifications.js');
const { load, newId, rowsOf, save } = require('../store.js');
const { createBodies } = require('./bodies.js');
const { forwardSubject, forwardText, referencesFor } = require('./compose.js');
const { MailError } = require('./connection.js');
const { createDrafts } = require('./drafts.js');
const { findSent, isRole, resolveFolder } = require('./folders.js');
const { connectImap, sequenceSet, withImap } = require('./imap.js');
const { parseAddressList } = require('./mime.js');
const { createOutbox } = require('./outbox.js');
const { detectProvider, requiresOAuth } = require('./providers.js');
const { buildMessage, sendMail } = require('./smtp.js');
const { createMailSync } = require('./sync.js');
const { createVault } = require('./vault.js');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOST_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const MAX_RECIPIENTS = 50;
const MAX_SUBJECT = 500;
const MAX_TEXT = 100_000;
/** So viele Nachrichten darf ein Handgriff auf einmal betreffen. */
const MAX_ACTION_IDS = 100;
/** „Rueckgaengig“ geht hoechstens so lange. */
const MAX_DELAY_MS = 20_000;

/** Was mit einer Nachricht geschehen kann. `move` braucht dazu eine Rolle. */
const FLAG_ACTIONS = {
  seen: { flag: '\\Seen', add: true },
  unseen: { flag: '\\Seen', add: false },
  flag: { flag: '\\Flagged', add: true },
  unflag: { flag: '\\Flagged', add: false },
};
const ACTIONS = new Set([...Object.keys(FLAG_ACTIONS), 'move', 'delete']);
/** Nach diesen Handgriffen ist die Nachricht dort, wo sie war, nicht mehr. */
const LEAVES_FOLDER = new Set(['move', 'delete']);

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

/** Eine Id, die fehlen darf: `undefined`, `null` oder ein kurzer Text. */
const optionalId = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.length > 0 && value.length <= 100);

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

/** Was eine Mail zum Schreiben braucht — fuers Senden (`to` Pflicht) wie fuer Entwuerfe. */
function readMessageForm(input, { toRequired }) {
  if (!input || typeof input !== 'object') return null;
  const to = readRecipients(input.to, toRequired);
  const cc = readRecipients(input.cc, false);
  const bcc = readRecipients(input.bcc, false);
  const { mailAccountId, subject, text, inReplyTo, draftId } = input;
  const valid =
    typeof mailAccountId === 'string' &&
    to !== null &&
    cc !== null &&
    bcc !== null &&
    typeof subject === 'string' &&
    subject.length <= MAX_SUBJECT &&
    typeof text === 'string' &&
    text.length <= MAX_TEXT &&
    optionalId(inReplyTo) &&
    optionalId(draftId);
  if (!valid) return null;
  return {
    mailAccountId,
    to,
    cc,
    bcc,
    subject,
    text,
    inReplyTo: inReplyTo ?? null,
    draftId: draftId ?? null,
  };
}

function readSendForm(input) {
  const form = readMessageForm(input, { toRequired: true });
  if (!form) return null;
  const forwardOf = input.forwardOf ?? null;
  const delayMs = input.delayMs ?? 0;
  const valid =
    optionalId(forwardOf) &&
    !(form.inReplyTo !== null && forwardOf !== null) &&
    Number.isInteger(delayMs) &&
    delayMs >= 0 &&
    delayMs <= MAX_DELAY_MS;
  return valid ? { ...form, forwardOf, delayMs } : null;
}

function readDraftForm(input) {
  const form = readMessageForm(
    input && typeof input === 'object'
      ? { subject: '', text: '', ...input, to: input.to ?? [] }
      : input,
    { toRequired: false },
  );
  const accountId = input?.accountId;
  return form && typeof accountId === 'string' && accountId.length > 0
    ? { ...form, accountId }
    : null;
}

// ------------------------------------------------------------------ Fehler

const CONNECT_ERRORS = new Set(['auth_failed', 'unreachable', 'tls_failed', 'timeout']);
const SEND_ERRORS = new Set([
  'auth_failed',
  'send_failed',
  'bad_request',
  'not_found',
  'tls_failed',
  'timeout',
]);
const DRAFT_ERRORS = new Set(['not_found', 'folder_missing', ...CONNECT_ERRORS]);

const codeOf = (error) => (error instanceof MailError ? error.code : '');

function connectError(error) {
  return CONNECT_ERRORS.has(codeOf(error)) ? codeOf(error) : 'unreachable';
}

function sendError(error) {
  return SEND_ERRORS.has(codeOf(error)) ? codeOf(error) : 'unreachable';
}

function draftError(error) {
  const code = DRAFT_ERRORS.has(codeOf(error)) ? codeOf(error) : 'unreachable';
  return reply(code === 'not_found' ? 404 : 400, { error: code });
}

// ------------------------------------------------------------------ Dienst

function createMailService({ dataDir }) {
  const vault = createVault(dataDir);
  const sync = createMailSync({ vault, stateFile: path.join(dataDir, 'mail-state.json') });
  const bodies = createBodies({ dataDir, vault, sync });
  const drafts = createDrafts({ dataDir, vault, sync, onRemoved: (ids) => bodies.forget(ids) });
  const outbox = createOutbox({
    file: path.join(dataDir, 'mail-outbox.json'),
    deliver,
    onFailure: reportSendFailure,
  });

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
      // Welche Ordner es gibt, sagt der erste Abgleich.
      folders: [],
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
          (row.kind === 'mail' || row.kind === 'system') &&
          (row.ref?.mailAccountId === id || gone.has(row.ref?.mailMessageId))
        ),
    );
    await save();
    await outbox.dropMailbox(id);
    await vault.remove(id);
    await sync.forget(id);
    await drafts.forgetMailbox(id);
    await bodies.forget(gone);
    return reply(200, { ok: true });
  }

  async function syncAccount(input) {
    const accountId = input && typeof input === 'object' ? input.accountId : undefined;
    if (typeof accountId !== 'string' || accountId.length === 0) return badRequest();
    return reply(200, await sync.syncAccountsOf(accountId));
  }

  // ---------------------------------------------------------------- Handgriffe

  function groupBy(rows, key) {
    const groups = new Map();
    for (const row of rows) groups.set(row[key], [...(groups.get(row[key]) ?? []), row]);
    return groups;
  }

  /**
   * Fuehrt eine Handlung auf den Nachrichten **eines** Postfachs aus: eine
   * Verbindung, je Ordner ein SELECT. Zurueck kommen die Zeilen, die wirklich
   * drankamen — bei einem Abbruch also weniger, als hineingingen.
   */
  async function actOnAccount(account, rows, action, role) {
    const password = await vault.get(account.id).catch(() => null);
    if (password === null) return { error: 'auth_failed', done: [] };
    const state = await sync.stateOf(account.id);
    const byFolder = groupBy(rows, 'folder');
    let done = [];
    try {
      await withImap(sync.imapOptions(account, password), async (client) => {
        const wanted = action === 'move' ? role : action === 'delete' ? 'trash' : null;
        const target =
          wanted === null ? null : await resolveFolder(client, account.folders, wanted);
        if (action === 'move' && target === null) throw new MailError('folder_missing');
        for (const [folder, list] of byFolder) {
          // Was schon im Zielordner liegt, bleibt liegen.
          if (action === 'move' && target === folder) continue;
          const box = await client.select(folder);
          const known = state?.folders?.[folder]?.uidValidity;
          // Neue UIDVALIDITY heisst: die gemerkten UIDs meinen andere Mails.
          if (known !== undefined && box.uidValidity !== null && known !== box.uidValidity) {
            throw new MailError('stale');
          }
          const set = sequenceSet(list.map((row) => row.uid));
          if (LEAVES_FOLDER.has(action)) {
            if (target && target !== folder) await client.uidMove(set, target);
            else await client.expungeUids(set);
          } else {
            const change = FLAG_ACTIONS[action];
            await client.uidStore(set, change.add ? '+FLAGS.SILENT' : '-FLAGS.SILENT', [
              change.flag,
            ]);
          }
          done = [...done, ...list];
        }
      });
    } catch (error) {
      const code = codeOf(error);
      if (code === 'stale') return { error: 'not_found', done };
      if (code === 'folder_missing') return { error: 'folder_missing', done };
      return { error: connectError(error), done };
    }
    return { error: null, done };
  }

  /** Schreibt in die Tabellen, was auf dem Mailserver schon geschehen ist. */
  async function recordAction(account, done, action) {
    const db = await load();
    const messages = rowsOf(db, 'mailMessages');
    const ids = new Set(done.map((row) => row.id));

    if (LEAVES_FOLDER.has(action)) {
      for (const row of done) sync.markDeleted(account.id, row.folder, row.uid);
      // Auch eine Kopie, die ein gleichzeitiger Abgleich eben neu angelegt hat.
      const places = new Set(done.map((row) => `${row.folder}:${row.uid}`));
      const gone = new Set(
        messages
          .filter(
            (row) =>
              ids.has(row.id) ||
              (row.mailAccountId === account.id && places.has(`${row.folder}:${row.uid}`)),
          )
          .map((row) => row.id),
      );
      db.tables.mailMessages = messages.filter((row) => !gone.has(row.id));
      db.tables.notifications = rowsOf(db, 'notifications').filter(
        (row) => !(row.kind === 'mail' && gone.has(row.ref?.mailMessageId)),
      );
      await save();
      // Die verschobene Mail bekommt im Zielordner eine neue Id — der alte Text ist verwaist.
      await bodies.forget(gone);
      return;
    }

    const change = FLAG_ACTIONS[action];
    const patch = change.flag === '\\Seen' ? { seen: change.add } : { flagged: change.add };
    for (const row of done) sync.touch(row.id);
    db.tables.mailMessages = messages.map((row) => (ids.has(row.id) ? { ...row, ...patch } : row));
    if (patch.seen === true) {
      const now = new Date().toISOString();
      db.tables.notifications = rowsOf(db, 'notifications').map((row) =>
        row.kind === 'mail' && ids.has(row.ref?.mailMessageId) && !row.readAt
          ? { ...row, readAt: now }
          : row,
      );
    }
    await save();
  }

  function readActionForm(input) {
    if (!input || typeof input !== 'object') return null;
    const { ids, action, role } = input;
    const valid =
      Array.isArray(ids) &&
      ids.length > 0 &&
      ids.length <= MAX_ACTION_IDS &&
      ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 100) &&
      typeof action === 'string' &&
      ACTIONS.has(action) &&
      (action !== 'move' || isRole(role));
    return valid ? { ids: [...new Set(ids)], action, role: action === 'move' ? role : null } : null;
  }

  /**
   * Eine Handlung auf beliebig vielen Nachrichten, ueber Postfaecher hinweg.
   * Was geklappt hat, wird sofort geschrieben; der erste Fehler kommt zurueck,
   * sobald gar nichts mehr uebrig ist.
   */
  async function runAction(input) {
    const form = readActionForm(input);
    if (!form) return { status: 400, error: 'bad_request' };
    const db = await load();
    const wanted = new Set(form.ids);
    const rows = rowsOf(db, 'mailMessages').filter((row) => wanted.has(row.id));
    if (rows.length === 0) return { status: 404, error: 'not_found' };
    const accounts = rowsOf(db, 'mailAccounts');

    let failure = null;
    let changed = 0;
    let moved = [];
    for (const [mailAccountId, list] of groupBy(rows, 'mailAccountId')) {
      const account = accounts.find((row) => row.id === mailAccountId);
      if (!account) {
        failure = failure ?? 'not_found';
        continue;
      }
      const result = await actOnAccount(account, list, form.action, form.role);
      if (result.done.length > 0) {
        await recordAction(account, result.done, form.action);
        changed += result.done.length;
        if (form.action === 'move') moved = [...moved, mailAccountId];
      }
      failure = failure ?? result.error;
    }
    // Nach dem Verschieben liegt die Nachricht im Zielordner — der Abgleich holt
    // sie dort ab, ohne sie als Neuigkeit zu melden.
    for (const id of moved) await sync.syncMailAccount(id, { manual: true, quiet: true });
    if (failure && changed === 0) {
      return { status: failure === 'not_found' ? 404 : 400, error: failure };
    }
    return { status: 200, changed };
  }

  async function markSeen(id, input) {
    const seen = input && typeof input === 'object' ? input.seen : undefined;
    if (typeof seen !== 'boolean') return badRequest();
    const result = await runAction({ ids: [id], action: seen ? 'seen' : 'unseen' });
    return result.error ? reply(result.status, { error: result.error }) : reply(200, { ok: true });
  }

  async function deleteMessage(id) {
    const result = await runAction({ ids: [id], action: 'delete' });
    return result.error ? reply(result.status, { error: result.error }) : reply(200, { ok: true });
  }

  async function messageActions(input) {
    const result = await runAction(input);
    return result.error
      ? reply(result.status, { error: result.error })
      : reply(200, { ok: true, changed: result.changed });
  }

  // ---------------------------------------------------------------- Senden

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

  /** Die Zeile, auf die sich Antwort oder Weiterleitung bezieht: `undefined`, wenn es sie nicht gibt. */
  function relatedMessage(db, id, account) {
    if (id === null) return null;
    return rowsOf(db, 'mailMessages').find(
      (row) => row.id === id && row.accountId === account.accountId,
    );
  }

  const senderOf = (account) => ({ name: account.displayName, address: account.email });

  /**
   * Prueft und baut eine Mail fertig: die Fassung fuer SMTP (ohne Bcc) und die
   * Kopie fuer „Gesendet“ (mit Bcc), beide mit derselben Message-ID.
   */
  async function prepareSend(input) {
    const form = readSendForm(input);
    if (!form) return { failure: badRequest() };
    const db = await load();
    const account = rowsOf(db, 'mailAccounts').find((row) => row.id === form.mailAccountId);
    if (!account) return { failure: notFound(400) };
    const parent = relatedMessage(db, form.inReplyTo, account);
    const original = relatedMessage(db, form.forwardOf, account);
    if (parent === undefined || original === undefined) return { failure: notFound(400) };
    const password = await vault.get(account.id).catch(() => null);
    if (password === null) return { failure: reply(400, { error: 'auth_failed' }) };

    const sendAt = new Date(Date.now() + form.delayMs);
    const subject =
      original && form.subject.trim() === '' ? forwardSubject(original.subject) : form.subject;
    const message = {
      from: senderOf(account),
      to: form.to,
      cc: form.cc,
      bcc: form.bcc,
      subject,
      text: original ? forwardText(form.text, original) : form.text,
      inReplyTo: parent?.messageId ?? null,
      references: parent ? referencesFor(parent) : [],
      date: sendAt,
    };
    try {
      const wire = buildMessage(message);
      const copy = buildMessage({ ...message, includeBcc: true, messageId: wire.messageId });
      const job = {
        sendId: newId('snd'),
        accountId: account.accountId,
        mailAccountId: account.id,
        recipients: [...new Set([...form.to, ...form.cc, ...form.bcc])],
        raw: wire.raw.toString('latin1'),
        sentCopy: copy.raw.toString('latin1'),
        messageId: wire.messageId,
        subject,
        draftId: form.draftId,
        sendAt: sendAt.toISOString(),
        createdAt: new Date().toISOString(),
      };
      return { job, delayMs: form.delayMs };
    } catch (error) {
      return { failure: reply(400, { error: sendError(error) }) };
    }
  }

  /** Schickt eine fertig gebaute Mail ab — sofort oder, aus dem Postausgang, nach der Wartezeit. */
  async function deliver(job) {
    const account = rowsOf(await load(), 'mailAccounts').find(
      (row) => row.id === job.mailAccountId,
    );
    if (!account) throw new MailError('not_found');
    const password = await vault.get(account.id).catch(() => null);
    if (password === null) throw new MailError('auth_failed');
    try {
      await sendMail({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        username: account.username,
        password,
        from: account.email,
        recipients: job.recipients,
        raw: Buffer.from(job.raw, 'latin1'),
      });
    } catch (error) {
      throw new MailError(sendError(error));
    }
    storeInSent(account, password, Buffer.from(job.sentCopy, 'latin1'));
    if (job.draftId) {
      drafts.removeDraft(job.draftId).catch((error) => {
        process.stderr.write(
          `[mail] Entwurf nach dem Senden geblieben: ${codeOf(error) || 'Error'}\n`,
        );
      });
    }
  }

  /**
   * Eine verzoegerte Mail kam nicht hinaus, und die App ist vielleicht schon zu:
   * die Mail wird als Entwurf gesichert, und es gibt eine Mitteilung.
   */
  async function reportSendFailure(job, error) {
    const account = rowsOf(await load(), 'mailAccounts').find(
      (row) => row.id === job.mailAccountId,
    );
    const draftId = account
      ? await drafts
          .saveDraft({
            account,
            raw: Buffer.from(job.sentCopy, 'latin1'),
            messageId: job.messageId,
          })
          .catch(() => null)
      : null;
    const db = await load();
    if (!rowsOf(db, 'accounts').some((row) => row.id === job.accountId)) return;
    const notification = buildNotification({
      accountId: job.accountId,
      kind: 'system',
      title: String(job.subject ?? '').slice(0, 300),
      body: job.recipients.join(', ').slice(0, 2000),
      ref: {
        reason: 'mailSendFailed',
        sendId: job.sendId,
        mailAccountId: job.mailAccountId,
        error,
        ...(draftId ? { draftId } : {}),
      },
      app: 'getbetter',
    });
    db.tables.notifications = [...rowsOf(db, 'notifications'), notification];
    await save();
  }

  /**
   * `delayMs` 0: sofort, `{ ok: true }`. Sonst wartet die Mail im Dienst und
   * die Antwort ist `202 { sendId, sendAt }` — bis dahin laesst sie sich abbrechen.
   */
  async function send(input) {
    const prepared = await prepareSend(input);
    if (prepared.failure) return prepared.failure;
    if (prepared.delayMs === 0) {
      try {
        await deliver(prepared.job);
      } catch (error) {
        return reply(400, { error: sendError(error) });
      }
      return reply(200, { ok: true });
    }
    return reply(202, await outbox.schedule(prepared.job));
  }

  async function cancelSend(sendId) {
    const outcome = await outbox.cancel(String(sendId ?? ''));
    if (outcome === 'cancelled') return reply(200, { cancelled: true });
    if (outcome === 'already_sent') return reply(409, { error: 'already_sent' });
    return notFound();
  }

  async function sendStatus(sendId) {
    const status = await outbox.status(String(sendId ?? ''));
    return status ? reply(200, status) : notFound();
  }

  // ---------------------------------------------------------------- Entwuerfe

  async function saveDraft(input) {
    const form = readDraftForm(input);
    if (!form) return badRequest();
    const db = await load();
    const account = rowsOf(db, 'mailAccounts').find(
      (row) => row.id === form.mailAccountId && row.accountId === form.accountId,
    );
    if (!account) return notFound();
    const parent = relatedMessage(db, form.inReplyTo, account);
    if (parent === undefined) return notFound();
    let built;
    try {
      built = buildMessage({
        from: senderOf(account),
        to: form.to,
        cc: form.cc,
        bcc: form.bcc,
        includeBcc: true,
        subject: form.subject,
        text: form.text,
        inReplyTo: parent?.messageId ?? null,
        references: parent ? referencesFor(parent) : [],
      });
    } catch {
      return badRequest();
    }
    try {
      const draftId = await drafts.saveDraft({
        account,
        raw: built.raw,
        messageId: built.messageId,
        draftId: form.draftId,
      });
      return reply(200, { draftId });
    } catch (error) {
      return draftError(error);
    }
  }

  async function deleteDraft(draftId) {
    try {
      await drafts.removeDraft(draftId);
      return reply(200, { ok: true });
    } catch (error) {
      return draftError(error);
    }
  }

  return {
    providers,
    connectAccount,
    removeAccount,
    syncAccount,
    markSeen,
    deleteMessage,
    messageActions,
    send,
    cancelSend,
    sendStatus,
    saveDraft,
    deleteDraft,
    messageBody: (id, allowRemoteImages) => bodies.body(id, allowRemoteImages),
    serveAttachment: (res, id, index, cors) => bodies.serveAttachment(res, id, index, cors),
    startScheduler: (intervalMs) => sync.startScheduler(intervalMs),
    resumeOutbox: () => outbox.resume(),
  };
}

module.exports = { createMailService, readAccountForm, readRecipients };
