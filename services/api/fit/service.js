/**
 * Better Fit im Dienst: haelt Ablage, Katalog und Einstellungen zusammen und
 * gibt die Routen heraus, die `server.js` einhaengt.
 *
 * Jede Route hier ist `auth: true` — `server.js` prueft das Token, bevor sie
 * laeuft, und reicht nur `auth.accountId` weiter. Eine Route liest und
 * schreibt ausschliesslich ueber `tx.forOwner(auth.accountId)`.
 */
const path = require('node:path');

const { createCatalog } = require('./catalog/index.js');
const { fitConfig } = require('./config.js');
const { createFitStore } = require('./store.js');
const { analysisRoutes } = require('./routes/analysis.js');
const { diaryRoutes } = require('./routes/diary.js');
const { coachRoutes } = require('./routes/coach.js');
const { kitchenRoutes } = require('./routes/kitchen.js');
const { packagedRoutes } = require('./routes/packaged.js');
const { trainingRoutes } = require('./routes/training.js');
const { createTools } = require('./tools/index.js');
const { fitStats } = require('./stats.js');
const { createTempImages } = require('./tempImages.js');
const { createUsage } = require('./usage.js');

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

/** `YYYY-MM-DD` in der Zeitzone der Person (Standard Zuerich). */
function todayIn(timezone = 'Europe/Zurich', now = new Date()) {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value) => typeof value === 'string' && DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

function shiftDay(day, delta) {
  const date = new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86400000);
  return date.toISOString().slice(0, 10);
}

const ok = (status, body) => ({ status, body });

/** Ist die Ablage kaputt (`fit.json` unlesbar), antwortet jede Route ehrlich mit 503. */
const guarded = (handler) => async (request) => {
  try {
    return await handler(request);
  } catch (error) {
    if (error?.code === 'store_unavailable') return ok(503, { error: 'store_unavailable' });
    throw error;
  }
};

function createFitService({ dataDir, env = process.env, now = () => new Date(), ai = null, calendar = null }) {
  const config = fitConfig(env);
  const store = createFitStore({ dataDir, now: () => now().getTime() });
  const catalog = createCatalog({ dataDir, mode: config.mode });

  /**
   * Dieselbe Anfrage mit demselben `Idempotency-Key` zweimal: die zweite
   * bekommt die Antwort der ersten, statt eine zweite Mahlzeit anzulegen.
   *
   * Atomar in drei Schritten: in einer Transaktion wird der Schluessel als
   * `pending` reserviert (oder die gemerkte Antwort geholt), dann laeuft die
   * Arbeit, dann wird die Antwort gemerkt — oder bei einem Fehler die
   * Reservierung wieder freigegeben. Ein zweiter Aufruf, waehrend der erste
   * noch arbeitet, wartet auf ihn (im selben Prozess) und bekommt dieselbe
   * Antwort; sonst `409 in_progress`.
   */
  const running = new Map();
  async function once(accountId, key, work) {
    if (key === null || key === undefined) return work();
    if (!IDEMPOTENCY_PATTERN.test(key)) return ok(400, { error: 'idempotency_key_invalid' });
    const slot = `${accountId} ${key}`;
    const waiting = running.get(slot);
    if (waiting) return waiting;

    const task = (async () => {
      const claim = await store.transact((tx) => {
        const own = tx.forOwner(accountId);
        const fresh = (row) => Date.parse(row.at) > now().getTime() - IDEMPOTENCY_TTL_MS;
        for (const row of own.list('idempotency')) {
          if (!fresh(row) && row.key !== key) own.remove('idempotency', row.id);
        }
        const known = own.list('idempotency', (row) => row.key === key)[0];
        if (known && fresh(known)) return known.status === 'pending' ? { busy: true } : { response: known.response };
        if (known) own.remove('idempotency', known.id);
        const row = own.insert('idempotency', { key, at: now().toISOString(), status: 'pending', response: null });
        return { rowId: row.id };
      });
      if (claim.response) return claim.response;
      // Reserviert, aber nicht von diesem Prozess (oder aus einem Absturz): ehrlich sagen.
      if (claim.busy) return ok(409, { error: 'in_progress' });

      let response;
      try {
        response = await work();
      } catch (error) {
        await store.transact((tx) => tx.forOwner(accountId).remove('idempotency', claim.rowId)).catch(() => {});
        throw error;
      }
      await store.transact((tx) => {
        const own = tx.forOwner(accountId);
        // Nur Erfolge merken — ein Fehler darf mit demselben Schluessel nochmal versucht werden.
        if (response.status < 300) own.update('idempotency', claim.rowId, { status: 'done', at: now().toISOString(), response });
        else own.remove('idempotency', claim.rowId);
      });
      return response;
    })();
    // Sofort eintragen, noch vor dem ersten await: ein gleichzeitiger Aufruf wartet auf dieselbe Antwort.
    running.set(slot, task);
    try {
      return await task;
    } finally {
      if (running.get(slot) === task) running.delete(slot);
    }
  }

  const images = createTempImages({ dataDir, keptDays: config.keptImageDays });
  // `ai`: der KI-Dienst des Projekts fuer freie Fragen an den Coach (mit Abo-Kontingent).
  // `calendar(accountId, day)`: Titel der eigenen Termine an einem Tag, fuer das Verschieben.
  const context = { config, store, catalog, images, ok, now, todayIn, isDay, shiftDay, once, dataDir, ai, calendar };
  const engine = createTools(context);
  const routes = [
    ...packagedRoutes(context),
    ...diaryRoutes(context),
    ...analysisRoutes(context),
    ...kitchenRoutes(context, engine),
    ...trainingRoutes(context, engine),
    ...coachRoutes(context, engine),
  ].map((route) => ({ ...route, auth: true, handler: guarded(route.handler) }));

  /** Alles eines Kontos weg: Zeilen, wartende und behaltene Fotos. Fuer das Loeschen im Admin. */
  async function removeAccount(accountId) {
    const pending = await store.read((tx) => tx.forOwner(accountId).list('mealAnalyses').flatMap((row) => row.tempImages ?? []));
    await images.remove(pending);
    await images.removeKept(accountId);
    await store.transact((tx) => tx.forOwner(accountId).removeEverything());
  }

  const usage = createUsage({ store, config, now });
  const stats = (month) => fitStats({ store, usage, now }, month);

  return { routes, config, store, catalog, context, engine, removeAccount, stats };
}

module.exports = { createFitService, todayIn, isDay, shiftDay, IDEMPOTENCY_TTL_MS };

// Damit Werkzeuge wie der Import den Ordner finden, ohne den Dienst zu starten.
module.exports.defaultDataDir = () => path.join(__dirname, '..', 'data');
