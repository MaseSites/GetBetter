/**
 * Das Kassenbuch im Speicher: was jedes Konto in jeder App diesen Monat (in
 * Zuerich) fuer KI und Stimme verbraucht hat — dazu, was gerade reserviert ist.
 *
 * Beim ersten Gebrauch liest es `ai-usage.jsonl` und `speech-usage.jsonl` ueber
 * die bestehenden Leser (`readUsage`, `readSpeechUsage`) — so stimmt es auch
 * nach einem Neustart. Danach waechst es mit jeder neuen Zeile (`addAi`,
 * `addSpeech`), ohne die Dateien erneut zu lesen.
 *
 * Reservieren (`hold`) haelt den schlimmsten Fall fest, bevor ein bezahlter
 * Aufruf losgeht; `release` gibt ihn frei, sobald die echte Zeile gebucht ist.
 * So koennen parallele Anfragen das Budget nicht zusammen ueberschreiten.
 * Wer `spentChf` und `hold` nacheinander ohne `await` dazwischen ruft (nach
 * `await ready()`), prueft und reserviert in einem Zug.
 */
const crypto = require('node:crypto');

const { readUsage } = require('../ai/usage.js');
const { readSpeechUsage } = require('../speech/usage.js');
const { aiChfOf, keyOf, monthSums, speechEntryChfOf, speechSettings } = require('./costs.js');
const { readFromOf, zurichMonthOf } = require('./month.js');

/** Laenger lebt keine Reservierung — so viel wie ein Ticket der Stimmen. */
const DEFAULT_HOLD_MS = 10 * 60 * 1000;
const EMPTY = Object.freeze({ aiChf: 0, speechChf: 0 });

/**
 * `createLedger({ dataDir, now?, speech?, readAi?, readSpeech? })` — alles
 * ausser `dataDir` nur fuer Tests.
 */
function createLedger({
  dataDir,
  now = Date.now,
  speech = speechSettings(),
  readAi = readUsage,
  readSpeech = readSpeechUsage,
} = {}) {
  /** `Map<monat, Map<"app|konto", { aiChf, speechChf }>>` — nur der laufende und der vorige Monat. */
  const months = new Map();
  const holds = new Map();
  let state = 'idle';
  let loading = null;
  let pending = [];

  const currentMonth = () => zurichMonthOf(now());

  function bucketOf(month) {
    const known = months.get(month);
    if (known) return known;
    const fresh = new Map();
    months.set(month, fresh);
    // Aeltere Monate braucht niemand mehr.
    const keep = [...months.keys()].sort().slice(-2);
    for (const key of months.keys()) if (!keep.includes(key)) months.delete(key);
    return fresh;
  }

  function book(entry, field, chf) {
    if (!(chf > 0) || typeof entry?.accountId !== 'string' || typeof entry?.app !== 'string') return;
    const month = zurichMonthOf(entry.at ?? now());
    if (month === null) return;
    const bucket = bucketOf(month);
    const key = keyOf(entry.app, entry.accountId);
    const known = bucket.get(key) ?? EMPTY;
    bucket.set(key, { ...known, [field]: known[field] + chf });
  }

  async function load() {
    const month = currentMonth();
    const from = readFromOf(month);
    const [ai, spoken] = await Promise.all([readAi(dataDir, { from }), readSpeech(dataDir, { from })]);
    months.set(month, monthSums(ai, spoken, month, speech).sums);
    state = 'done';
    // Was waehrend des Lesens dazukam, zaehlt — lieber einmal zu viel als zu wenig.
    const late = pending;
    pending = [];
    for (const [entry, field, chf] of late) book(entry, field, chf);
  }

  /** Einmal die Protokolle lesen. Jede Pruefung wartet darauf. */
  function ready() {
    if (!loading) {
      state = 'loading';
      loading = load().catch((error) => {
        // Unlesbar heisst nicht gratis: ohne Stand bleibt es beim leeren Buch, aber es wird gemeldet.
        process.stderr.write(`[billing] Protokolle lesen: ${error?.name ?? 'Error'}\n`);
        state = 'done';
      });
    }
    return loading;
  }

  function add(entry, field, chf) {
    // Vor dem ersten Lesen steht die Zeile ohnehin in der Datei.
    if (state === 'idle') return;
    if (state === 'loading') {
      pending = [...pending, [entry, field, chf]];
      return;
    }
    book(entry, field, chf);
  }

  const addAi = (entry) => add(entry, 'aiChf', aiChfOf(entry));
  const addSpeech = (entry) => add(entry, 'speechChf', speechEntryChfOf(entry, speech));

  /** Nur im Speicher dazubuchen — etwa den schlimmsten Fall einer Anfrage, die ins Zeitlimit lief. */
  function charge(accountId, app, chf) {
    add({ accountId, app, at: new Date(now()).toISOString() }, 'aiChf', chf);
  }

  function activeHolds(key, month) {
    const time = now();
    let total = 0;
    for (const [id, held] of holds) {
      if (held.expires < time) holds.delete(id);
      else if (held.key === key && held.month === month) total += held.chf;
    }
    return total;
  }

  /** `{ aiChf, speechChf, heldChf }` dieses Monats. */
  function usageOf(accountId, app) {
    const month = currentMonth();
    const key = keyOf(app, accountId);
    const known = months.get(month)?.get(key) ?? EMPTY;
    return { aiChf: known.aiChf, speechChf: known.speechChf, heldChf: activeHolds(key, month) };
  }

  /** Verbraucht und reserviert, zusammen. */
  function spentChf(accountId, app) {
    const { aiChf, speechChf, heldChf } = usageOf(accountId, app);
    return aiChf + speechChf + heldChf;
  }

  /** Haelt `chf` fest und gibt die Id der Reservierung zurueck. */
  function hold(accountId, app, chf, ttlMs = DEFAULT_HOLD_MS) {
    const id = crypto.randomBytes(12).toString('hex');
    holds.set(id, {
      key: keyOf(app, accountId),
      month: currentMonth(),
      chf: Math.max(0, chf),
      expires: now() + ttlMs,
    });
    return id;
  }

  /** Gibt eine Reservierung frei; unbekannte oder abgelaufene tun nichts. */
  function release(id) {
    holds.delete(id);
  }

  return { ready, addAi, addSpeech, charge, usageOf, spentChf, hold, release, currentMonth };
}

module.exports = { DEFAULT_HOLD_MS, createLedger };
