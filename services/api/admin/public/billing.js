/*
 * Better Admin: Zugang, Abo und Kontingent je App, die Marge und „App ansehen“.
 *
 * Eigenes Modul, damit app.js nicht weiter waechst. Die Bausteine (h, card,
 * createSwitch …) kommen von app.js herein — so gibt es keinen Kreis zwischen
 * den Modulen. Wie ueberall: nur createElement, textContent und setAttribute,
 * kein innerHTML, kein style-Attribut.
 */

const VIEW_URL = /^http:\/\/localhost:808[1-5]\/\?view=[a-f0-9]{64}$/;

export function createBillingUi(ui) {
  const {
    h,
    svg,
    card,
    stats,
    uid,
    createSwitch,
    createTable,
    toast,
    errorContent,
    reportUnexpected,
    patchAccount,
    api,
    accountPath,
    displayName,
    appName,
    asArray,
    isNum,
    clamp,
    fmtChf,
    fmtPct,
    fmtInt,
    fmtDayLong,
    fmtRelative,
    APPS,
    isDemo,
    requestControls,
  } = ui;

  // -------------------------------------------------------------------------
  // Zugang · Abo · Verbrauch je App
  // -------------------------------------------------------------------------

  function planBadge(plan) {
    if (!plan) return null;
    return h('span', { class: plan === 'paid' ? 'plan plan--paid' : 'plan', text: plan === 'paid' ? 'Abo' : 'Gratis' });
  }

  /** Wie viel vom Monatskontingent weg ist — Balken, Prozent und Franken. */
  function usageMeter(usage) {
    const share = isNum(usage.usedShare) ? clamp(usage.usedShare, 0, 1) : 0;
    const over = share >= 1;
    const labelId = uid('budget');
    const amounts = `${fmtChf(usage.spentChf)} von ${fmtChf(usage.budgetChf)}`;
    return h(
      'div',
      { class: 'budget' },
      h(
        'div',
        { class: 'budget__head' },
        h('span', { id: labelId, class: 'budget__label', text: 'Diesen Monat' }),
        h('span', { class: over ? 'budget__value num num-negative' : 'budget__value num', text: fmtPct(share) }),
      ),
      h(
        'div',
        {
          role: 'meter',
          'aria-labelledby': labelId,
          'aria-valuemin': '0',
          'aria-valuemax': '100',
          'aria-valuenow': String(Math.round(share * 100)),
          'aria-valuetext': `${fmtPct(share)}: ${amounts}`,
        },
        svg(
          'svg',
          { class: 'meter meter--thin', viewBox: '0 0 100 8', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
          svg('rect', { class: 'meter__track', x: '0', y: '0', width: '100', height: '8' }),
          share > 0
            ? svg('rect', {
                class: over ? 'meter__bar meter__bar--over' : 'meter__bar',
                x: '0',
                y: '0',
                width: (share * 100).toFixed(2),
                height: '8',
              })
            : null,
        ),
      ),
      h('div', { class: 'budget__foot num', text: `${amounts} · voll am ${fmtDayLong(usage.resetsOn)}` }),
    );
  }

  const TOASTS = {
    blockedApps: (name, added) => `${name} ${added ? 'gesperrt' : 'freigeschaltet'}.`,
    paidApps: (name, added) => `Abo für ${name} ${added ? 'eingeschaltet' : 'ausgeschaltet'}.`,
  };

  /**
   * Eine Zeile je App: Zugang (erlaubt/gesperrt), Abo (an/aus) und der
   * Verbrauch diesen Monat. Beides schreibt der Admin; die App merkt es beim
   * naechsten Abgleich.
   */
  function accessCard(store) {
    let pending = false;
    const rows = APPS.map((app) => {
      const ids = { name: uid('app'), access: uid('access'), paid: uid('paid') };
      const meta = h('span', { class: 'access-row__meta' });
      const badge = h('span', { class: 'access-row__badge' });
      // Eine offene Abo-Anfrage steht direkt unter der App, mit Freischalten und Ablehnen.
      const request = h('div');
      const usage = h('div', { class: 'access-row__usage' });
      const accessSwitch = createSwitch({
        labelledBy: `${ids.access} ${ids.name}`,
        onText: 'erlaubt',
        offText: 'gesperrt',
        dangerWhen: 'off',
        onToggle: () => toggle('blockedApps', app.id),
      });
      const paidSwitch = createSwitch({
        labelledBy: `${ids.paid} ${ids.name}`,
        onText: 'an',
        offText: 'aus',
        dangerWhen: 'none',
        onToggle: () => toggle('paidApps', app.id),
      });
      const el = h(
        'li',
        { class: 'access-row' },
        h(
          'div',
          { class: 'access-row__app' },
          h('span', { class: 'access-row__name' }, h('span', { id: ids.name, class: 'access-row__title', text: app.name }), badge),
          meta,
          request,
        ),
        h(
          'div',
          { class: 'access-row__controls' },
          h('div', { class: 'access-row__control' }, h('span', { id: ids.access, class: 'access-row__label', text: 'Zugang' }), accessSwitch.el),
          h('div', { class: 'access-row__control' }, h('span', { id: ids.paid, class: 'access-row__label', text: 'Abo' }), paidSwitch.el),
        ),
        usage,
      );
      return { app, meta, badge, request, usage, accessSwitch, paidSwitch, el };
    });
    const list = h('ul', { class: 'access-list' }, rows.map((row) => row.el));

    function draw(account) {
      const blocked = new Set(asArray(account.blockedApps));
      const paid = new Set(asArray(account.paidApps));
      const billing = new Map(asArray(account.billing).map((entry) => [entry.app, entry]));
      for (const row of rows) {
        const seen = asArray(account.apps).find((entry) => entry.id === row.app.id);
        const usage = billing.get(row.app.id);
        const hasPrice = isNum(usage?.priceChf);
        row.meta.textContent = [
          seen ? `zuletzt ${fmtRelative(seen.lastSeenAt)}` : 'noch nie geöffnet',
          hasPrice ? `Abo ${fmtChf(usage.priceChf)} im Monat` : 'noch kein Abo-Preis',
        ].join(' · ');
        row.badge.replaceChildren(planBadge(usage?.plan) ?? '');
        row.request.replaceChildren(...[requestControls?.(store, row.app.id)].filter(Boolean));
        row.accessSwitch.update({ checked: !blocked.has(row.app.id), busy: pending });
        // Ohne Preis gibt es kein Abo einzuschalten — ausschalten geht immer.
        row.paidSwitch.update({ checked: paid.has(row.app.id), busy: pending || (!hasPrice && !paid.has(row.app.id)) });
        row.usage.replaceChildren(usage ? usageMeter(usage) : h('span', { class: 'muted', text: '—' }));
      }
      list.setAttribute('aria-busy', String(pending));
    }

    async function toggle(field, appId) {
      if (pending) return;
      const previous = asArray(store.get()[field]);
      const added = !previous.includes(appId);
      const next = added ? [...previous, appId] : previous.filter((id) => id !== appId);
      pending = true;
      store.set({ ...store.get(), [field]: next });
      try {
        await patchAccount(store, { [field]: next });
        toast(TOASTS[field](appName(appId), added));
      } catch (err) {
        reportUnexpected(err);
        store.set({ ...store.get(), [field]: previous });
        toast([`${appName(appId)}: zurückgenommen. `, ...errorContent(err)], 'error');
      } finally {
        pending = false;
        draw(store.get());
      }
    }

    draw(store.get());
    store.subscribe(draw);
    return card(
      {
        title: 'Apps: Zugang und Abo',
        note:
          'Gesperrt lässt das Konto nicht mehr in die App. Mit Abo gilt das Kontingent des Abos, ohne Abo ein kleines ' +
          'Gratis-Kontingent: nur die günstige KI, keine Stimmen von ElevenLabs. Ein Abo irgendeiner App schaltet das ' +
          'Aussehen in allen Apps frei; das Abo einschalten erledigt auch eine offene Anfrage. Die App merkt es beim ' +
          'nächsten Abgleich.',
      },
      list,
    );
  }

  /** In der Kontenliste: die Kürzel der Apps mit Abo. */
  function paidCell(account) {
    const paid = APPS.filter((app) => asArray(account.paidApps).includes(app.id));
    if (paid.length === 0) return h('span', { class: 'muted', text: '—' });
    return h('span', {
      class: 'paid-cell',
      title: `Abo: ${paid.map((app) => app.name).join(', ')}`,
      text: paid.map((app) => app.short).join(' · '),
    });
  }

  // -------------------------------------------------------------------------
  // Marge
  // -------------------------------------------------------------------------

  const signedChf = (value) => h('span', { class: isNum(value) && value < 0 ? 'num-negative' : null, text: fmtChf(value) });
  const signedPct = (value) =>
    isNum(value) ? h('span', { class: value < 0 ? 'num-negative' : null, text: fmtPct(value) }) : '—';
  const chfColumn = (key, label) => ({ key, label, type: 'num', sortValue: (r) => r[key], render: (r) => fmtChf(r[key]) });

  /** Marge je App und gesamt, gesamt auch mit Fixkosten. Negativ steht rot. */
  function marginCard(margin, { title = 'Marge diesen Monat' } = {}) {
    if (!margin || typeof margin !== 'object') return null;
    const totals = margin.totals ?? {};
    const table = createTable({
      caption: 'Marge pro App',
      columns: [
        { key: 'app', label: 'App', sortValue: (r) => appName(r.app), render: (r) => appName(r.app) },
        {
          key: 'priceChf',
          label: 'Preis',
          type: 'num',
          sortValue: (r) => r.priceChf,
          render: (r) => (isNum(r.priceChf) ? fmtChf(r.priceChf) : h('span', { class: 'muted', text: 'noch keiner' })),
        },
        { key: 'paidAccounts', label: 'Abos', type: 'num', sortValue: (r) => r.paidAccounts, render: (r) => fmtInt(r.paidAccounts) },
        chfColumn('netRevenueChf', 'Netto'),
        chfColumn('aiChf', 'KI'),
        chfColumn('speechChf', 'Stimme'),
        chfColumn('trialCostChf', 'davon Gratis'),
        { key: 'marginChf', label: 'Marge', type: 'num', sortValue: (r) => r.marginChf, render: (r) => signedChf(r.marginChf) },
        { key: 'marginShare', label: 'Marge %', type: 'num', sortValue: (r) => r.marginShare, render: (r) => signedPct(r.marginShare) },
      ],
      emptyText: 'Keine Apps.',
    });
    table.setRows(margin.byApp);
    const divisor = isNum(margin.vat) ? (1 + margin.vat).toFixed(3) : '1.081';
    const keep = isNum(margin.storeFee) ? (1 - margin.storeFee).toFixed(2) : '0.85';
    return card(
      {
        title,
        note:
          `Netto = Abos × Preis ÷ ${divisor} (MwSt) × ${keep} (Store). Variable Kosten = KI und Stimmen aller Konten ` +
          'der App, die der Gratis-Konten stehen zusätzlich einzeln. Abos nach heutigem Stand, Monat in Zürich.',
      },
      stats(
        [
          ['Nettoeinnahmen', fmtChf(totals.netRevenueChf)],
          ['Variable Kosten', fmtChf(totals.variableCostChf)],
          ['Marge', signedChf(totals.marginChf), totals.marginChf < 0 ? 'danger' : null],
          ['Mit Fixkosten', signedChf(totals.marginWithFixedChf), totals.marginWithFixedChf < 0 ? 'danger' : 'strong'],
        ],
        'kpis',
      ),
      table.el,
      stats(
        [
          ['Abos zusammen', fmtInt(totals.paidAccounts)],
          ['Kosten der Gratis-Konten', fmtChf(totals.trialCostChf)],
          ['Stimmen ohne Konto', fmtChf(totals.unassignedChf)],
          ['Safe Swiss Cloud: zu zahlen (mind. ' + fmtChf(totals.aiMinimumChf) + ')', fmtChf(totals.aiBillableChf)],
          ['Plan ElevenLabs', fmtChf(totals.speechFixedChf)],
          ['Fixkosten, die der Verbrauch nicht deckt', fmtChf(totals.fixedChf)],
        ],
        'stats stats--list',
      ),
    );
  }

  // -------------------------------------------------------------------------
  // App ansehen
  // -------------------------------------------------------------------------

  /**
   * Ein kleines Fenster mit der App dieses Kontos, nur zum Lesen. Jedes Laden
   * holt ein neues Einmal-Ticket (60 s) — es gibt keinen dauerhaften Link.
   */
  function openViewer(account) {
    const opener = document.activeElement;
    const titleId = uid('viewer');
    const used = asArray(account.apps).map((entry) => entry.id);
    let current = APPS.find((app) => used.includes(app.id))?.id ?? APPS[0].id;
    let generation = 0;
    let closed = false;

    const frame = h('iframe', {
      class: 'viewer__frame',
      title: 'App dieses Kontos, nur ansehen',
      sandbox: 'allow-scripts allow-same-origin',
      referrerpolicy: 'no-referrer',
    });
    const status = h('p', { class: 'viewer__status', role: 'status' });
    const switcher = h(
      'div',
      { class: 'viewer__apps', role: 'group', 'aria-label': 'App wählen' },
      APPS.map((app) =>
        h('button', {
          type: 'button',
          class: 'btn btn--small',
          'data-app': app.id,
          'aria-pressed': 'false',
          text: app.name,
          on: {
            click: () => {
              current = app.id;
              load();
            },
          },
        }),
      ),
    );
    const reloadButton = h('button', { type: 'button', class: 'btn btn--small', text: '↻ Neu laden', on: { click: () => load() } });
    const closeButton = h('button', { type: 'button', class: 'btn btn--small', text: 'Schliessen', on: { click: () => finish() } });
    const dialog = h(
      'dialog',
      { class: 'dialog viewer', 'aria-labelledby': titleId },
      h(
        'div',
        { class: 'viewer__head' },
        h('h2', { id: titleId, class: 'dialog__title', text: `App ansehen: ${displayName(account)}` }),
        h('div', { class: 'viewer__actions' }, reloadButton, closeButton),
      ),
      h('p', { class: 'viewer__hint', text: 'Nur ansehen – es wird nichts geändert.' }),
      switcher,
      status,
      h('div', { class: 'viewer__stage' }, frame),
    );

    async function load() {
      const gen = (generation += 1);
      for (const button of switcher.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.getAttribute('data-app') === current));
      }
      frame.removeAttribute('src');
      if (isDemo) {
        status.textContent = 'Im Demo-Modus gibt es keine App zum Ansehen.';
        return;
      }
      status.textContent = `${appName(current)}: holt ein Ticket …`;
      try {
        const response = await api(`${accountPath(account.id)}/view`, { method: 'POST', body: { app: current } });
        if (gen !== generation || closed) return;
        if (typeof response?.url !== 'string' || !VIEW_URL.test(response.url)) {
          status.textContent = 'Der Dienst hat keine gültige Adresse geschickt.';
          return;
        }
        frame.setAttribute('src', response.url);
        status.textContent = `${appName(current)} lädt. Bleibt es leer, läuft die App nicht — dann npm run all starten.`;
      } catch (err) {
        if (gen !== generation || closed) return;
        reportUnexpected(err);
        status.replaceChildren(...errorContent(err));
      }
    }

    function finish() {
      if (closed) return;
      closed = true;
      generation += 1;
      frame.removeAttribute('src');
      if (dialog.open) dialog.close();
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    }

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish();
    });
    dialog.addEventListener('close', () => finish());
    document.body.append(dialog);
    dialog.showModal();
    closeButton.focus();
    load();
  }

  /** Der Knopf im Kopf des Kontos. */
  function viewButton(store) {
    return h('button', {
      type: 'button',
      class: 'btn btn--small',
      text: 'App ansehen',
      title: 'Die App dieses Kontos in einem kleinen Fenster, nur zum Lesen',
      on: { click: () => openViewer(store.get()) },
    });
  }

  return { accessCard, paidCell, marginCard, viewButton };
}
