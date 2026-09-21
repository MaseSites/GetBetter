/**
 * „App ansehen“ aus dem Admin: die App zeigt ein fremdes Konto nur zum Lesen.
 *
 * Der Admin oeffnet die App mit `?view=<ticket>`. Die App loest das Ticket beim
 * Dienst ein (`POST /v1/view/redeem`), haelt das Konto nur im Arbeitsspeicher
 * und schaltet hier zentral auf Nur-Lesen: der Speicher schreibt nichts zurueck,
 * `callService` schickt nur GET (und das Einloesen), jede Anfrage traegt
 * `X-Better-View: 1` — dann lehnt auch der Dienst jede Aenderung ab.
 *
 * Rein und ohne React Native, damit es unter Node getestet werden kann.
 */

export const VIEW_PARAM = 'view';
export const VIEW_HEADER = 'X-Better-View';
export const REDEEM_PATH = '/v1/view/redeem';
const TICKET_PATTERN = /^[a-f0-9]{64}$/;

export type ViewState = {
  /** Ob die App gerade ein Konto nur ansieht. Einmal an, bleibt es bis zum Neuladen an. */
  active: boolean;
  /** Wessen App — fuer die Leiste oben. */
  username: string | null;
  /** Das Ticket war unbekannt, benutzt oder abgelaufen. */
  failed: boolean;
};

const IDLE: ViewState = { active: false, username: null, failed: false };

let state: ViewState = IDLE;
const changeListeners = new Set<() => void>();
const attemptListeners = new Set<() => void>();

/** Das Ticket aus `?view=…`, oder null. Nur 64 Hex-Zeichen gelten. */
export function viewTicketOf(search: string | null | undefined): string | null {
  if (typeof search !== 'string' || search.length === 0) return null;
  const query = search.startsWith('?') ? search.slice(1) : search;
  const ticket = new URLSearchParams(query).get(VIEW_PARAM);
  return ticket !== null && TICKET_PATTERN.test(ticket) ? ticket : null;
}

/** Pfad, Abfrage und Anker ohne `view` — fuer `history.replaceState`. */
export function withoutViewParam(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  url.searchParams.delete(VIEW_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Ob diese Anfrage im Nur-Lesen-Modus hinaus darf: Lesen, und das Einloesen selbst. */
export function allowedInView(method: string | undefined, path: string): boolean {
  const verb = (method ?? 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD') return true;
  return verb === 'POST' && path.split('?')[0] === REDEEM_PATH;
}

/**
 * Ob eine Anfrage an den Dienst jetzt abgewiesen wird: nur im Nur-Lesen-Modus
 * und nur, wenn sie etwas aendern wuerde. Sonst geht alles hinaus.
 */
export function refusesCall(method: string | undefined, path: string): boolean {
  return state.active && !allowedInView(method, path);
}

/** Ob gerade geschrieben werden darf — der Speicher fragt das vor jedem Aendern. */
export function writesAllowed(): boolean {
  return !state.active;
}

export function isViewing(): boolean {
  return state.active;
}

export function viewState(): ViewState {
  return state;
}

function update(next: ViewState) {
  state = next;
  for (const listener of changeListeners) listener();
}

/** Ab jetzt nur lesen — noch bevor das Ticket eingeloest ist. */
export function beginViewing(): void {
  update({ active: true, username: null, failed: false });
}

/** Das Ticket ist eingeloest: wessen App es ist. */
export function viewingAccount(username: string | null): void {
  if (!state.active) return;
  update({ ...state, username, failed: false });
}

/** Das Ticket galt nicht. Nur-Lesen bleibt an. */
export function viewFailed(): void {
  if (!state.active) return;
  update({ ...state, failed: true });
}

export function onViewChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/** Die Kopfzeile fuer jede Anfrage an den Dienst. */
export function viewHeaders(): Record<string, string> {
  return state.active ? { [VIEW_HEADER]: '1' } : {};
}

/** Etwas wollte schreiben und durfte nicht — die Oberflaeche sagt „Nur ansehen“. */
export function reportReadOnly(): void {
  for (const listener of attemptListeners) listener();
}

export function onReadOnlyAttempt(listener: () => void): () => void {
  attemptListeners.add(listener);
  return () => {
    attemptListeners.delete(listener);
  };
}

/** Nur fuer Tests: zurueck auf normal. */
export function resetViewModeForTests(): void {
  state = IDLE;
}
