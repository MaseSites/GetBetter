/**
 * Was der Admin liest: Uebersicht, Konten, Aktivitaet, Kosten. Hier wird nur
 * gelesen — geschrieben wird in `server.js`. Salt und Hash kommen nie heraus,
 * und von den Stimmen nie ein Satz.
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const { kindMatches, ownerOf, readActivity } = require('../activity.js');
const { PRICES, readUsage, summarizeUsage } = require('../ai/usage.js');
const { zurichMonthOf } = require('../billing/month.js');
const { readCacheStats } = require('../speech/cache.js');
const { readSpeechUsage, summarizeSpeech } = require('../speech/usage.js');
const { load, rowsOf } = require('../store.js');
const { billingOf, marginOf, readMonthSums } = require('./billing.js');
const { APPS, APP_IDS, MODULE_COLLECTIONS, MODULE_LIST, countItems } = require('./catalog.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;
const DEFAULT_MONTHLY_MINIMUM_CHF = 95;
/** Der Gratis-Plan von ElevenLabs: 10'000 Credits im Monat. */
const DEFAULT_MONTHLY_SPEECH_CREDITS = 10_000;
const ACCOUNT_ACTIVITY_LIMIT = 200;
const RECENT_AI_LIMIT = 50;
const CHEAP_TIER = 'cheap_model';
const UNKNOWN = 'unknown';

const roundChf = (value) => Math.round(value * 1e6) / 1e6;
const costOf = (entry) => (Number.isFinite(entry.costChf) ? entry.costChf : 0);
const keyOrNull = (key) => (key === UNKNOWN ? null : key);

function timeOf(value) {
  if (typeof value !== 'string') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

const iso = (time) => new Date(time).toISOString();
const dayKey = (time) => iso(time).slice(0, 10);
const since = (entries, from) => entries.filter((entry) => (timeOf(entry.at) ?? 0) >= from);

function startOfUtcDay(time) {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcMonth(time) {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/** Beginn der letzten 30 Tage in UTC, heute eingeschlossen. */
const from30Of = (now) => startOfUtcDay(now) - (MONTH_DAYS - 1) * DAY_MS;

/** Eine Zahl aus der Umgebung, 0 oder mehr — sonst `fallback`. */
function numberOr(raw, fallback) {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** CHF 95, ausser `BETTER_AI_MONTHLY_MINIMUM_CHF` ist eine gueltige Zahl. */
const monthlyMinimumChf = () =>
  numberOr(process.env.BETTER_AI_MONTHLY_MINIMUM_CHF, DEFAULT_MONTHLY_MINIMUM_CHF);

/** 10'000 Credits, ausser `BETTER_SPEECH_MONTHLY_CREDITS` ist eine gueltige Zahl. */
const monthlySpeechCredits = () =>
  numberOr(process.env.BETTER_SPEECH_MONTHLY_CREDITS, DEFAULT_MONTHLY_SPEECH_CREDITS);

/** Die Grenzen des Zwischenspeichers, wie der Dienst sie liest. */
const cacheOptions = () => ({
  maxFiles: process.env.BETTER_SPEECH_CACHE_FILES,
  maxMb: process.env.BETTER_SPEECH_CACHE_MB,
});

/** `status()` liefert `{ status, body }` wie jede Route; scheitert es, gilt „nicht eingerichtet“. */
async function isConfigured(status) {
  if (typeof status !== 'function') return false;
  try {
    const result = await status();
    return (result?.body ?? result)?.configured === true;
  } catch {
    return false;
  }
}

/** Je Tag ab `from` (UTC) `{ day, requests, costChf }`, auch Tage ohne Anfrage. */
function dailyTotals(entries, from, count) {
  const days = new Map(
    Array.from({ length: count }, (_, index) => [
      dayKey(from + index * DAY_MS),
      { requests: 0, costChf: 0 },
    ]),
  );
  for (const entry of entries) {
    const at = timeOf(entry.at);
    const key = at === null ? null : dayKey(at);
    const bucket = key === null ? undefined : days.get(key);
    if (bucket) {
      days.set(key, { requests: bucket.requests + 1, costChf: roundChf(bucket.costChf + costOf(entry)) });
    }
  }
  return [...days].map(([day, bucket]) => ({ day, ...bucket }));
}

const sumCost = (entries) => roundChf(entries.reduce((total, entry) => total + costOf(entry), 0));

// ------------------------------------------------------------------ Verbrauch

/** Die KI-Summe ohne Fehlerzahl: `{ requests, promptTokens, completionTokens, tokens, costChf }`. */
function aiTotalsOf(entries) {
  const { requests, promptTokens, completionTokens, tokens, costChf } = summarizeUsage(entries).total;
  return { requests, promptTokens, completionTokens, tokens, costChf };
}

/** KI und Stimme eines Kontos, fuer die letzten 30 Tage und gesamt. */
function usageOf(aiEntries, speechEntries, from30) {
  return {
    last30: {
      ai: aiTotalsOf(since(aiEntries, from30)),
      speech: summarizeSpeech(since(speechEntries, from30)).total,
    },
    total: {
      ai: aiTotalsOf(aiEntries),
      speech: summarizeSpeech(speechEntries).total,
    },
  };
}

function entriesByAccount(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (typeof entry.accountId !== 'string') continue;
    const list = map.get(entry.accountId);
    if (list) list.push(entry);
    else map.set(entry.accountId, [entry]);
  }
  return map;
}

// ------------------------------------------------------------------ Konten

function accessByAccount(db) {
  const map = new Map();
  for (const row of rowsOf(db, 'appAccess')) {
    if (!row || typeof row.accountId !== 'string') continue;
    map.set(row.accountId, [...(map.get(row.accountId) ?? []), row]);
  }
  return map;
}

/** Der spaeteste (oder frueheste) gueltige Zeitpunkt eines Feldes, als gespeicherter Text. */
function extremeOf(rows, field, pickLater) {
  let best = null;
  for (const row of rows) {
    const time = timeOf(row[field]);
    if (time === null) continue;
    if (best === null || (pickLater ? time > best.time : time < best.time)) {
      best = { time, value: row[field] };
    }
  }
  return best?.value ?? null;
}

function appsOf(accessRows) {
  return APP_IDS.flatMap((appId) => {
    const rows = accessRows.filter((row) => row.appId === appId);
    if (rows.length === 0) return [];
    return [
      {
        id: appId,
        firstSeenAt: extremeOf(rows, 'firstSeenAt', false),
        lastSeenAt: extremeOf(rows, 'lastSeenAt', true),
      },
    ];
  });
}

const appListOf = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
const blockedAppsOf = (row) => appListOf(row.blockedApps);

const withinDays = (value, days, now) => {
  const time = timeOf(value);
  return time !== null && time >= now - days * DAY_MS;
};

/** Wem eine Zeile je Sammlung zaehlt — die Aemtli ueber `assignedTo`, sonst `ownerOf`. */
const COLLECTION_OWNERS = new Map(
  MODULE_COLLECTIONS.map((collection) => [
    collection,
    MODULE_LIST.find((module) => module.collection === collection && module.owner)?.owner ??
      ownerOf,
  ]),
);

/** Alle Zeilen eines Kontos ueber die Sammlungen der Funktionen, jede Sammlung einmal. */
function ownedItems(db, accountId) {
  let total = 0;
  for (const [collection, owner] of COLLECTION_OWNERS) {
    for (const row of rowsOf(db, collection)) {
      if (row && typeof row === 'object' && owner(row) === accountId) total += 1;
    }
  }
  return total;
}

/** `usage`: KI-Tokens und Credits der Stimmen, `{ last30, total }`. */
function summaryOf(row, db, access, monthEntries, usage) {
  const accessRows = access.get(row.id) ?? [];
  return {
    id: row.id,
    email: row.email ?? null,
    username: row.username ?? null,
    firstName: row.firstName ?? '',
    language: row.language ?? null,
    createdAt: row.createdAt ?? null,
    lastSeenAt: extremeOf(accessRows, 'lastSeenAt', true),
    disabled: row.disabled === true,
    blockedApps: blockedAppsOf(row),
    paidApps: appListOf(row.paidApps),
    apps: appsOf(accessRows),
    items: ownedItems(db, row.id),
    costChfMonth: sumCost(monthEntries.filter((entry) => entry.accountId === row.id)),
    usage,
  };
}

/** Ein Konto so, wie der Admin es zeigt — nie Salt oder Hash. */
async function accountView(dataDir, row, now = Date.now()) {
  const db = await load();
  const aiEntries = await readUsage(dataDir, { accountId: row.id });
  const speechEntries = await readSpeechUsage(dataDir, { accountId: row.id });
  const usage = usageOf(aiEntries, speechEntries, from30Of(now));
  // Abo und Kontingent laufen im Kalendermonat in Zuerich, wie im Dienst.
  const month = zurichMonthOf(now);
  const { sums } = await readMonthSums(dataDir, month, { accountId: row.id });
  return {
    ...summaryOf(row, db, accessByAccount(db), since(aiEntries, startOfUtcMonth(now)), usage),
    billing: billingOf(row, sums, month),
    themeMode: row.themeMode ?? null,
    accentKey: row.accentKey ?? null,
    themePreset: row.themePreset ?? null,
    assistantName: row.assistantName ?? null,
    onboarded: row.onboarded === true,
    householdId: row.householdId ?? null,
  };
}

async function listAccounts(dataDir, now = Date.now()) {
  const db = await load();
  const access = accessByAccount(db);
  const aiEntries = await readUsage(dataDir);
  const aiByAccount = entriesByAccount(aiEntries);
  const speechByAccount = entriesByAccount(await readSpeechUsage(dataDir));
  const monthEntries = since(aiEntries, startOfUtcMonth(now));
  const from30 = from30Of(now);
  const accounts = rowsOf(db, 'accounts')
    .filter((row) => row && typeof row.id === 'string')
    .map((row) =>
      summaryOf(
        row,
        db,
        access,
        monthEntries,
        usageOf(aiByAccount.get(row.id) ?? [], speechByAccount.get(row.id) ?? [], from30),
      ),
    )
    .sort((a, b) => (timeOf(b.createdAt) ?? 0) - (timeOf(a.createdAt) ?? 0));
  return { accounts };
}

// ------------------------------------------------------------------ Aktivitaet

const byNewest = (a, b) => (timeOf(b.at) ?? 0) - (timeOf(a.at) ?? 0);

/** Eine KI-Anfrage als Ereignis — ohne Text, nur was sie kostete und ob sie ging. */
const aiReplyOf = (entry) => ({
  at: entry.at,
  accountId: entry.accountId ?? null,
  kind: 'ai.reply',
  detail: {
    app: entry.app ?? null,
    tier: entry.tier ?? null,
    model: entry.model ?? null,
    costChf: Number.isFinite(entry.costChf) ? entry.costChf : null,
    ok: entry.ok === true,
    error: entry.error ?? null,
  },
});

/** `activity.jsonl` und die KI-Anfragen zusammen, neueste zuerst. */
async function activityEntries(dataDir, { accountId, kind, before, limit }) {
  const db = await load();
  const emails = new Map(rowsOf(db, 'accounts').map((row) => [row.id, row.email ?? null]));
  const logged = await readActivity(dataDir, { accountId, kind, before, limit });
  const wantsAi = kind === undefined || kindMatches('ai.reply', kind);
  const usage = wantsAi ? await readUsage(dataDir, { to: before, accountId }) : [];
  const merged = [...logged, ...usage.reverse().map(aiReplyOf)].sort(byNewest).slice(0, limit);
  return merged.map((entry) => ({
    at: entry.at,
    accountId: entry.accountId ?? null,
    email: emails.get(entry.accountId) ?? null,
    kind: entry.kind,
    detail: entry.detail ?? {},
  }));
}

// ------------------------------------------------------------------ Uebersicht

/** Die Marge eines Monats in Zuerich — je App und gesamt, mit Fixkosten. */
async function marginFor(dataDir, accounts, month) {
  const { sums, unassignedChf } = await readMonthSums(dataDir, month);
  return marginOf({ month, accounts, sums, unassignedChf, minimumChf: monthlyMinimumChf() });
}

async function sizeOf(file) {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}

async function directorySize(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return 0;
  }
  const sizes = await Promise.all(
    entries.filter((entry) => entry.isFile()).map((entry) => sizeOf(path.join(directory, entry.name))),
  );
  return sizes.reduce((total, size) => total + size, 0);
}

async function aiOverview(dataDir, aiStatus, now) {
  const from30 = from30Of(now);
  const monthFrom = startOfUtcMonth(now);
  const entries = await readUsage(dataDir, { from: iso(Math.min(from30, monthFrom)) });
  const last30 = since(entries, from30);
  const cheap = last30.filter((entry) => entry.tier === CHEAP_TIER).length;
  return {
    configured: await isConfigured(aiStatus),
    requests30: last30.length,
    costChf30: sumCost(last30),
    costChfMonth: sumCost(since(entries, monthFrom)),
    cheapShare30: last30.length === 0 ? 0 : cheap / last30.length,
    byDay: dailyTotals(last30, from30, MONTH_DAYS),
    monthlyMinimumChf: monthlyMinimumChf(),
  };
}

/** Stimmen: Saetze und Credits der letzten 30 Tage und des Monats, dazu der Zwischenspeicher. */
async function speechOverview(dataDir, speechStatus, now) {
  const from30 = from30Of(now);
  const monthFrom = startOfUtcMonth(now);
  const entries = await readSpeechUsage(dataDir, { from: iso(Math.min(from30, monthFrom)) });
  const last30 = summarizeSpeech(since(entries, from30)).total;
  const month = summarizeSpeech(since(entries, monthFrom)).total;
  return {
    configured: await isConfigured(speechStatus),
    requests30: last30.requests,
    cached30: last30.cached,
    credits30: last30.credits,
    savedCredits30: last30.savedCredits,
    creditsMonth: month.credits,
    charactersMonth: month.characters,
    sampleCreditsMonth: month.sampleCredits,
    monthlyCredits: monthlySpeechCredits(),
    cache: await readCacheStats(dataDir, cacheOptions()),
  };
}

async function overview(dataDir, { aiStatus, speechStatus, now = Date.now() } = {}) {
  const db = await load();
  const accounts = rowsOf(db, 'accounts').filter((row) => row && typeof row.id === 'string');
  const known = new Set(accounts.map((row) => row.id));
  const access = accessByAccount(db);
  const lastSeen = accounts.map((row) => extremeOf(access.get(row.id) ?? [], 'lastSeenAt', true));
  const accessRows = rowsOf(db, 'appAccess').filter((row) => row && known.has(row.accountId));

  return {
    generatedAt: iso(now),
    accounts: {
      total: accounts.length,
      active7: lastSeen.filter((value) => withinDays(value, WEEK_DAYS, now)).length,
      active30: lastSeen.filter((value) => withinDays(value, MONTH_DAYS, now)).length,
      newThisWeek: accounts.filter((row) => withinDays(row.createdAt, WEEK_DAYS, now)).length,
      disabled: accounts.filter((row) => row.disabled === true).length,
    },
    apps: APPS.map((app) => {
      const rows = accessRows.filter((row) => row.appId === app.id);
      const active = rows.filter((row) => withinDays(row.lastSeenAt, WEEK_DAYS, now));
      return {
        id: app.id,
        name: app.name,
        users: new Set(rows.map((row) => row.accountId)).size,
        active7: new Set(active.map((row) => row.accountId)).size,
        blockedCount: accounts.filter((row) => blockedAppsOf(row).includes(app.id)).length,
      };
    }),
    modules: MODULE_LIST.map((module) => ({
      app: module.app,
      id: module.id,
      name: module.name,
      collection: module.collection,
      items: module.collection ? countItems(module, rowsOf(db, module.collection)) : 0,
    })),
    ai: await aiOverview(dataDir, aiStatus, now),
    speech: await speechOverview(dataDir, speechStatus, now),
    margin: await marginFor(dataDir, accounts, zurichMonthOf(now)),
    storage: {
      dbBytes: await sizeOf(path.join(dataDir, 'db.json')),
      uploadsBytes: await directorySize(path.join(dataDir, 'uploads')),
    },
  };
}

// ------------------------------------------------------------------ Ein Konto

function aiOfAccount(usage) {
  const summary = summarizeUsage(usage);
  const extraApps = Object.keys(summary.byApp).filter((key) => !APP_IDS.includes(key));
  return {
    totals: {
      requests: summary.total.requests,
      costChf: summary.total.costChf,
      promptTokens: summary.total.promptTokens,
      completionTokens: summary.total.completionTokens,
    },
    byApp: [...APP_IDS, ...extraApps].map((app) => ({
      app: keyOrNull(app),
      requests: summary.byApp[app]?.requests ?? 0,
      costChf: summary.byApp[app]?.costChf ?? 0,
    })),
    recent: [...usage]
      .reverse()
      .sort(byNewest)
      .slice(0, RECENT_AI_LIMIT)
      .map((entry) => ({
        at: entry.at,
        app: entry.app ?? null,
        tier: entry.tier ?? null,
        model: entry.model ?? null,
        intent: entry.intent ?? null,
        voice: entry.voice === true,
        ok: entry.ok === true,
        error: entry.error ?? null,
        promptTokens: Number.isInteger(entry.promptTokens) ? entry.promptTokens : null,
        completionTokens: Number.isInteger(entry.completionTokens) ? entry.completionTokens : null,
        costChf: Number.isFinite(entry.costChf) ? entry.costChf : null,
        durationMs: Number.isFinite(entry.durationMs) ? entry.durationMs : null,
      })),
  };
}

/** Ein Konto mit Zahlen je Funktion, Aktivitaet und KI — oder null. */
async function accountDetail(dataDir, id, now = Date.now()) {
  const db = await load();
  const row = rowsOf(db, 'accounts').find((entry) => entry?.id === id);
  if (!row) return null;
  return {
    account: await accountView(dataDir, row, now),
    counts: MODULE_LIST.map((module) => ({
      app: module.app,
      module: module.id,
      name: module.name,
      collection: module.collection,
      items: module.collection ? countItems(module, rowsOf(db, module.collection), id) : 0,
    })),
    activity: await activityEntries(dataDir, { accountId: id, limit: ACCOUNT_ACTIVITY_LIMIT }),
    ai: aiOfAccount(await readUsage(dataDir, { accountId: id })),
  };
}

// ------------------------------------------------------------------ Kosten

/** Stimmen im Monat: Summen, je App und je Konto, das Kontingent und der Zwischenspeicher. */
async function speechCosts(dataDir, accounts, from, to) {
  const summary = summarizeSpeech(await readSpeechUsage(dataDir, { from: iso(from), to: iso(to) }));
  const extraApps = Object.keys(summary.byApp).filter((key) => !APP_IDS.includes(key));
  const empty = summarizeSpeech([]).total;
  return {
    ...summary.total,
    monthlyCredits: monthlySpeechCredits(),
    byApp: [...APP_IDS, ...extraApps].map((app) => ({
      app: keyOrNull(app),
      ...(summary.byApp[app] ?? empty),
    })),
    byAccount: Object.entries(summary.byAccount)
      .map(([key, bucket]) => {
        const accountId = keyOrNull(key);
        const row = accountId === null ? undefined : accounts.get(accountId);
        return { accountId, email: row?.email ?? null, username: row?.username ?? null, ...bucket };
      })
      .sort((a, b) => b.credits - a.credits || b.requests - a.requests),
    cache: await readCacheStats(dataDir, cacheOptions()),
  };
}

async function costs(dataDir, { month, aiStatus }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const from = Date.UTC(year, monthNumber - 1, 1);
  const to = Date.UTC(year, monthNumber, 1);
  const entries = await readUsage(dataDir, { from: iso(from), to: iso(to) });
  const summary = summarizeUsage(entries);
  const totalChf = summary.total.costChf;
  const minimum = monthlyMinimumChf();
  const configured = await isConfigured(aiStatus);

  const db = await load();
  const accounts = new Map(rowsOf(db, 'accounts').map((row) => [row.id, row]));
  const extraApps = Object.keys(summary.byApp).filter((key) => !APP_IDS.includes(key));
  const empty = { requests: 0, promptTokens: 0, completionTokens: 0, costChf: 0 };

  return {
    month,
    totalChf,
    monthlyMinimumChf: minimum,
    billableChf: totalChf > 0 || configured ? Math.max(totalChf, minimum) : 0,
    byApp: [...APP_IDS, ...extraApps].map((app) => {
      const bucket = summary.byApp[app] ?? empty;
      return {
        app: keyOrNull(app),
        requests: bucket.requests,
        promptTokens: bucket.promptTokens,
        completionTokens: bucket.completionTokens,
        costChf: bucket.costChf,
      };
    }),
    byAccount: Object.entries(summary.byAccount)
      .map(([key, bucket]) => {
        const accountId = keyOrNull(key);
        const row = accountId === null ? undefined : accounts.get(accountId);
        return {
          accountId,
          email: row?.email ?? null,
          username: row?.username ?? null,
          requests: bucket.requests,
          costChf: bucket.costChf,
        };
      })
      .sort((a, b) => b.costChf - a.costChf || b.requests - a.requests),
    byTier: Object.entries(summary.byTier)
      .map(([key, bucket]) => ({ tier: keyOrNull(key), requests: bucket.requests, costChf: bucket.costChf }))
      .sort((a, b) => b.requests - a.requests),
    byDay: dailyTotals(entries, from, Math.round((to - from) / DAY_MS)),
    prices: Object.entries(PRICES).map(([model, price]) => ({
      model,
      inputChf: price.input,
      outputChf: price.output,
    })),
    speech: await speechCosts(dataDir, accounts, from, to),
    margin: await marginFor(dataDir, [...accounts.values()].filter((row) => row && typeof row.id === 'string'), month),
  };
}

module.exports = {
  accountDetail,
  accountView,
  activityEntries,
  costs,
  listAccounts,
  monthlyMinimumChf,
  monthlySpeechCredits,
  overview,
};
