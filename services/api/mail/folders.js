/**
 * Welche Ordner ein Postfach fuehrt.
 *
 * IMAP nennt sie so, wie der Anbieter will: `[Gmail]/Papierkorb`, `INBOX.Spam`,
 * `Gel&APY-scht`. Hier werden daraus sechs feste Rollen, damit die Apps ueber
 * alle Anbieter hinweg dasselbe meinen — erst nach Special-Use (RFC 6154),
 * dann nach dem Namen des letzten Abschnitts.
 *
 * Je Rolle hoechstens ein Ordner, und je Ordner hoechstens eine Rolle: was
 * schon als Papierkorb gilt, wird nicht auch noch zum Archiv.
 */
const { decodeMailboxName } = require('./imap.js');

/** In dieser Reihenfolge wird gesucht und spaeter angezeigt. */
const FOLDER_ROLES = ['inbox', 'sent', 'drafts', 'junk', 'trash', 'archive'];

const SPECIAL_USE = {
  sent: '\\sent',
  drafts: '\\drafts',
  junk: '\\junk',
  trash: '\\trash',
  archive: '\\archive',
};

/**
 * Bekannte Namen, klein geschrieben. Gmails „All Mail“ fehlt mit Absicht: das
 * ist eine Kopie des ganzen Postfachs, kein Archiv.
 */
const FOLDER_NAMES = {
  inbox: ['inbox', 'posteingang'],
  sent: [
    'sent',
    'gesendet',
    'gesendete elemente',
    'gesendete objekte',
    'gesendete nachrichten',
    'sent items',
    'sent messages',
    'sent mail',
  ],
  drafts: ['drafts', 'draft', 'entwürfe', 'entwuerfe', 'entwurf'],
  junk: [
    'junk',
    'spam',
    'junk e-mail',
    'junk-e-mail',
    'junkemail',
    'bulk mail',
    'unerwünscht',
    'unerwünschte werbung',
  ],
  trash: [
    'trash',
    'papierkorb',
    'gelöscht',
    'gelöschte elemente',
    'gelöschte objekte',
    'gelöschte nachrichten',
    'deleted',
    'deleted items',
    'deleted messages',
    'bin',
  ],
  archive: ['archive', 'archiv', 'archived'],
};

function isRole(value) {
  return typeof value === 'string' && FOLDER_ROLES.includes(value);
}

/** Ordner, die man ueberhaupt oeffnen kann. */
function selectable(folders) {
  return folders.filter(
    (folder) => !folder.flags.some((flag) => /^\\(noselect|nonexistent)$/i.test(flag)),
  );
}

/** `INBOX.Gel&APY-scht` mit Trenner `.` -> `gelöscht` */
function lastSegment(folder) {
  const decoded = decodeMailboxName(folder.name);
  const segments = folder.delimiter ? decoded.split(folder.delimiter) : [decoded];
  return String(segments[segments.length - 1])
    .trim()
    .toLowerCase();
}

function pick(folders, role) {
  const use = SPECIAL_USE[role];
  const byUse = use
    ? folders.find((folder) => folder.flags.some((flag) => flag.toLowerCase() === use))
    : undefined;
  if (byUse) return byUse.name;
  const names = FOLDER_NAMES[role];
  const byName = folders.find((folder) => names.includes(lastSegment(folder)));
  return byName ? byName.name : null;
}

/**
 * Aus einer LIST-Antwort die Ordner mit Rolle. Der Posteingang ist immer dabei:
 * `INBOX` gibt es laut RFC 3501 in jedem Postfach, auch wenn LIST ihn verschweigt.
 */
function discoverFolders(list) {
  let free = selectable(Array.isArray(list) ? list : []);
  const found = [];
  for (const role of FOLDER_ROLES) {
    const name = role === 'inbox' ? (pick(free, role) ?? 'INBOX') : pick(free, role);
    if (name === null) continue;
    free = free.filter((folder) => folder.name !== name);
    found.push({ role, name });
  }
  return found;
}

/** Der Name des Ordners mit dieser Rolle — `null`, wenn das Postfach keinen hat. */
function folderNameFor(folders, role) {
  const found = (folders ?? []).find((folder) => folder.role === role);
  return found ? found.name : null;
}

const findTrash = (list) => folderNameFor(discoverFolders(list), 'trash');
const findSent = (list) => folderNameFor(discoverFolders(list), 'sent');

/** Der Ordner einer Rolle: aus dem gemerkten Stand eines Postfachs, sonst frisch vom Server. */
async function resolveFolder(client, knownFolders, role) {
  const known = folderNameFor(knownFolders, role);
  if (known) return known;
  return folderNameFor(discoverFolders(await client.list()), role);
}

module.exports = {
  FOLDER_ROLES,
  discoverFolders,
  findSent,
  findTrash,
  folderNameFor,
  isRole,
  resolveFolder,
};
