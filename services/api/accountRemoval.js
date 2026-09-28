/**
 * Ein Konto ganz entfernen — dieselben Regeln fuer den Admin und fuer die
 * Person selbst („Konto loeschen“ in der App, Apple-Richtlinie 5.1.1(v)).
 *
 * Was genau wegfaellt, rechnet `admin/deletion.js` (getestet): Konto, private
 * Zeilen samt Kindern, eigene Kalender, Freigaben, Mitteilungen, Postfaecher
 * (ueber den Mail-Dienst, mit Tresor), Bilder ohne andere Verweise; Geteiltes
 * mit einem Haushalt, in dem noch jemand ist, bleibt. Better Fit (`fit.json`,
 * Fotos) geht ueber `fit.removeAccount` mit.
 *
 * `backup: true` (nur der Admin) legt vorher eine Sicherung ohne Salt und Hash
 * nach `deleted-accounts/`. Wer selbst loescht, bekommt keine: geloescht heisst
 * geloescht.
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const { applyPlan, backupOf, countsOf, planAccountDeletion } = require('./admin/deletion.js');
const { load, rememberDeleted, rowsOf, save } = require('./store.js');
const { deleteUpload } = require('./uploads.js');

const BACKUP_DIR = 'deleted-accounts';
const MAX_BACKUP_ID = 100;
/** Diese Sammlungen raeumt der Mail-Dienst selbst — mit Tresor, Cache und Postausgang. */
const MAIL_COLLECTIONS = ['mailAccounts', 'mailMessages'];

/** `<datenordner>/deleted-accounts/<konto>-<zeit>.json`; die Id wird fuer den Namen entschaerft. */
async function writeBackup(dataDir, backup) {
  const directory = path.resolve(dataDir, BACKUP_DIR);
  const safeId = String(backup.accountId)
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, MAX_BACKUP_ID);
  const file = path.join(directory, `${safeId}-${backup.deletedAt.replace(/[:.]/g, '-')}.json`);
  if (path.dirname(file) !== directory) throw new Error('backup_outside_data_dir');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(backup, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

function withoutCollections(plan, names) {
  const remove = Object.fromEntries(
    Object.entries(plan.remove).filter(([name]) => !names.includes(name)),
  );
  return { ...plan, remove };
}

/** Ein fehlendes Bild ist kein Fehler (`deleteUpload` sagt dann 404); alles andere nur ins Protokoll. */
async function removeUploads(ids) {
  for (const id of ids) {
    try {
      await deleteUpload(id);
    } catch (error) {
      process.stderr.write(`[konto] Bild loeschen: ${error?.name ?? 'Error'}\n`);
    }
  }
}

/**
 * Entfernt das Konto `id` ueberall. `{ dataDir, mail?, fit?, sessions? }`.
 * Gibt `{ ok: true, removed }` oder `{ ok: false, error: 'not_found' }`.
 * Die Sitzungen des Kontos enden zuletzt — erst wenn alles weg ist.
 */
async function removeAccount({ dataDir, mail = null, fit = null, sessions = null }, id, { backup = false } = {}) {
  const db = await load();
  if (!rowsOf(db, 'accounts').some((entry) => entry.id === id)) return { ok: false, error: 'not_found' };

  const plan = planAccountDeletion(db.tables, id);
  // Scheitert die Sicherung, bleibt alles, wie es war.
  if (backup) await writeBackup(dataDir, backupOf(db.tables, plan, new Date().toISOString()));

  const mailService = typeof mail?.removeAccount === 'function' ? mail : null;
  const local = mailService ? withoutCollections(plan, MAIL_COLLECTIONS) : plan;
  for (const [name, rows] of Object.entries(applyPlan(db.tables, local))) db.tables[name] = rows;
  // Eine App mit altem Stand schriebe die Zeilen sonst beim naechsten PUT zurueck.
  rememberDeleted(db, id, plan.remove);
  await save();
  for (const mailboxId of mailService ? (plan.remove.mailAccounts ?? []) : []) {
    await mailService.removeAccount(mailboxId);
  }
  await removeUploads(plan.uploadIds);
  // Better Fit liegt getrennt (fit.json, Fotos) — auch das geht mit.
  if (typeof fit?.removeAccount === 'function') await fit.removeAccount(id);
  if (typeof sessions?.revokeAccount === 'function') await sessions.revokeAccount(id);
  return { ok: true, removed: countsOf(plan) };
}

module.exports = { removeAccount };
