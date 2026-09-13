/**
 * Senden mit „Rueckgaengig“: eine Mail wartet `delayMs` im Dienst, bevor sie
 * hinausgeht. Sie wartet hier und nicht in der App, damit sie auch dann
 * hinausgeht, wenn die App gleich danach geschlossen wird.
 *
 * Wartende Mails stehen in `<datenordner>/mail-outbox.json` (fertig gebaut,
 * ohne Passwort) und ueberstehen so einen Neustart des Dienstes. Eine Mail, die
 * beim Absturz gerade unterwegs war, gilt als fehlgeschlagen: ob sie beim
 * Mailserver ankam, weiss niemand, und doppelt senden waere schlimmer.
 *
 * Zustaende: `pending` → `sending` → `sent` | `failed`, oder `pending` →
 * `cancelled`. Wie es ausging, weiss der Dienst noch zehn Minuten.
 */
const { createQueue, readJson, writeJsonAtomic } = require('../files.js');

const FINISHED_MEMORY_MS = 10 * 60 * 1000;

function createOutbox({ file, deliver, onFailure = async () => {}, now = () => Date.now() }) {
  const enqueue = createQueue();
  const timers = new Map();
  const finished = new Map();
  let jobs = null;
  let loading = null;

  function ready() {
    loading =
      loading ??
      readJson(file, {})
        .catch((error) => {
          process.stderr.write(`[mail] Postausgang unlesbar: ${error?.name ?? 'Error'}\n`);
          return {};
        })
        .then((stored) => {
          const entries = Object.entries(stored ?? {}).filter(
            ([id, job]) => job && typeof job === 'object' && job.sendId === id,
          );
          jobs = new Map(entries);
        });
    return loading;
  }

  const persist = () =>
    enqueue(() => writeJsonAtomic(file, Object.fromEntries(jobs))).catch((error) => {
      process.stderr.write(`[mail] Postausgang nicht gesichert: ${error?.code ?? 'Error'}\n`);
    });

  function remember(job, state, error) {
    const at = now();
    for (const [id, entry] of finished) {
      if (entry.at < at - FINISHED_MEMORY_MS) finished.delete(id);
    }
    finished.set(job.sendId, { state, error, sendAt: job.sendAt, at });
  }

  async function run(job) {
    let error = null;
    try {
      await deliver(job);
    } catch (caught) {
      error = typeof caught?.code === 'string' ? caught.code : 'send_failed';
    }
    jobs.delete(job.sendId);
    remember(job, error ? 'failed' : 'sent', error);
    await persist();
    if (error) await Promise.resolve(onFailure(job, error)).catch(() => {});
  }

  /** Ohne `await` bis zum Umschalten auf `sending` — so kommt kein Abbrechen dazwischen. */
  function fire(sendId) {
    timers.delete(sendId);
    const job = jobs.get(sendId);
    if (!job || job.state !== 'pending') return;
    const claimed = { ...job, state: 'sending' };
    jobs.set(sendId, claimed);
    void persist();
    void run(claimed);
  }

  function arm(job) {
    const timer = setTimeout(() => fire(job.sendId), Math.max(0, Date.parse(job.sendAt) - now()));
    timer.unref?.();
    timers.set(job.sendId, timer);
  }

  /** Nimmt eine fertig gebaute Mail an (`sendId`, `sendAt` ISO, …) und sendet sie zur Zeit. */
  async function schedule(job) {
    await ready();
    const entry = { ...job, state: 'pending' };
    jobs.set(entry.sendId, entry);
    await persist();
    if (jobs.get(entry.sendId)?.state === 'pending' && !timers.has(entry.sendId)) arm(entry);
    return { sendId: entry.sendId, sendAt: entry.sendAt };
  }

  /** `cancelled` (auch zum zweiten Mal), `already_sent` oder `not_found`. */
  async function cancel(sendId) {
    await ready();
    const job = jobs.get(sendId);
    if (job?.state === 'pending') {
      clearTimeout(timers.get(sendId));
      timers.delete(sendId);
      jobs.delete(sendId);
      remember(job, 'cancelled', null);
      await persist();
      return 'cancelled';
    }
    if (job) return 'already_sent';
    const done = finished.get(sendId);
    if (!done) return 'not_found';
    return done.state === 'cancelled' ? 'cancelled' : 'already_sent';
  }

  /** `{ sendId, state, sendAt, error }` oder `null`. Nie der Inhalt der Mail. */
  async function status(sendId) {
    await ready();
    const job = jobs.get(sendId);
    if (job) return { sendId, state: job.state, sendAt: job.sendAt, error: null };
    const done = finished.get(sendId);
    return done ? { sendId, state: done.state, sendAt: done.sendAt, error: done.error } : null;
  }

  /** Nach dem Start: Wartendes neu stellen, Unterbrochenes als fehlgeschlagen melden. */
  async function resume() {
    await ready();
    const interrupted = [];
    for (const job of [...jobs.values()]) {
      if (job.state === 'pending') {
        if (!timers.has(job.sendId)) arm(job);
        continue;
      }
      jobs.delete(job.sendId);
      remember(job, 'failed', 'send_failed');
      interrupted.push(job);
    }
    await persist();
    for (const job of interrupted) {
      await Promise.resolve(onFailure(job, 'send_failed')).catch(() => {});
    }
  }

  /** Ein getrenntes Postfach kann nicht mehr senden: seine wartenden Mails fallen weg. */
  async function dropMailbox(mailAccountId) {
    await ready();
    for (const job of [...jobs.values()]) {
      if (job.mailAccountId !== mailAccountId || job.state !== 'pending') continue;
      clearTimeout(timers.get(job.sendId));
      timers.delete(job.sendId);
      jobs.delete(job.sendId);
      remember(job, 'cancelled', null);
    }
    await persist();
  }

  /** Nur fuer Tests: alle Wecker aus, als waere der Dienst beendet. */
  function stop() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  }

  return { schedule, cancel, status, resume, dropMailbox, stop };
}

module.exports = { createOutbox };
