/*
 * Better Admin: Abo-Anfragen. Bis es den Kauf im Store gibt, fragt eine App das
 * Abo an; hier wird freigeschaltet oder abgelehnt — in der Übersicht als eigener
 * Block, im Konto neben dem Abo-Schalter der App.
 *
 * Eigenes Modul wie billing.js: die Bausteine (h, card, toast …) kommen von
 * app.js herein. Nur createElement, textContent und setAttribute, kein innerHTML.
 */

export function createPlanRequestsUi(ui) {
  const { h, card, toast, errorContent, reportUnexpected, api, appName, displayName, accountHref, asArray, fmtRelative, fmtDateTime } =
    ui;

  const requestPath = (id, action) => `/api/plan-requests/${encodeURIComponent(id)}/${action}`;

  const DONE = {
    approve: (who, app) => `Abo für ${app} bei ${who} freigeschaltet.`,
    decline: (who, app) => `Abo-Anfrage von ${who} für ${app} abgelehnt.`,
  };

  /**
   * „Freischalten“ und „Ablehnen“. Solange eine Entscheidung läuft, sind beide
   * gesperrt; scheitert sie, gehen beide wieder, und eine Meldung sagt warum.
   */
  function decisionButtons(request, who, onDone) {
    let pending = false;
    const approve = h('button', { type: 'button', class: 'btn btn--primary btn--small', text: 'Freischalten' });
    const decline = h('button', { type: 'button', class: 'btn btn--small', text: 'Ablehnen' });
    const buttons = [approve, decline];

    async function decide(action) {
      if (pending) return;
      pending = true;
      buttons.forEach((button) => button.setAttribute('aria-disabled', 'true'));
      try {
        const response = await api(requestPath(request.id, action), { method: 'POST', body: {} });
        toast(DONE[action](who, appName(request.app)));
        onDone(response);
      } catch (err) {
        reportUnexpected(err);
        toast([`${appName(request.app)}: nicht entschieden. `, ...errorContent(err)], 'error');
        pending = false;
        buttons.forEach((button) => button.removeAttribute('aria-disabled'));
      }
    }

    approve.addEventListener('click', () => decide('approve'));
    decline.addEventListener('click', () => decide('decline'));
    return h(
      'div',
      { class: 'request-actions', role: 'group', 'aria-label': `Abo-Anfrage für ${appName(request.app)}` },
      approve,
      decline,
    );
  }

  const openCount = (count) => (count === 1 ? '1 offen' : `${count} offen`);

  /** Der Block in der Übersicht: wer wartet, die älteste Anfrage zuerst. */
  function requestsCard(requests) {
    const count = h('span', { class: 'num' });
    const list = h('ul', { class: 'request-list' });
    const empty = h('p', { class: 'empty-note', text: 'Keine offenen Anfragen.' });

    function sync() {
      const left = list.children.length;
      count.textContent = openCount(left);
      list.hidden = left === 0;
      empty.hidden = left > 0;
    }

    for (const request of asArray(requests)) {
      const who = displayName(request);
      const handle = [request.username ? `@${request.username}` : null, request.email].filter(Boolean).join(' · ');
      const item = h(
        'li',
        { class: 'request-row' },
        h(
          'div',
          { class: 'request-row__who' },
          h('a', { class: 'request-row__name', href: accountHref(request.accountId), text: who }),
          handle ? h('span', { class: 'request-row__meta', text: handle }) : null,
        ),
        h(
          'div',
          { class: 'request-row__app' },
          h('span', { class: 'request-row__title', text: appName(request.app) }),
          h('time', {
            class: 'request-row__meta',
            datetime: request.createdAt ?? '',
            title: fmtDateTime(request.createdAt),
            text: `angefragt ${fmtRelative(request.createdAt)}`,
          }),
        ),
        decisionButtons(request, who, () => {
          item.remove();
          sync();
        }),
      );
      list.append(item);
    }
    sync();

    return card(
      {
        title: 'Abo-Anfragen',
        actions: [count],
        note:
          'Freischalten setzt das Abo für diese App (paidApps), Ablehnen lässt es, wie es ist — beide Male bekommt das ' +
          'Konto eine Mitteilung. Später ersetzt der Kauf im Store diesen Schritt.',
      },
      list,
      empty,
    );
  }

  /** Im Konto neben dem Abo-Schalter: „Angefragt vor …“ mit denselben zwei Knöpfen. */
  function requestControls(store, appId) {
    const account = store.get();
    const request = asArray(account.planRequests).find((entry) => entry.app === appId);
    if (!request) return null;
    return h(
      'div',
      { class: 'access-row__request' },
      h('span', {
        class: 'plan plan--requested',
        title: fmtDateTime(request.createdAt),
        text: `Angefragt ${fmtRelative(request.createdAt)}`,
      }),
      decisionButtons(request, displayName(account), (response) => {
        const next = response?.account && typeof response.account === 'object' ? response.account : {};
        store.set({ ...store.get(), ...next });
      }),
    );
  }

  return { requestsCard, requestControls };
}
