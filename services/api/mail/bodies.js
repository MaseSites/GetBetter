/**
 * Was eine Mail neben ihrer Zeile in der Datenbank noch hat: das HTML und die
 * Anhaenge. Beides kommt erst auf Nachfrage vom Mailserver — `db.json` geht an
 * jede App und muss klein bleiben.
 *
 * **HTML.** `GET /v1/mail/messages/:id/body` holt Text- und HTML-Teil per
 * `BODY.PEEK` (die Mail bleibt ungelesen), legt sie roh unter
 * `<datenordner>/mail-cache/<id>.json` ab und saeubert sie bei jeder Anfrage
 * frisch — so gilt ein verbesserter Filter auch fuer schon Geholtes. Hoechstens
 * 400 Dateien, die aeltesten gehen; je Teil hoechstens 300 KB.
 *
 * **Anhaenge.** `GET /v1/mail/messages/:id/attachments/:index` fliesst vom
 * Mailserver durch den Dienst zur App, entschluesselt, aber nie ganz im
 * Speicher; hoechstens 25 MB. Bilder und PDF inline, alles andere als Download,
 * und was ein Browser ausfuehren koennte (HTML, SVG, XML) nie mit seinem Typ.
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const { readJson, writeJsonAtomic } = require('../files.js');
const { load, rowsOf } = require('../store.js');
const { MailError } = require('./connection.js');
const { withImap } = require('./imap.js');
const { decodeBytes, decodeTransfer, htmlToText, normaliseText } = require('./mime.js');
const { sanitizeHtml } = require('./sanitize.js');
const { attachmentLeavesOf, bodyPartsOf } = require('./structure.js');
const { createDecoder } = require('./transfer.js');

const MAX_CACHED_BODIES = 400;
const MAX_BODY_BYTES = 300_000;
/** Base64 braucht fuer 300 KB gut 410 KB auf der Leitung. */
const MAX_ENCODED_BODY = 450_000;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** Was ein Anhang auf der Leitung hoechstens sein darf — quoted-printable blaeht mehr als base64. */
const MAX_ATTACHMENT_WIRE = 60 * 1024 * 1024;
const MAX_FILENAME = 150;
const CACHE_VERSION = 1;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const PUBLIC_ERRORS = new Set(['auth_failed', 'unreachable', 'tls_failed', 'timeout']);
const INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
]);
const MIME_TOKEN = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;
/** Typen, die ein Browser als Seite oder Skript liest — sie gehen nur als Bytes hinaus. */
const ACTIVE_TYPE = /html|xml|javascript|ecmascript|svg/;
const SANDBOX_POLICY = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";

const reply = (status, body) => ({ status, body });

/** Fehler als `{ status, error }`: eine verschwundene Mail ist `not_found`, kein Netzfehler. */
function errorOf(error) {
  const code = error instanceof MailError ? error.code : '';
  if (code === 'stale' || (code === 'protocol' && error.status)) {
    return { status: 404, error: 'not_found' };
  }
  if (code === 'too_large') return { status: 413, error: 'too_large' };
  if (PUBLIC_ERRORS.has(code)) return { status: 400, error: code };
  return { status: 400, error: 'unreachable' };
}

function sendJson(res, status, body, cors) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    ...cors,
  });
  res.end(text);
}

/** Hoechstens `max` Bytes UTF-8, ohne ein Zeichen zu zerteilen. */
function capBytes(text, max) {
  if (Buffer.byteLength(text, 'utf8') <= max) return text;
  return Buffer.from(text, 'utf8')
    .subarray(0, max)
    .toString('utf8')
    .replace(/\uFFFD$/, '');
}

// ------------------------------------------------------------------ Dateinamen

function extensionOf(mime) {
  const subtype = String(mime).split('/')[1] ?? '';
  return /^[a-z0-9]{1,8}$/.test(subtype) ? `.${subtype}` : '';
}

/** Ohne Pfad, Steuerzeichen und Punkte am Rand; leer wird `attachment.<typ>`. */
function safeFilename(name, mime) {
  const cleaned = String(name ?? '')
    .toWellFormed()
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^[\s.]+/, '');
  const short = Array.from(cleaned)
    .slice(0, MAX_FILENAME)
    .join('')
    .replace(/[\s.]+$/, '');
  return short.length > 0 ? short : `attachment${extensionOf(mime)}`;
}

/** RFC 6266: ein ASCII-Name fuer alte Clients, der echte in `filename*` (RFC 8187). */
function dispositionHeader(kind, filename) {
  const ascii = filename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\%;]/g, '_');
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function attachmentHeaders(leaf, cors = {}) {
  const mime = leaf.mime === 'image/jpg' ? 'image/jpeg' : leaf.mime;
  const inline = INLINE_TYPES.has(mime);
  const type =
    inline || (MIME_TOKEN.test(mime) && !ACTIVE_TYPE.test(mime))
      ? mime
      : 'application/octet-stream';
  return {
    'Content-Type': type,
    'Content-Disposition': dispositionHeader(
      inline ? 'inline' : 'attachment',
      safeFilename(leaf.filename, mime),
    ),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=600',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    // Chromes PDF-Ansicht vertraegt keine Sandbox; alles andere bekommt eine.
    ...(mime === 'application/pdf' ? {} : { 'Content-Security-Policy': SANDBOX_POLICY }),
    ...cors,
  };
}

const attachmentPath = (id, index) => `/v1/mail/messages/${id}/attachments/${index}`;

// ------------------------------------------------------------------ Dienst

function createBodies({ dataDir, vault, sync }) {
  const cacheDir = path.join(dataDir, 'mail-cache');
  const inflight = new Map();
  const cacheFile = (id) => path.join(cacheDir, `${id}.json`);

  async function findMessage(id) {
    if (!ID_PATTERN.test(String(id ?? ''))) return null;
    const db = await load();
    const row = rowsOf(db, 'mailMessages').find((entry) => entry.id === id);
    const account = row
      ? rowsOf(db, 'mailAccounts').find((entry) => entry.id === row.mailAccountId)
      : null;
    return row && account ? { row, account } : null;
  }

  /** Oeffnet den Ordner der Mail, prueft UIDVALIDITY und holt ihre BODYSTRUCTURE. */
  async function withMessage(found, task) {
    const password = await vault.get(found.account.id).catch(() => null);
    if (password === null) throw new MailError('auth_failed');
    const state = await sync.stateOf(found.account.id);
    return withImap(sync.imapOptions(found.account, password), async (client) => {
      const box = await client.select(found.row.folder);
      const known = state?.folders?.[found.row.folder]?.uidValidity;
      // Neue UIDVALIDITY heisst: die gemerkte UID meint eine andere Mail.
      if (known !== undefined && box.uidValidity !== null && known !== box.uidValidity) {
        throw new MailError('stale');
      }
      const entries = await client.fetch(String(found.row.uid), '(UID BODYSTRUCTURE)', {
        uid: true,
      });
      const entry = entries.find((item) => item.uid === found.row.uid);
      if (!entry || !entry.structure) throw new MailError('stale');
      return task(client, entry.structure);
    });
  }

  // -------------------------------------------------------------- HTML

  async function readText(client, uid, leaf) {
    const items = `(UID BODY.PEEK[${leaf.section}]<0.${MAX_ENCODED_BODY}>)`;
    const entries = await client.fetch(String(uid), items, { uid: true });
    const entry = entries.find((item) => item.uid === uid);
    if (!entry || entry.body === null) return '';
    return decodeBytes(decodeTransfer(entry.body, leaf.encoding), leaf.charset);
  }

  function fetchBody(found) {
    return withMessage(found, async (client, structure) => {
      const { plain, html } = bodyPartsOf(structure);
      const uid = found.row.uid;
      const htmlText = html ? capBytes(await readText(client, uid, html), MAX_BODY_BYTES) : null;
      const plainText = plain ? await readText(client, uid, plain) : null;
      const source =
        plainText ?? (htmlText !== null ? htmlToText(htmlText) : String(found.row.text ?? ''));
      const cids = attachmentLeavesOf(structure).flatMap((leaf, index) =>
        leaf.contentId ? [[leaf.contentId.toLowerCase(), index]] : [],
      );
      return { html: htmlText, text: capBytes(normaliseText(source), MAX_BODY_BYTES), cids };
    });
  }

  async function readCache(id) {
    try {
      const entry = await readJson(cacheFile(id), null);
      if (!entry || entry.v !== CACHE_VERSION) return null;
      const now = new Date();
      // Gelesen heisst frisch: beim Aufraeumen gehen zuerst die lange nicht geoeffneten.
      await fs.utimes(cacheFile(id), now, now).catch(() => {});
      return entry;
    } catch {
      return null;
    }
  }

  async function prune() {
    const names = (await fs.readdir(cacheDir)).filter((name) => name.endsWith('.json'));
    if (names.length <= MAX_CACHED_BODIES) return;
    const dated = await Promise.all(
      names.map(async (name) => ({
        name,
        at: await fs.stat(path.join(cacheDir, name)).then(
          (stat) => stat.mtimeMs,
          () => 0,
        ),
      })),
    );
    dated.sort((a, b) => a.at - b.at);
    await Promise.all(
      dated
        .slice(0, names.length - MAX_CACHED_BODIES)
        .map(({ name }) => fs.rm(path.join(cacheDir, name), { force: true })),
    );
  }

  async function writeCache(id, entry) {
    try {
      await writeJsonAtomic(cacheFile(id), { v: CACHE_VERSION, ...entry });
      await prune();
    } catch (error) {
      process.stderr.write(`[mail] Zwischenspeicher: ${error?.code ?? error?.name ?? 'Error'}\n`);
    }
  }

  /** Zwei gleichzeitige Anfragen fuer dieselbe Mail teilen sich einen Abruf. */
  function loadOnce(id, found) {
    const running = inflight.get(id);
    if (running) return running;
    const next = fetchBody(found)
      .then(async (fresh) => {
        await writeCache(id, fresh);
        return fresh;
      })
      .finally(() => inflight.delete(id));
    inflight.set(id, next);
    return next;
  }

  /** `{ html, text, remoteImages, inlineAttachments }` — `html` ist gesaeubert oder `null`. */
  async function body(id, allowRemoteImages) {
    const found = await findMessage(id);
    if (!found) return reply(404, { error: 'not_found' });
    let entry = await readCache(id);
    if (!entry) {
      try {
        entry = await loadOnce(id, found);
      } catch (error) {
        const mapped = errorOf(error);
        return reply(mapped.status, { error: mapped.error });
      }
    }
    const cids = new Map(Array.isArray(entry.cids) ? entry.cids : []);
    const resolveCid = (cid) => {
      const index = cids.get(cid.toLowerCase());
      return index === undefined ? null : { index, url: attachmentPath(id, index) };
    };
    const clean =
      typeof entry.html === 'string'
        ? sanitizeHtml(entry.html, { allowRemoteImages, resolveCid })
        : null;
    return reply(200, {
      html: clean ? clean.html : null,
      text: typeof entry.text === 'string' ? entry.text : '',
      remoteImages: clean ? clean.remoteImages : 0,
      inlineAttachments: clean ? clean.inlineAttachments : [],
    });
  }

  // -------------------------------------------------------------- Anhaenge

  async function serveAttachment(res, id, indexText, cors = {}) {
    const index = /^\d{1,3}$/.test(String(indexText ?? '')) ? Number(indexText) : -1;
    const found = index >= 0 ? await findMessage(id) : null;
    if (!found) return sendJson(res, 404, { error: 'not_found' }, cors);
    const stored = Array.isArray(found.row.attachments) ? found.row.attachments[index] : undefined;
    if (Number(stored?.size) > MAX_ATTACHMENT_BYTES) {
      return sendJson(res, 413, { error: 'too_large' }, cors);
    }

    let headers = null;
    let started = false;
    let total = 0;
    const forward = (bytes) => {
      if (bytes.length === 0) return;
      total += bytes.length;
      if (total > MAX_ATTACHMENT_BYTES) throw new MailError('too_large');
      if (!started) res.writeHead(200, headers);
      started = true;
      res.write(bytes);
    };

    try {
      await withMessage(found, async (client, structure) => {
        const leaf = attachmentLeavesOf(structure)[index];
        if (!leaf) throw new MailError('stale');
        if (leaf.size > MAX_ATTACHMENT_BYTES) throw new MailError('too_large');
        headers = attachmentHeaders(leaf, cors);
        const decoder = createDecoder(leaf.encoding);
        let streamed = false;
        const entries = await client.fetch(
          String(found.row.uid),
          `(UID BODY.PEEK[${leaf.section}])`,
          {
            uid: true,
            maxStream: MAX_ATTACHMENT_WIRE,
            sink: (chunk) => {
              streamed = true;
              forward(decoder.write(chunk));
            },
          },
        );
        const entry = entries.find((item) => item.uid === found.row.uid);
        if (!entry || entry.body === null) throw new MailError('stale');
        // Kleine Teile schickt mancher Server als gequoteten Text statt als Literal.
        if (!streamed) forward(decoder.write(entry.body));
        forward(decoder.end());
      });
    } catch (error) {
      // Einmal begonnen, laesst sich kein Fehler mehr melden — nur abbrechen.
      if (started) return res.destroy();
      const mapped = errorOf(error);
      return sendJson(res, mapped.status, { error: mapped.error }, cors);
    }
    if (!started) res.writeHead(200, headers);
    res.end();
    return undefined;
  }

  /** Vergisst die zwischengespeicherten Texte dieser Mails. */
  async function forget(ids) {
    await Promise.all(
      [...ids]
        .filter((id) => ID_PATTERN.test(String(id)))
        .map((id) => fs.rm(cacheFile(id), { force: true }).catch(() => {})),
    );
  }

  return { body, serveAttachment, forget };
}

module.exports = {
  MAX_ATTACHMENT_BYTES,
  MAX_BODY_BYTES,
  MAX_CACHED_BODIES,
  attachmentHeaders,
  createBodies,
  safeFilename,
};
