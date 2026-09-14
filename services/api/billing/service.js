/**
 * Abo und Kontingent im Dienst: wer zahlt, wie viel noch geht, wann es wieder
 * voll ist. KI (`ai/service.js`) und Stimmen (`speech/service.js`) teilen sich
 * ein Kassenbuch (`ledger.js`), damit beide gegen dasselbe Budget zaehlen.
 *
 * `accountId` ist eine Angabe, keine Anmeldung (siehe README) — geprueft wird
 * nur die Form und dass es das Konto gibt.
 */
const { load, rowsOf } = require('../store.js');
const { createLedger } = require('./ledger.js');
const { resetsOnOf } = require('./month.js');
const { speechSettings } = require('./costs.js');
const { budgetOf, isAppId, planOf, planSettings, priceOf } = require('./plans.js');

const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,100}$/;

const isAccountId = (value) => typeof value === 'string' && ACCOUNT_ID.test(value);
const round6 = (value) => Math.round(value * 1e6) / 1e6;
const reply = (status, body) => ({ status, body });

async function accountInStore(accountId) {
  if (!isAccountId(accountId)) return null;
  return rowsOf(await load(), 'accounts').find((row) => row?.id === accountId) ?? null;
}

/**
 * `createBilling({ dataDir, findAccount?, env?, now?, ledger? })` — alles
 * ausser `dataDir` nur fuer Tests.
 */
function createBilling({ dataDir, findAccount = accountInStore, env = process.env, now = Date.now, ledger } = {}) {
  const book = ledger ?? createLedger({ dataDir, now, speech: speechSettings(env) });

  /**
   * Der Stand eines Kontos in einer App — synchron, also erst nach
   * `await book.ready()` rufen. `account` darf null sein (dann Gratis).
   */
  function standingOf(account, app) {
    const settings = planSettings(env);
    const plan = planOf(account, app, settings);
    const budgetChf = budgetOf(plan, app, settings);
    const accountId = typeof account?.id === 'string' ? account.id : null;
    const usage = accountId ? book.usageOf(accountId, app) : { aiChf: 0, speechChf: 0, heldChf: 0 };
    const spentChf = usage.aiChf + usage.speechChf + usage.heldChf;
    const remainingChf = budgetChf - spentChf;
    return {
      plan,
      priceChf: priceOf(app, settings),
      budgetChf,
      ...usage,
      spentChf,
      remainingChf,
      remainingShare: budgetChf > 0 ? Math.min(1, Math.max(0, remainingChf / budgetChf)) : 0,
      resetsOn: resetsOnOf(book.currentMonth()),
    };
  }

  /** Fuer eine Antwort, die das Kontingent ablehnt: `{ error, plan, resetsOn, priceChf }`. */
  const refusalOf = (error, standing) => ({
    error,
    plan: standing.plan,
    resetsOn: standing.resetsOn,
    priceChf: standing.priceChf,
  });

  /** `GET /v1/ai/budget?accountId=&app=` */
  async function budget({ accountId, app }) {
    if (!isAccountId(accountId) || !isAppId(app)) return reply(400, { error: 'bad_request' });
    const account = await findAccount(accountId);
    if (!account) return reply(404, { error: 'account_not_found' });
    await book.ready();
    const standing = standingOf(account, app);
    return reply(200, {
      plan: standing.plan,
      budgetChf: round6(standing.budgetChf),
      spentChf: round6(standing.spentChf),
      remainingShare: round6(standing.remainingShare),
      resetsOn: standing.resetsOn,
      priceChf: standing.priceChf,
    });
  }

  return { ledger: book, findAccount, standingOf, refusalOf, budget, speech: () => speechSettings(env) };
}

module.exports = { accountInStore, createBilling, isAccountId };
