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
 * Reserviert wird VOR dem Aufruf, in derselben Transaktion, die zaehlt
 * (`reserve`): eine Zeile in `usageLedger` mit einem geschaetzten Betrag
 * (`pending`), die `settle` nach dem Aufruf auf die echten Zahlen setzt. So
 * ueberziehen parallele Starts weder das Tageslimit noch das Budget.
 */

const monthOf = (iso) => iso.slice(0, 7);
const ZURICH = 'Europe/Zurich';

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

function createUsage({ store, config, now = () => new Date() }) {
  const inMonth = (month) => (row) => typeof row.at === 'string' && monthOf(row.at) === month;

  async function monthCostChf(month = monthOf(now().toISOString())) {
    return store.sumAll('usageLedger', 'costChf', inMonth(month));
  }

  /** Wie es um das Budget steht: `ok`, `warn` (ab 80 %) oder `exhausted`. */
  async function budget() {
    return stateOf(await monthCostChf(), config.monthlyBudgetChf);
  }

  /** Die Pruefung ohne Reservierung — `own`: die Sicht des Kontos, `spent`: bisher im Monat. */
  function decide(own, today, spent) {
    if (callsOn(own, today) >= config.maxAnalysesPerDay) return { ok: false, error: 'daily_limit', limit: config.maxAnalysesPerDay };
    if (config.mode === 'mock' || !config.geminiKey) return { ok: true, provider: 'mock' };
    if (config.aiDisabled) return { ok: false, error: 'ai_disabled' };
    const state = stateOf(spent, config.monthlyBudgetChf);
    // Keine automatische Hochstufung, keine stille Ueberschreitung: dann eben von Hand.
    if (state.state === 'exhausted') return { ok: false, error: 'budget_exhausted' };
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
  function reserve(tx, accountId, { today, kind }) {
    const own = tx.forOwner(accountId);
    const at = now().toISOString();
    const spent = tx.sumAll('usageLedger', 'costChf', inMonth(monthOf(at)));
    const admission = decide(own, today, spent);
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

  return { admit, budget, monthCostChf, record, reserve, settle };
}

module.exports = { createUsage, dayIn, callsOn, callsOf };
