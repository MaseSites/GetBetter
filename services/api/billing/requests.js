/**
 * Abo-Anfragen: bis es den Kauf im Store gibt, fragt die App das Abo an, und
 * der Admin schaltet frei oder lehnt ab. Die Sammlung `planRequests` gehoert
 * dem Dienst — die Apps lesen sie, schreiben aber nur ueber die Routen.
 *
 * Zeile: `{ id, accountId, app, status: 'pending'|'approved'|'declined',
 * createdAt, decidedAt }`. Die reinen Teile (`pendingRequests`,
 * `settleRequests`, `decideRows`) sind getestet, der Rest ueber die Routen.
 */
const { recordActivity } = require('../activity.js');
const { APPS } = require('../admin/catalog.js');
const { buildNotification } = require('../notifications.js');
const { load, newId, rowsOf, save } = require('../store.js');
const {
  TERMS,
  cancelDayOf,
  canPersonalize,
  cancelsOn,
  isAppId,
  planOf,
  planSettings,
  priceOf,
  pricedApps,
  termOf,
  yearPriceOf,
} = require('./plans.js');
const { isAccountId } = require('./service.js');

const COLLECTION = 'planRequests';
const DECISIONS = { approve: 'approved', decline: 'declined' };
const REQUEST_FIELDS = ['accountId', 'app'];
/** Beim Anfragen darf die Laufzeit dazu: monatlich oder jaehrlich. */
const ASK_FIELDS = [...REQUEST_FIELDS, 'term'];
const termIn = (value) => (TERMS.includes(value) ? value : 'month');

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** Die Sammlung, wie sie ist — geschrieben wird immer auf diese, damit nichts verloren geht. */
const tableOf = (tables, name) => (Array.isArray(tables?.[name]) ? tables[name] : []);
/** Nur die lesbaren Zeilen — zum Suchen, nie zum Zurueckschreiben. */
const rowsIn = (tables, name) => tableOf(tables, name).filter(isPlainObject);
const appListOf = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
const appNameOf = (app) => APPS.find((entry) => entry.id === app)?.name ?? String(app);
const reply = (status, body) => ({ status, body });
const byCreated = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));

/** Was eine App ueber ihre Anfrage erfaehrt. */
const publicOf = (row) => ({
  id: row.id,
  app: row.app,
  term: termIn(row.term),
  status: row.status,
  createdAt: row.createdAt,
  decidedAt: row.decidedAt ?? null,
});

/**
 * Die Kuendigungen eines Kontos mit einer geaenderten App: `day` setzt sie,
 * `null` nimmt sie zurueck. Rein, damit die Zeile unveraendert bleibt.
 */
function withCancel(stored, app, day) {
  const base = isPlainObject(stored) ? stored : {};
  const kept = Object.entries(base).filter(([id, value]) => id !== app && typeof value === 'string');
  return Object.fromEntries(day === null ? kept : [...kept, [app, day]]);
}

/** Die offene Anfrage eines Kontos fuer eine App, oder undefined. */
function pendingOf(tables, accountId, app) {
  return rowsIn(tables, COLLECTION).find(
    (row) => row.status === 'pending' && row.accountId === accountId && row.app === app,
  );
}

/**
 * Offene Anfragen fuer den Admin, die aelteste zuerst — mit Adresse und Namen.
 * Mit `accountId` nur die dieses Kontos. Anfragen ohne Konto fallen weg.
 */
function pendingRequests(tables, accountId) {
  const accounts = new Map(rowsIn(tables, 'accounts').map((row) => [row.id, row]));
  return rowsIn(tables, COLLECTION)
    .filter((row) => row.status === 'pending' && accounts.has(row.accountId))
    .filter((row) => accountId === undefined || row.accountId === accountId)
    .sort(byCreated)
    .map((row) => {
      const account = accounts.get(row.accountId);
      return {
        id: row.id,
        accountId: row.accountId,
        email: account.email ?? null,
        username: account.username ?? null,
        firstName: account.firstName ?? '',
        app: row.app,
        createdAt: row.createdAt,
      };
    });
}

/** Die Mitteilung zur Entscheidung. `title` ist der Name der App — den Satz baut die App. */
function noticeOf(request, approved, at) {
  return buildNotification(
    {
      accountId: request.accountId,
      kind: approved ? 'planApproved' : 'planDeclined',
      title: appNameOf(request.app),
      body: '',
      ref: { app: request.app, requestId: request.id },
      app: request.app,
    },
    new Date(at),
  );
}

/**
 * Eine Anfrage entscheiden, rein: `{ accounts, planRequests, notifications, request }`.
 * Freischalten traegt die App in `paidApps` ein (einmal).
 */
function decideRows(tables, request, decision, at) {
  const approved = decision === 'approve';
  const next = { ...request, status: DECISIONS[decision], decidedAt: at };
  const accounts = tableOf(tables, 'accounts').map((row) => {
    if (!approved || row?.id !== request.accountId) return row;
    const paid = appListOf(row.paidApps);
    // Wieder freigeschaltet heisst auch: eine Kuendigung von vorher gilt nicht mehr.
    const planCancels = withCancel(row.planCancels, request.app, null);
    const planTerms = { ...(isPlainObject(row.planTerms) ? row.planTerms : {}), [request.app]: termIn(request.term) };
    return {
      ...row,
      paidApps: paid.includes(request.app) ? paid : [...paid, request.app],
      planCancels,
      planTerms,
    };
  });
  return {
    accounts,
    planRequests: tableOf(tables, COLLECTION).map((row) => (row?.id === request.id ? next : row)),
    notifications: [...tableOf(tables, 'notifications'), noticeOf(request, approved, at)],
    request: next,
  };
}

/**
 * Hat der Admin das Abo direkt eingeschaltet, sind offene Anfragen fuer diese
 * Apps erledigt: `{ planRequests, notifications, settled }`, rein.
 */
function settleRequests(tables, accountId, apps, at) {
  const settled = rowsIn(tables, COLLECTION).filter(
    (row) => row.status === 'pending' && row.accountId === accountId && apps.includes(row.app),
  );
  if (settled.length === 0) {
    return { planRequests: tableOf(tables, COLLECTION), notifications: tableOf(tables, 'notifications'), settled };
  }
  const ids = new Set(settled.map((row) => row.id));
  return {
    planRequests: tableOf(tables, COLLECTION).map((row) =>
      isPlainObject(row) && ids.has(row.id) ? { ...row, status: 'approved', decidedAt: at } : row,
    ),
    notifications: [...tableOf(tables, 'notifications'), ...settled.map((row) => noticeOf(row, true, at))],
    settled,
  };
}

/** `createPlanRequests({ dataDir, env?, now? })` — `env` und `now` nur fuer Tests. */
function createPlanRequests({ dataDir, env = process.env, now = () => new Date() } = {}) {
  async function track(entry) {
    try {
      await recordActivity(dataDir, entry);
    } catch (error) {
      process.stderr.write(`[plans] Aktivitaet: ${error?.name ?? 'Error'}\n`);
    }
  }

  /** Konto und App aus einer Anfrage — `{ account, app }` oder eine Antwort mit Fehler. */
  async function accountFor(accountId, app) {
    if (!isAccountId(accountId) || !isAppId(app)) return { refusal: reply(400, { error: 'bad_request' }) };
    const db = await load();
    const account = rowsOf(db, 'accounts').find((row) => row?.id === accountId);
    if (!account) return { refusal: reply(404, { error: 'account_not_found' }) };
    return { db, account };
  }

  /** `GET /v1/plans?accountId=&app=` */
  async function status({ accountId, app }) {
    const found = await accountFor(accountId, app);
    if (found.refusal) return found.refusal;
    const settings = planSettings(env);
    return reply(200, {
      app,
      priceChf: priceOf(app, settings),
      yearPriceChf: yearPriceOf(app, settings),
      term: termOf(found.account, app),
      plan: planOf(found.account, app, settings),
      canPersonalize: canPersonalize(found.account, settings),
      request: pendingOf(found.db.tables, accountId, app) ? 'pending' : null,
      cancelsOn: cancelsOn(found.account, app),
      pricedApps: pricedApps(settings),
    });
  }

  /** `POST /v1/plans/requests { accountId, app }` — eine offene Anfrage gilt, keine zweite. */
  async function request(body) {
    if (!isPlainObject(body) || Object.keys(body).some((key) => !ASK_FIELDS.includes(key))) {
      return reply(400, { error: 'bad_request' });
    }
    if (body.term !== undefined && !TERMS.includes(body.term)) return reply(400, { error: 'bad_request' });
    const found = await accountFor(body.accountId, body.app);
    if (found.refusal) return found.refusal;
    const { db, account } = found;
    const settings = planSettings(env);
    if (priceOf(body.app, settings) === null) return reply(400, { error: 'plan_unavailable' });
    if (planOf(account, body.app, settings) === 'paid') return reply(409, { error: 'already_paid' });

    const open = pendingOf(db.tables, account.id, body.app);
    if (open) return reply(200, { request: publicOf(open) });

    const row = {
      id: newId('plr'),
      accountId: account.id,
      app: body.app,
      term: termIn(body.term),
      status: 'pending',
      createdAt: now().toISOString(),
      decidedAt: null,
    };
    db.tables[COLLECTION] = [...rowsOf(db, COLLECTION), row];
    await save();
    await track({ accountId: account.id, kind: 'plan.requested', detail: { app: body.app, term: termIn(body.term) } });
    return reply(201, { request: publicOf(row) });
  }

  /**
   * `POST /v1/plans/cancel` und `.../resume`: gekuendigt wird auf Monatsende —
   * bis dahin laeuft alles weiter, danach gilt wieder Gratis. Zuruecknehmen geht,
   * solange der Stichtag nicht da ist.
   */
  async function setCancel(body, cancelling) {
    if (!isPlainObject(body) || Object.keys(body).some((key) => !REQUEST_FIELDS.includes(key))) {
      return reply(400, { error: 'bad_request' });
    }
    const found = await accountFor(body.accountId, body.app);
    if (found.refusal) return found.refusal;
    const { db, account } = found;
    const settings = planSettings(env);
    if (priceOf(body.app, settings) === null) return reply(400, { error: 'plan_unavailable' });
    const at = now();
    if (planOf(account, body.app, settings, at) !== 'paid') return reply(409, { error: 'not_paid' });

    const day = cancelling ? cancelDayOf(at) : null;
    const already = cancelsOn(account, body.app);
    if (cancelling && already !== null) return reply(200, { app: body.app, cancelsOn: already });

    const next = { ...account, planCancels: withCancel(account.planCancels, body.app, day) };
    db.tables.accounts = rowsOf(db, 'accounts').map((row) => (row?.id === account.id ? next : row));
    await save();
    await track({
      accountId: account.id,
      kind: cancelling ? 'plan.cancelled' : 'plan.resumed',
      detail: { app: body.app },
    });
    return reply(200, { app: body.app, cancelsOn: day });
  }

  /**
   * Im Admin: `approve` oder `decline`. Die Antwort traegt zusaetzlich `account`
   * (die gespeicherte Zeile), damit der Admin sein Konto neu zeigen kann.
   */
  async function decide(id, decision) {
    if (!Object.hasOwn(DECISIONS, decision)) return reply(400, { error: 'bad_request' });
    const db = await load();
    const row = rowsOf(db, COLLECTION).find((entry) => entry?.id === id);
    if (!row) return reply(404, { error: 'not_found' });
    if (row.status !== 'pending') return reply(409, { error: 'already_decided' });
    if (!rowsOf(db, 'accounts').some((entry) => entry?.id === row.accountId)) {
      return reply(404, { error: 'not_found' });
    }
    if (decision === 'approve' && priceOf(row.app, planSettings(env)) === null) {
      return reply(409, { error: 'plan_unavailable' });
    }

    const next = decideRows(db.tables, row, decision, now().toISOString());
    db.tables.accounts = next.accounts;
    db.tables[COLLECTION] = next.planRequests;
    db.tables.notifications = next.notifications;
    await save();
    await track({
      accountId: row.accountId,
      kind: decision === 'approve' ? 'admin.planApproved' : 'admin.planDeclined',
      detail: { app: row.app },
    });
    const account = next.accounts.find((entry) => entry?.id === row.accountId);
    return { ...reply(200, { request: publicOf(next.request) }), account };
  }

  return { status, request, cancel: (body) => setCancel(body, true), resume: (body) => setCancel(body, false), decide, track };
}

module.exports = {
  COLLECTION,
  createPlanRequests,
  decideRows,
  pendingRequests,
  settleRequests,
  withCancel,
};
