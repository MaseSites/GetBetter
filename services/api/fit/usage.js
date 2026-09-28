/**
 * Kosten und Grenzen der KI in Better Fit (Masterplan §22, §25).
 *
 * - Tageslimit je Person (`MAX_MEAL_ANALYSES_PER_USER_PER_DAY`): gezaehlt wird
 *   jeder bezahlte Aufruf (auch das zweite Bild) nach dem Tag, an dem er
 *   lief — in Zuerich, nicht nach dem Tag der Mahlzeit
 * - Monatsbudget ueber alle (`MONTHLY_AI_BUDGET_CHF`): ab 80 % eine Warnung,
 *   ab 100 % keine bezahlte Analyse mehr — dann bleibt die Eingabe von Hand
 * - Kill-Switch (`FIT_AI_DISABLED=1`)
 *
 * - Kontingent je Konto (`billing`): jede bezahlte Analyse zaehlt gegen das
 *   Budget des Kontos in BetterGym — dasselbe, aus dem der Coach und die
 *   Stimmen schoepfen. Ohne Abo ist es klein (Gratis), mit Abo gross. So kostet
 *   ein Konto nie mehr, als es einbringt, und Gratis-Konten koennen das
 *   Monatsbudget aller nicht leeren.
 * - Live ohne Schluessel ist ein Fehler (`not_configured`), nie still der
 *   Mock: sonst saehe eine echte Person erfundene Beispielwerte.
 *
 * Reserviert wird VOR dem Aufruf, in derselben Transaktion, die zaehlt
 * (`reserve`): eine Zeile in `usageLedger` mit einem geschaetzten Betrag
 * (`pending`), die `settle` nach dem Aufruf auf die echten Zahlen setzt. So
 * ueberziehen parallele Starts weder das Tageslimit noch das Budget.
 */

const { zurichMonthOf } = require('../billing/month.js');

const monthOf = (iso) => iso.slice(0, 7);
const ZURICH = 'Europe/Zurich';
/** Die App, gegen deren Abo Better Fit zaehlt. */
const FIT_APP = 'bettergym';

/** HTTP-Status zu einer Ablehnung von `reserve`. */
function statusOfRefusal(error) {
  if (error === 'daily_limit') return 429;
  if (error === 'plan_budget_free' || error === 'plan_budget_paid') return 402;
  return 503;
}

/** `YYYY-MM-DD` eines Zeitpunkts in einer Zeitzone. */
function dayIn(iso, timezone = ZURICH) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Wann an einer Analyse bezahlt aufgerufen wurde — aeltere Zeilen: nur beim Anlegen. */
const callsOf = (row) => (Array.isArray(row.calls) ? row.calls : row.createdAt ? [row.createdAt] : []);

/** Wie viele bezahlte Aufrufe ein Konto an einem Tag (Zuerich) schon hatte. */
function callsOn(own, today, timezone = ZURICH) {
  return own.list('mealAnalyses').reduce((total, row) => total + callsOf(row).filter((at) => dayIn(at, timezone) === today).length, 0);
}

function stateOf(spent, limit) {
  const share = limit > 0 ? spent / limit : 1;
  return {
    spentChf: Math.round(spent * 10000) / 10000,
    limitChf: limit,
    share: Math.round(share * 1000) / 1000,
    state: share >= 1 ? 'exhausted' : share >= 0.8 ? 'warn' : 'ok',
  };
}

function createUsage({ store, config, now = () => new Date(), billing = null }) {
  const inMonth = (month) => (row) => typeof row.at === 'string' && monthOf(row.at) === month;
  const inZurichMonth = (month) => (row) => typeof row.at === 'string' && zurichMonthOf(row.at) === month;

  /** Was ein Konto diesen Monat (Zuerich) in Better Fit fuer KI ausgegeben hat — synchron. */
  function accountSpendChf(accountId, month = zurichMonthOf(now().getTime())) {
    return store.ownerSum(accountId, 'usageLedger', 'costChf', inZurichMonth(month));
  }

  /**
   * Das Kontingent des Kontos vor der Transaktion: `{ baseChf, refusal }` —
   * `baseChf` ist, was dem Konto ohne Better Fit bliebe (Budget minus KI und
   * Stimme); in der Transaktion kommt der eigene Verbrauch dazu. Ohne
   * `billing` (Tests, Werkzeuge) `null`: dann gilt nur Tageslimit und Budget.
   */
  async function allowanceOf(accountId) {
    if (!billing) return null;
    await billing.ledger.ready();
    const account = await billing.findAccount(accountId);
    const standing = billing.standingOf(account, FIT_APP);
    // `standingOf` zaehlt Better Fit schon mit (Quelle aus `service.js`) — hier wieder weg,
    // weil die Transaktion den eigenen Stand samt offener Reservierungen genauer kennt.
    return {
      baseChf: standing.remainingChf + accountSpendChf(accountId),
      plan: standing.plan,
      resetsOn: standing.resetsOn,
      priceChf: standing.priceChf,
    };
  }

  async function monthCostChf(month = monthOf(now().toISOString())) {
    return store.sumAll('usageLedger', 'costChf', inMonth(month));
  }

  /** Wie es um das Budget steht: `ok`, `warn` (ab 80 %) oder `exhausted`. */
  async function budget() {
    return stateOf(await monthCostChf(), config.monthlyBudgetChf);
  }

  /** Die Pruefung ohne Reservierung — `own`: die Sicht des Kontos, `spent`: bisher im Monat. */
  function decide(own, today, spent, allowance = null) {
    if (callsOn(own, today) >= config.maxAnalysesPerDay) return { ok: false, error: 'daily_limit', limit: config.maxAnalysesPerDay };
    if (config.mode === 'mock') return { ok: true, provider: 'mock' };
    if (!config.geminiKey) return { ok: false, error: 'not_configured' };
    if (config.aiDisabled) return { ok: false, error: 'ai_disabled' };
    const state = stateOf(spent, config.monthlyBudgetChf);
    // Keine automatische Hochstufung, keine stille Ueberschreitung: dann eben von Hand.
    if (state.state === 'exhausted') return { ok: false, error: 'budget_exhausted' };
    if (allowance) {
      const month = zurichMonthOf(now().getTime());
      const mine = own.list('usageLedger', inZurichMonth(month)).reduce((total, row) => total + (Number(row.costChf) || 0), 0);
      if (allowance.baseChf - mine < config.reserveChf) {
        return {
          ok: false,
          error: allowance.plan === 'paid' ? 'plan_budget_paid' : 'plan_budget_free',
          plan: allowance.plan,
          resetsOn: allowance.resetsOn,
          priceChf: allowance.priceChf,
        };
      }
    }
    return { ok: true, provider: 'gemini', budget: state };
  }

  /**
   * Darf jetzt eine Analyse laufen? `{ ok, provider }` mit `mock` oder `gemini`,
   * sonst `{ ok: false, error }`. Nur lesen — wer wirklich aufruft, nimmt `reserve`.
   * Das Tageslimit gilt auch im Mock-Modus, damit es sich testen laesst.
   */
  async function admit(own, today) {
    return decide(own, today, await monthCostChf());
  }

  /**
   * Innerhalb von `store.transact`: pruefen UND reservieren. Legt eine Zeile
   * in `usageLedger` mit dem geschaetzten Betrag an (`pending: true`) und gibt
   * `{ ok, provider, budget, ledgerId, at }` zurueck. Den Aufruf zaehlt der
   * Aufrufer an seiner Analyse (`calls: [..., at]`), in derselben Transaktion.
   */
  function reserve(tx, accountId, { today, kind, allowance = null }) {
    const own = tx.forOwner(accountId);
    const at = now().toISOString();
    const spent = tx.sumAll('usageLedger', 'costChf', inMonth(monthOf(at)));
    const admission = decide(own, today, spent, allowance);
    if (!admission.ok) return admission;
    const estimate = admission.provider === 'gemini' ? config.reserveChf : 0;
    const ledger = own.insert('usageLedger', { at, kind, model: null, inputTokens: 0, outputTokens: 0, costChf: estimate, durationMs: 0, ok: true, pending: true });
    return { ...admission, ledgerId: ledger.id, at };
  }

  /** Nach dem Aufruf: die Reservierung durch die echten Zahlen ersetzen. */
  function settle(own, ledgerId, entry = {}) {
    own.update('usageLedger', ledgerId, {
      model: entry.model ?? null,
      inputTokens: entry.inputTokens ?? 0,
      outputTokens: entry.outputTokens ?? 0,
      costChf: entry.costChf ?? 0,
      durationMs: entry.durationMs ?? 0,
      ok: entry.ok !== false,
      pending: false,
    });
  }

  function record(own, entry) {
    own.insert('usageLedger', {
      at: now().toISOString(),
      kind: entry.kind,
      model: entry.model ?? null,
      inputTokens: entry.inputTokens ?? 0,
      outputTokens: entry.outputTokens ?? 0,
      costChf: entry.costChf ?? 0,
      durationMs: entry.durationMs ?? 0,
      ok: entry.ok !== false,
    });
  }

  return { accountSpendChf, admit, allowanceOf, budget, monthCostChf, record, reserve, settle };
}

module.exports = { FIT_APP, createUsage, dayIn, callsOn, callsOf, statusOfRefusal };
