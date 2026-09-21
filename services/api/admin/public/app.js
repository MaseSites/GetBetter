/*
 * Better Admin: die Oberfläche des lokalen Admin-Dashboards.
 *
 * Läuft nur auf 127.0.0.1:8091, ohne Framework und ohne Build. Die CSP erlaubt
 * nur Dateien vom selben Ursprung: kein Inline-Skript, kein Inline-Stil, kein
 * style-Attribut. Jedes Element entsteht über createElement, Daten landen nur
 * per textContent oder setAttribute im DOM, nie über innerHTML.
 *
 * ?demo=1 lädt eingebaute Beispieldaten (ganz unten, klar getrennt),
 * ?demo=offline spielt einen nicht erreichbaren Dienst durch. Ohne Parameter
 * spricht die Seite ausschliesslich mit /api auf demselben Ursprung.
 * Gespeichert wird nichts im Browser, weder localStorage noch Cookies.
 */

import { createBillingUi } from './billing.js';
import { createPlanRequestsUi } from './plans.js';

// ===========================================================================
// Einstellungen
// ===========================================================================

const LOCALE = 'de-CH';
const PAGE_SIZE = 100;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PASSWORD_MIN = 8;
const CHEAP_TARGET = 0.8;
const TOAST_MS = 5000;
const ERROR_TOAST_MS = 10000;
const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const OVERVIEW_DAYS = 30;
const COST_MONTHS = 13;
const CHART_HEIGHT = 220;
const SVG_NS = 'http://www.w3.org/2000/svg';

const DEMO_MODE = readDemoMode();

const APPS = [
  { id: 'getbetter', name: 'GetBetter', short: 'GB' },
  { id: 'betterfamily', name: 'BetterFamily', short: 'BF' },
  { id: 'bettergym', name: 'BetterGym', short: 'GY' },
  { id: 'betterai', name: 'BetterAi', short: 'AI' },
  { id: 'bettermoney', name: 'BetterMoney', short: 'MO' },
];
const APP_BY_ID = new Map(APPS.map((app) => [app.id, app]));

const COLLECTION_NAMES = {
  events: 'Termine',
  tasks: 'Aufgaben',
  notes: 'Notizen',
  contacts: 'Kontakte',
  shoppingItems: 'Einkauf',
  chores: 'Ämtli',
  recipes: 'Rezepte',
  plants: 'Pflanzen',
  pets: 'Haustiere',
  vehicles: 'Fahrzeuge',
  workouts: 'Trainings',
  meals: 'Mahlzeiten',
  drinks: 'Getränke',
  sleeps: 'Schlaf',
  meds: 'Medikamente',
  vitals: 'Werte',
  moods: 'Laune',
  expenses: 'Ausgaben',
  bills: 'Rechnungen',
  subscriptions: 'Abos',
  savingsGoals: 'Sparziele',
  chats: 'Gespräche',
  chatMessages: 'Nachrichten',
  habits: 'Gewohnheiten',
  trips: 'Reisen',
  documents: 'Dokumente',
  alarms: 'Wecker',
};

const FIELD_NAMES = {
  firstName: 'Spitzname',
  username: 'Benutzername',
  language: 'Sprache',
  disabled: 'Kontosperre',
  blockedApps: 'App-Sperren',
  paidApps: 'Abos',
  password: 'Passwort',
  themeMode: 'Modus',
  accentKey: 'Akzentfarbe',
  themePreset: 'Voreinstellung',
  backdrop: 'Hintergrund',
  assistantName: 'Name des Assistenten',
  assistantVoice: 'Stimme des Assistenten',
  onboarded: 'Einrichtung',
  favorites: 'Favoriten',
  quickAccess: 'Schnellzugriff',
  householdId: 'Haushalt',
};

const TIER_NAMES = {
  cheap_model: 'Günstig',
  chat_model: 'Gespräch',
  reasoning_model: 'Nachdenken',
  vision_model: 'Bilder',
};

const LANGUAGES = [
  ['de', 'Deutsch'],
  ['en', 'Englisch'],
  ['fr', 'Französisch'],
  ['it', 'Italienisch'],
];

const KIND_LABELS = {
  'account.created': 'Konto angelegt',
  'session.created': 'Anmeldung',
  'session.failed': 'Anmeldung fehlgeschlagen',
  'session.blocked': 'Anmeldung abgewiesen',
  'profile.updated': 'Profil geändert',
  'collection.changed': 'Daten geändert',
  'ai.reply': 'KI-Anfrage',
  'admin.updated': 'Admin: Konto geändert',
  'admin.password': 'Admin: Passwort gesetzt',
  'admin.deleted': 'Admin: Konto gelöscht',
  'admin.viewed': 'Admin: App angesehen',
  'plan.requested': 'Abo angefragt',
  'admin.planApproved': 'Admin: Abo freigeschaltet',
  'admin.planDeclined': 'Admin: Abo-Anfrage abgelehnt',
};

const REASON_TEXT = {
  wrong_password: 'falsches Passwort',
  unknown_account: 'unbekanntes Konto',
  invalid_credentials: 'falsche Anmeldedaten',
  account_disabled: 'Konto gesperrt',
  app_blocked: 'App gesperrt',
};

const APP_STATUS = {
  used: { icon: '●', label: 'genutzt' },
  unused: { icon: '○', label: 'nicht genutzt' },
  blocked: { icon: '⊘', label: 'gesperrt' },
};

const ERROR_TEXT = {
  username_invalid:
    'Der Benutzername passt nicht: 3–24 Zeichen, nur a–z, 0–9, Punkt, Strich und Unterstrich, am Anfang ein Buchstabe oder eine Ziffer.',
  username_taken: 'Dieser Benutzername ist schon vergeben.',
  not_found: 'Dieses Konto gibt es nicht (mehr).',
  password_too_short: `Das Passwort braucht mindestens ${PASSWORD_MIN} Zeichen.`,
  bad_request: 'Der Dienst hat die Anfrage als ungültig abgelehnt.',
  bad_response: 'Der Dienst hat keine lesbare Antwort geschickt.',
  confirm_mismatch: 'Die E-Mail stimmt nicht.',
  already_decided: 'Über diese Anfrage wurde schon entschieden — lade die Seite neu.',
  plan_unavailable: 'Für diese App gibt es noch kein Abo.',
};

// ===========================================================================
// Zahlen, Beträge, Daten
// ===========================================================================

const nfInt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf4 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const nfSig = new Intl.NumberFormat(LOCALE, { maximumSignificantDigits: 3 });
const nfPct = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 });
const dfDate = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
const dfDateTime = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dfTime = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const dfDayShort = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric' });
const dfDayHeading = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dfMonth = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const collator = new Intl.Collator(LOCALE, { sensitivity: 'base', numeric: true });

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);
const asArray = (value) => (Array.isArray(value) ? value : []);
const sumOf = (rows, pick) => rows.reduce((total, row) => total + (isNum(pick(row)) ? pick(row) : 0), 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function fmtInt(value) {
  return isNum(value) ? nfInt.format(value) : '—';
}

/** Credits von ElevenLabs: Flash und Turbo kosten halbe, darum eine Nachkommastelle. */
function fmtCredits(value) {
  return isNum(value) ? nf1.format(value) : '—';
}

function fmtChf(value) {
  if (!isNum(value)) return '—';
  const abs = Math.abs(value);
  return `CHF ${(abs > 0 && abs < 0.01 ? nf4 : nf2).format(value)}`;
}

function fmtPrice(value) {
  if (!isNum(value)) return '—';
  if (value === 0 || Math.abs(value) >= 0.0001) return fmtChf(value);
  return `CHF ${nfSig.format(value)}`;
}

function fmtPct(share) {
  if (!isNum(share)) return '—';
  if (share > 0 && share < 0.01) return `< ${nfPct.format(0.01)}`;
  return nfPct.format(share);
}

function fmtBytes(value) {
  if (!isNum(value)) return '—';
  if (value < 1024) return `${nfInt.format(value)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${nf1.format(size)} ${units[index]}`;
}

function fmtDuration(ms) {
  if (!isNum(ms)) return '—';
  if (ms < 1000) return `${nfInt.format(ms)} ms`;
  return `${nf1.format(ms / 1000)} s`;
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeValue(value) {
  const date = toDate(value);
  return date ? date.getTime() : null;
}

function fmtDate(value) {
  const date = toDate(value);
  return date ? dfDate.format(date) : '—';
}

function fmtDateTime(value) {
  const date = toDate(value);
  return date ? dfDateTime.format(date) : '—';
}

function fmtTime(value) {
  const date = toDate(value);
  return date ? dfTime.format(date) : '—';
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDayDiff(date, now = new Date()) {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

function fmtRelative(value) {
  const date = toDate(value);
  if (!date) return '—';
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return 'gerade eben';
  if (abs < HOUR_MS / 1000) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < DAY_MS / 1000) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  const days = calendarDayDiff(date);
  if (Math.abs(days) < 31) return rtf.format(days, 'day');
  return dfDate.format(date);
}

function dayKeyOf(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthKeyOf(date) {
  return dayKeyOf(date).slice(0, 7);
}

function parseDayKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? ''));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function fmtDayShort(key) {
  const date = parseDayKey(key);
  return date ? dfDayShort.format(date) : String(key ?? '—');
}

function fmtDayLong(key) {
  const date = parseDayKey(key);
  return date ? dfDate.format(date) : String(key ?? '—');
}

function dayHeading(key) {
  const date = parseDayKey(key);
  if (!date) return 'Ohne Datum';
  const diff = calendarDayDiff(date);
  if (diff === 0) return 'Heute';
  if (diff === -1) return 'Gestern';
  return dfDayHeading.format(date);
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return dfMonth.format(new Date(year, month - 1, 1));
}

function recentMonthKeys(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}

function monthDayKeys(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, i) => dayKeyOf(new Date(year, month - 1, i + 1)));
}

function lastDayKeys(endKey, count) {
  const end = parseDayKey(endKey) ?? startOfDay(new Date());
  return Array.from({ length: count }, (_, i) =>
    dayKeyOf(new Date(end.getFullYear(), end.getMonth(), end.getDate() - (count - 1 - i))),
  );
}

const appName = (id) => APP_BY_ID.get(id)?.name ?? String(id ?? '—');
const tierName = (tier) => TIER_NAMES[tier] ?? String(tier ?? '—');
const collectionName = (id) => COLLECTION_NAMES[id] ?? String(id ?? '—');
const fieldName = (id) => FIELD_NAMES[id] ?? String(id);
const languageName = (code) => LANGUAGES.find(([value]) => value === code)?.[1] ?? String(code ?? '—');

function displayName(account) {
  const first = typeof account?.firstName === 'string' ? account.firstName.trim() : '';
  if (first) return first;
  if (account?.username) return `@${account.username}`;
  return account?.email || account?.id || 'Unbekanntes Konto';
}

const accountHref = (id) => `#/accounts/${encodeURIComponent(id)}`;
const accountPath = (id) => `/api/accounts/${encodeURIComponent(id)}`;

function activityHref(filter) {
  const params = new URLSearchParams();
  if (filter.accountId) params.set('accountId', filter.accountId);
  if (filter.kind) params.set('kind', filter.kind);
  const query = params.toString();
  return query ? `#/activity?${query}` : '#/activity';
}

// ===========================================================================
// DOM-Helfer: nur createElement, textContent und setAttribute
// ===========================================================================

let uidCounter = 0;
const uid = (prefix) => `${prefix}-${(uidCounter += 1)}`;

const PROPERTY_KEYS = new Set(['value', 'checked', 'selected']);

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, attrs);
  appendChildren(el, children);
  return el;
}

function applyProps(el, props) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') el.textContent = String(value);
    else if (key === 'on') {
      for (const [type, handler] of Object.entries(value)) el.addEventListener(type, handler);
    } else if (PROPERTY_KEYS.has(key)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else if (child instanceof Node) el.append(child);
    else el.append(document.createTextNode(String(child)));
  }
}

function createStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      value = next;
      listeners.forEach((listener) => listener(next));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ===========================================================================
// Dienst und Fehler
// ===========================================================================

class ApiError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  if (DEMO_MODE) return demoApi(method, path, body);
  const init = { method, headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' };
  if (method !== 'GET') {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body ?? {});
  }
  let response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('offline');
  }
  const payload = await readJson(response);
  if (response.ok) {
    if (payload === undefined) throw new ApiError('bad_response', response.status);
    return payload;
  }
  if ([502, 503, 504].includes(response.status)) throw new ApiError('offline', response.status);
  const code = typeof payload?.error === 'string' ? payload.error : 'http_error';
  throw new ApiError(code, response.status);
}

async function readJson(response) {
  let text = '';
  try {
    text = await response.text();
  } catch {
    return undefined;
  }
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Programmierfehler (kein ApiError) in die Konsole, damit sie auffallen. Nie mit Formulardaten. */
function reportUnexpected(err) {
  if (!(err instanceof ApiError)) console.error(err);
}

function errorTitle(err) {
  if (!(err instanceof ApiError)) return 'In der Oberfläche ist etwas schiefgegangen';
  if (err.code === 'offline') return 'Keine Verbindung zum Dienst';
  if (err.code === 'not_found') return 'Nicht gefunden';
  return 'Das hat nicht geklappt';
}

function errorContent(err) {
  if (!(err instanceof ApiError)) return ['Lade die Seite neu. Wenn es wieder passiert, steht mehr in der Browser-Konsole.'];
  if (err.code === 'offline') return ['Der Dienst läuft nicht — starte ', h('code', { text: 'npm run all' })];
  if (ERROR_TEXT[err.code]) return [ERROR_TEXT[err.code]];
  if (err.code === 'http_error') return [`Unerwartete Antwort vom Dienst (Status ${err.status}).`];
  return [`Der Dienst meldet «${err.code}»${err.status ? ` (Status ${err.status})` : ''}.`];
}

// ===========================================================================
// Rückmeldungen: Meldungen, Dialog, Fehlerflächen
// ===========================================================================

function toast(content, tone = 'ok') {
  const isError = tone === 'error';
  const region = document.getElementById(isError ? 'alert-region' : 'status-region');
  if (!region) return;
  const item = h(
    'div',
    { class: `toast toast--${tone}` },
    h('span', { class: 'toast__icon', 'aria-hidden': 'true', text: isError ? '✕' : '✓' }),
    h('span', { class: 'toast__text' }, isError ? h('span', { class: 'sr-only', text: 'Fehler: ' }) : null, content),
    h('button', {
      type: 'button',
      class: 'toast__close',
      'aria-label': 'Meldung schliessen',
      text: '×',
      on: { click: () => item.remove() },
    }),
  );
  region.append(item);
  setTimeout(() => item.remove(), isError ? ERROR_TOAST_MS : TOAST_MS);
}

function confirmDialog({ title, body, confirmLabel, tone = 'primary' }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const titleId = uid('dialog-title');
    const bodyId = uid('dialog-body');
    let settled = false;
    const cancelButton = h('button', { type: 'button', class: 'btn', text: 'Abbrechen' });
    const confirmButton = h('button', { type: 'button', class: `btn btn--${tone}`, text: confirmLabel });
    const dialog = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': titleId, 'aria-describedby': bodyId },
      h('h2', { id: titleId, class: 'dialog__title', text: title }),
      h('p', { id: bodyId, class: 'dialog__body', text: body }),
      h('div', { class: 'dialog__actions' }, cancelButton, confirmButton),
    );
    // Direkt aus den Knöpfen auflösen: das close-Ereignis kommt asynchron und
    // bleibt in einem verdeckten Fenster manchmal liegen.
    function finish(result) {
      if (settled) return;
      settled = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      resolve(result);
    }
    cancelButton.addEventListener('click', () => finish(false));
    confirmButton.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener('close', () => finish(false));
    document.body.append(dialog);
    dialog.showModal();
    cancelButton.focus();
  });
}

const normaliseConfirm = (value) => String(value ?? '').trim().toLowerCase();

const plainText = (parts) =>
  asArray(parts)
    .map((part) => (typeof part === 'string' ? part : (part?.textContent ?? '')))
    .join('');

/**
 * Wie `confirmDialog`, nur muss zuerst `expected` eingetippt werden (Gross und
 * klein egal). `onConfirm(eingabe)` läuft bei offenem Dialog; wirft es, steht
 * die Meldung im Dialog und man kann es nochmal versuchen. Löst mit true auf,
 * wenn `onConfirm` geklappt hat, sonst mit false. Escape bricht ab, ausser
 * während es läuft; der Fokus geht danach zurück zum Knopf, der ihn öffnete.
 */
function typedConfirmDialog({ title, body, expected, inputLabel, confirmLabel, busyLabel, onConfirm }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const ids = { title: uid('dialog-title'), body: uid('dialog-body'), input: uid('dialog-input'), error: uid('dialog-error') };
    const wanted = normaliseConfirm(expected);
    let settled = false;
    let pending = false;
    const input = h('input', {
      id: ids.input,
      class: 'input',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'none',
      spellcheck: 'false',
      'aria-describedby': ids.error,
    });
    const error = h('p', { id: ids.error, class: 'field__error', role: 'alert', hidden: true });
    const cancelButton = h('button', { type: 'button', class: 'btn', text: 'Abbrechen' });
    const confirmButton = h('button', { type: 'submit', class: 'btn btn--danger', text: confirmLabel });
    const form = h(
      'form',
      { class: 'form dialog__form', novalidate: true },
      field(inputLabel, input, error),
      h('div', { class: 'dialog__actions' }, cancelButton, confirmButton),
    );
    const dialog = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': ids.title, 'aria-describedby': ids.body },
      h('h2', { id: ids.title, class: 'dialog__title', text: title }),
      h('p', { id: ids.body, class: 'dialog__body' }, body),
      form,
    );

    const matches = () => wanted.length > 0 && normaliseConfirm(input.value) === wanted;
    const sync = () => confirmButton.setAttribute('aria-disabled', String(pending || !matches()));

    function finish(result) {
      if (settled) return;
      settled = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      resolve(result);
    }

    async function submit(event) {
      event.preventDefault();
      if (pending) return;
      if (!matches()) {
        setFieldError(input, error, input.value.trim() ? ERROR_TEXT.confirm_mismatch : 'Tippe zuerst die E-Mail ein.');
        input.focus();
        return;
      }
      pending = true;
      setBusy(confirmButton, true, busyLabel, confirmLabel);
      cancelButton.setAttribute('aria-disabled', 'true');
      try {
        await onConfirm(input.value);
        finish(true);
      } catch (err) {
        reportUnexpected(err);
        pending = false;
        setBusy(confirmButton, false, busyLabel, confirmLabel);
        cancelButton.removeAttribute('aria-disabled');
        setFieldError(input, error, plainText(errorContent(err)));
        sync();
        input.focus();
      }
    }

    input.addEventListener('input', () => {
      setFieldError(input, error, '');
      sync();
    });
    form.addEventListener('submit', submit);
    cancelButton.addEventListener('click', () => {
      if (!pending) finish(false);
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (!pending) finish(false);
    });
    dialog.addEventListener('close', () => finish(false));
    sync();
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
  });
}

function loadingBlock(text = 'Lädt …') {
  return h('div', { class: 'loading' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), text);
}

function errorPage(err, retry, back) {
  return h(
    'div',
    { class: 'page', 'data-title': 'Fehler' },
    h(
      'section',
      { class: 'notice notice--error', role: 'alert' },
      h('h1', { class: 'notice__title', tabindex: '-1', text: errorTitle(err) }),
      h('p', { class: 'notice__text' }, errorContent(err)),
      h(
        'div',
        { class: 'notice__actions' },
        h('button', { type: 'button', class: 'btn btn--primary', text: 'Nochmal versuchen', on: { click: retry } }),
        back ? h('a', { class: 'btn btn--ghost', href: back.href, text: back.label }) : null,
      ),
    ),
  );
}

function inlineError(err, retry) {
  return h(
    'div',
    { class: 'notice notice--error', role: 'alert' },
    h('h3', { class: 'notice__title', text: errorTitle(err) }),
    h('p', { class: 'notice__text' }, errorContent(err)),
    h(
      'div',
      { class: 'notice__actions' },
      h('button', { type: 'button', class: 'btn', text: 'Nochmal versuchen', on: { click: retry } }),
    ),
  );
}

// ===========================================================================
// Bausteine
// ===========================================================================

/** Zugang, Abo, Marge und „App ansehen“ (billing.js) — erst beim ersten Rendern gebaut. */
let billingUiInstance = null;

function billingUi() {
  billingUiInstance =
    billingUiInstance ??
    createBillingUi({
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
      isDemo: Boolean(DEMO_MODE),
      requestControls: (store, appId) => planRequestsUi().requestControls(store, appId),
    });
  return billingUiInstance;
}

/** Abo-Anfragen (plans.js): der Block in der Übersicht, die Knöpfe im Konto. */
let planRequestsUiInstance = null;

function planRequestsUi() {
  planRequestsUiInstance =
    planRequestsUiInstance ??
    createPlanRequestsUi({
      h,
      card,
      toast,
      errorContent,
      reportUnexpected,
      api,
      appName,
      displayName,
      accountHref,
      asArray,
      fmtRelative,
      fmtDateTime,
    });
  return planRequestsUiInstance;
}

function page({ title, subtitle, actions }, ...content) {
  return h(
    'div',
    { class: 'page', 'data-title': title },
    h(
      'header',
      { class: 'page__head' },
      h(
        'div',
        { class: 'page__heading' },
        h('h1', { class: 'page__title', tabindex: '-1', text: title }),
        subtitle ? h('p', { class: 'page__subtitle' }, subtitle) : null,
      ),
      actions?.length ? h('div', { class: 'page__actions' }, actions) : null,
    ),
    content,
  );
}

function card({ title, actions, note, className, headingTag = 'h2' }, ...content) {
  const titleId = uid('card');
  return h(
    'section',
    { class: className ? `card ${className}` : 'card', 'aria-labelledby': titleId },
    h(
      'div',
      { class: 'card__head' },
      h(headingTag, { id: titleId, class: 'card__title' }, title),
      actions?.length ? h('div', { class: 'card__actions' }, actions) : null,
    ),
    note ? h('p', { class: 'card__note' }, note) : null,
    content,
  );
}

/** items: [label, value, tone?] — value darf Text oder ein Element sein. */
function stats(items, className = 'stats') {
  return h(
    'dl',
    { class: className },
    items
      .filter(Boolean)
      .map(([label, value, tone]) =>
        h(
          'div',
          { class: tone ? `stat stat--${tone}` : 'stat' },
          h('dt', { class: 'stat__label', text: label }),
          h('dd', { class: 'stat__value num' }, value),
        ),
      ),
  );
}

function reloadButton(onClick) {
  return h(
    'button',
    { type: 'button', class: 'btn btn--ghost', on: { click: onClick } },
    h('span', { 'aria-hidden': 'true', text: '↻' }),
    'Neu laden',
  );
}

function pill(icon, label, tone) {
  return h(
    'span',
    { class: `pill pill--${tone}` },
    h('span', { class: 'pill__icon', 'aria-hidden': 'true', text: icon }),
    label,
  );
}

const statusPill = (disabled) => (disabled ? pill('⊘', 'Gesperrt', 'danger') : pill('✓', 'Aktiv', 'ok'));

function timeEl(value, format = fmtDateTime) {
  const date = toDate(value);
  if (!date) return h('span', { class: 'muted', text: '—' });
  return h('time', { datetime: date.toISOString(), title: fmtDateTime(date), text: format(date) });
}

function appStatus(account, appId) {
  if (asArray(account.blockedApps).includes(appId)) return 'blocked';
  if (asArray(account.apps).some((app) => app.id === appId)) return 'used';
  return 'unused';
}

function appPills(account) {
  return h(
    'ul',
    { class: 'app-pills' },
    APPS.map((app) => {
      const status = appStatus(account, app.id);
      const meta = APP_STATUS[status];
      return h(
        'li',
        { class: `app-pill app-pill--${status}`, title: `${app.name}: ${meta.label}` },
        h('span', { class: 'app-pill__icon', 'aria-hidden': 'true', text: meta.icon }),
        h('span', { 'aria-hidden': 'true', text: app.short }),
        h('span', { class: 'sr-only', text: `${app.name}: ${meta.label}` }),
      );
    }),
  );
}

function appLegend() {
  return h(
    'p',
    { class: 'legend' },
    Object.values(APP_STATUS).map((meta) =>
      h('span', { class: 'legend__item' }, h('span', { 'aria-hidden': 'true', text: meta.icon }), meta.label),
    ),
    h('span', { class: 'legend__item', text: APPS.map((app) => `${app.short} ${app.name}`).join(' · ') }),
  );
}

function createSwitch({ labelledBy, onText, offText, dangerWhen, onToggle }) {
  const stateText = h('span', { class: 'switch__state' });
  const button = h(
    'button',
    {
      type: 'button',
      role: 'switch',
      class: `switch switch--danger-${dangerWhen}`,
      'aria-labelledby': labelledBy,
      'aria-checked': 'false',
      on: {
        click: () => {
          if (button.getAttribute('aria-disabled') === 'true') return;
          onToggle();
        },
      },
    },
    h('span', { class: 'switch__track', 'aria-hidden': 'true' }, h('span', { class: 'switch__knob' })),
    stateText,
  );
  function update({ checked, busy }) {
    button.setAttribute('aria-checked', String(Boolean(checked)));
    stateText.textContent = checked ? onText : offText;
    if (busy) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
  }
  return { el: button, update };
}

function setFieldError(control, errorEl, message) {
  errorEl.textContent = message;
  errorEl.hidden = !message;
  control.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function field(label, control, ...extra) {
  return h('div', { class: 'field' }, h('label', { class: 'field__label', for: control.id, text: label }), control, extra);
}

function setBusy(button, busy, busyText, idleText) {
  button.setAttribute('aria-disabled', String(busy));
  button.textContent = busy ? busyText : idleText;
}

// ---------------------------------------------------------------------------
// Tabelle mit Sortierung
// ---------------------------------------------------------------------------

/**
 * columns: { key, label, type?: 'num'|'date'|'text', sortable?: false,
 *            sortValue?: row => number|string|null, render: row => Node|string }
 */
function createTable({ caption, columns, sort = null, onSortChange, rowHref, emptyText = 'Keine Einträge.' }) {
  let current = sort;
  let rows = [];
  const table = h('table', { class: 'table' });
  const wrap = h('div', { class: 'table-wrap', role: 'region', 'aria-label': caption, tabindex: '0' }, table);

  function toggleSort(column) {
    if (current?.key === column.key) {
      current = { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
    } else {
      current = { key: column.key, dir: column.type === 'num' || column.type === 'date' ? 'desc' : 'asc' };
    }
    onSortChange?.(current);
    draw();
    table.querySelector(`button[data-sort-key="${column.key}"]`)?.focus();
  }

  function headerCell(column) {
    const className = column.type === 'num' ? 'num' : null;
    if (column.sortable === false || !column.sortValue) {
      return h('th', { scope: 'col', class: className, text: column.label });
    }
    const active = current?.key === column.key;
    const ariaSort = active ? (current.dir === 'asc' ? 'ascending' : 'descending') : null;
    return h(
      'th',
      { scope: 'col', class: className, 'aria-sort': ariaSort },
      h(
        'button',
        { type: 'button', class: 'sort', 'data-sort-key': column.key, on: { click: () => toggleSort(column) } },
        column.label,
        h('span', { class: 'sort__icon', 'aria-hidden': 'true', text: active ? (current.dir === 'asc' ? '▲' : '▼') : '↕' }),
      ),
    );
  }

  function bodyRow(row) {
    const tr = h(
      'tr',
      { class: rowHref ? 'row-link' : null },
      columns.map((column) => h('td', { class: column.type === 'num' ? 'num' : null }, column.render(row))),
    );
    if (rowHref) {
      tr.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return;
        if (String(window.getSelection?.() ?? '').length > 0) return;
        location.hash = rowHref(row);
      });
    }
    return tr;
  }

  function draw() {
    const sorted = sortRows(rows, columns, current);
    const body = sorted.length
      ? sorted.map(bodyRow)
      : [h('tr', null, h('td', { class: 'empty', colspan: String(columns.length), text: emptyText }))];
    table.replaceChildren(
      h('caption', { class: 'sr-only', text: caption }),
      h('thead', null, h('tr', null, columns.map(headerCell))),
      h('tbody', null, body),
    );
  }

  draw();
  return {
    el: wrap,
    setRows(next) {
      rows = asArray(next);
      draw();
    },
  };
}

function sortRows(rows, columns, sort) {
  if (!sort) return rows;
  const column = columns.find((c) => c.key === sort.key);
  if (!column?.sortValue) return rows;
  const factor = sort.dir === 'asc' ? 1 : -1;
  const isEmpty = (value) => value === null || value === undefined || value === '' || Number.isNaN(value);
  return [...rows].sort((a, b) => {
    const va = column.sortValue(a);
    const vb = column.sortValue(b);
    if (isEmpty(va) && isEmpty(vb)) return 0;
    if (isEmpty(va)) return 1;
    if (isEmpty(vb)) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return factor * (va - vb);
    return factor * collator.compare(String(va), String(vb));
  });
}

/** Einträge pro Funktion, gruppiert nach App. Nimmt die Zeilen von overview.modules und detail.counts. */
function moduleCountsTable(rawRows, caption) {
  const rows = asArray(rawRows).map((row) => ({
    app: row.app,
    name: row.name || collectionName(row.collection) || row.id || row.module,
    collection: row.collection,
    items: row.items,
  }));
  const knownIds = APPS.map((app) => app.id);
  const extraIds = [...new Set(rows.map((row) => row.app).filter((id) => !knownIds.includes(id)))];
  const groups = [...knownIds, ...extraIds]
    .map((id) => ({ id, rows: rows.filter((row) => row.app === id) }))
    .filter((group) => group.rows.length > 0);

  const table = h(
    'table',
    { class: 'table' },
    h('caption', { class: 'sr-only', text: caption }),
    h(
      'thead',
      null,
      h(
        'tr',
        null,
        h('th', { scope: 'col', text: 'Funktion' }),
        h('th', { scope: 'col', text: 'Sammlung' }),
        h('th', { scope: 'col', class: 'num', text: 'Einträge' }),
      ),
    ),
  );
  if (!groups.length) {
    table.append(
      h('tbody', null, h('tr', null, h('td', { class: 'empty', colspan: '3', text: 'Noch keine Einträge.' }))),
    );
  }
  for (const group of groups) {
    table.append(
      h(
        'tbody',
        null,
        h(
          'tr',
          { class: 'group-row' },
          h('th', { scope: 'rowgroup', colspan: '2', text: appName(group.id) }),
          h('td', { class: 'num', text: fmtInt(sumOf(group.rows, (row) => row.items)) }),
        ),
        group.rows.map((row) =>
          h(
            'tr',
            null,
            h('td', { text: row.name ?? '—' }),
            h('td', null, row.collection ? h('code', { text: row.collection }) : '—'),
            h('td', { class: 'num', text: fmtInt(row.items) }),
          ),
        ),
      ),
    );
  }
  return h('div', { class: 'table-wrap', role: 'region', 'aria-label': caption, tabindex: '0' }, table);
}

// ---------------------------------------------------------------------------
// Diagramm: Balken pro Tag, als SVG aus JS, Farben aus CSS
// ---------------------------------------------------------------------------

const METRICS = {
  requests: { key: 'requests', label: 'Anfragen', unit: 'Anfragen', integer: true, format: fmtInt },
  costChf: { key: 'costChf', label: 'Kosten', unit: 'CHF', integer: false, format: fmtChf },
};

function niceScale(max, integer, ticks = 4) {
  if (!(max > 0)) return integer ? { step: 1, count: 4, max: 4 } : { step: 0.01, count: 4, max: 0.04 };
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = integer ? Math.max(1, Math.ceil(factor * magnitude)) : factor * magnitude;
  const count = Math.max(1, Math.ceil(max / step - 1e-9));
  return { step, count, max: step * count };
}

function decimalFormatter(step) {
  let digits = 2;
  while (digits < 6 && Math.abs(Math.round(step * 10 ** digits) - step * 10 ** digits) > 1e-6) digits += 1;
  const format = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (value) => format.format(value);
}

function fillDays(byDay, dayKeys) {
  const map = new Map(asArray(byDay).map((row) => [row.day, row]));
  return dayKeys.map((day) => ({
    day,
    requests: isNum(map.get(day)?.requests) ? map.get(day).requests : 0,
    costChf: isNum(map.get(day)?.costChf) ? map.get(day).costChf : 0,
  }));
}

function barChart(series, metric, width) {
  const margin = { top: 22, right: 8, bottom: 26, left: 60 };
  const height = CHART_HEIGHT;
  const plotWidth = Math.max(40, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const values = series.map((d) => (isNum(d[metric.key]) && d[metric.key] > 0 ? d[metric.key] : 0));
  const maxValue = values.reduce((max, value) => Math.max(max, value), 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const scale = niceScale(maxValue, metric.integer);
  const tickFormat = metric.integer ? fmtInt : decimalFormatter(scale.step);
  const baseline = margin.top + plotHeight;
  const yOf = (value) => baseline - (value / scale.max) * plotHeight;
  const band = plotWidth / Math.max(1, series.length);
  const barWidth = Math.max(2, Math.min(band * 0.7, 26));
  const label =
    `${metric.label} pro Tag vom ${fmtDayLong(series[0]?.day)} bis ${fmtDayLong(series.at(-1)?.day)}: ` +
    `zusammen ${metric.format(total)}, höchster Tag ${metric.format(maxValue)}.`;

  const root = svg('svg', {
    class: 'chart__svg',
    width: String(width),
    height: String(height),
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': label,
  });
  root.append(svg('text', { class: 'chart__unit', x: '0', y: '11', text: metric.unit }));

  for (let i = 0; i <= scale.count; i += 1) {
    const value = scale.step * i;
    const y = Math.round(yOf(value)) + 0.5;
    root.append(
      svg('line', {
        class: i === 0 ? 'chart__axis' : 'chart__grid',
        x1: String(margin.left),
        x2: String(width - margin.right),
        y1: String(y),
        y2: String(y),
      }),
      svg('text', {
        class: 'chart__tick',
        x: String(margin.left - 8),
        y: String(y + 4),
        'text-anchor': 'end',
        text: tickFormat(value),
      }),
    );
  }

  series.forEach((d, i) => {
    const value = values[i];
    if (value <= 0) return;
    const barHeight = Math.max(1, (value / scale.max) * plotHeight);
    const x = margin.left + i * band + (band - barWidth) / 2;
    root.append(
      svg(
        'rect',
        {
          class: 'chart__bar',
          x: x.toFixed(2),
          y: (baseline - barHeight).toFixed(2),
          width: barWidth.toFixed(2),
          height: barHeight.toFixed(2),
        },
        svg('title', { text: `${fmtDayShort(d.day)}: ${metric.format(value)}` }),
      ),
    );
  });

  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(plotWidth / 56))));
  series.forEach((d, i) => {
    if (i % labelEvery !== 0) return;
    root.append(
      svg('text', {
        class: 'chart__tick',
        x: (margin.left + i * band + band / 2).toFixed(2),
        y: String(height - 8),
        'text-anchor': 'middle',
        text: fmtDayShort(d.day),
      }),
    );
  });
  return root;
}

function dailyChartCard({ title, byDay, dayKeys, metric = 'requests' }) {
  const series = fillDays(byDay, dayKeys);
  let currentMetric = metric;
  let lastWidth = 0;
  const slot = h('div', { class: 'chart' });
  const buttons = Object.values(METRICS).map((m) =>
    h('button', {
      type: 'button',
      class: 'seg__btn',
      'aria-pressed': String(m.key === currentMetric),
      text: m.label,
      'data-metric': m.key,
      on: {
        click: () => {
          currentMetric = m.key;
          draw(true);
        },
      },
    }),
  );

  function draw(force) {
    const width = Math.round(slot.clientWidth || 640);
    if (!force && Math.abs(width - lastWidth) < 4) return;
    lastWidth = width;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.metric === currentMetric)));
    slot.replaceChildren(barChart(series, METRICS[currentMetric], width));
  }

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      if (!slot.isConnected) {
        observer.disconnect();
        return;
      }
      draw(false);
    });
    observer.observe(slot);
  }
  draw(true);

  const dayTable = createTable({
    caption: `${title} als Tabelle`,
    columns: [
      { key: 'day', label: 'Tag', type: 'date', sortValue: (r) => r.day, render: (r) => fmtDayLong(r.day) },
      { key: 'requests', label: 'Anfragen', type: 'num', sortValue: (r) => r.requests, render: (r) => fmtInt(r.requests) },
      { key: 'costChf', label: 'Kosten', type: 'num', sortValue: (r) => r.costChf, render: (r) => fmtChf(r.costChf) },
    ],
    sort: { key: 'day', dir: 'desc' },
  });
  dayTable.setRows(series);

  return card(
    {
      title,
      actions: [h('div', { class: 'seg', role: 'group', 'aria-label': 'Kennzahl im Diagramm' }, buttons)],
    },
    slot,
    h('details', { class: 'chart-table' }, h('summary', { text: 'Als Tabelle anzeigen' }), dayTable.el),
  );
}

function shareMeter(share) {
  const hasValue = isNum(share);
  const value = hasValue ? clamp(share, 0, 1) : null;
  const labelId = uid('share');
  const reached = hasValue && value >= CHEAP_TARGET;
  const statusText = !hasValue ? 'Noch keine Anfragen' : reached ? '✓ Ziel erreicht' : '! Unter dem Ziel';
  const statusClass = !hasValue ? 'share__status' : reached ? 'share__status share__status--ok' : 'share__status share__status--low';
  const target = CHEAP_TARGET * 100;
  return h(
    'div',
    { class: 'share' },
    h(
      'div',
      { class: 'share__head' },
      h('span', { id: labelId, class: 'share__label', text: 'Anteil günstige Stufe (30 Tage)' }),
      h('span', { class: 'share__value num', text: hasValue ? fmtPct(value) : '—' }),
    ),
    h(
      'div',
      {
        role: 'meter',
        'aria-labelledby': labelId,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': hasValue ? String(Math.round(value * 100)) : null,
        'aria-valuetext': hasValue ? `${fmtPct(value)}, Ziel ${fmtPct(CHEAP_TARGET)}` : 'keine Daten',
      },
      svg(
        'svg',
        { class: 'meter', viewBox: '0 0 100 14', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
        svg('rect', { class: 'meter__track', x: '0', y: '3', width: '100', height: '8' }),
        hasValue ? svg('rect', { class: 'meter__bar', x: '0', y: '3', width: (value * 100).toFixed(2), height: '8' }) : null,
        svg('line', {
          class: 'meter__target',
          x1: String(target),
          x2: String(target),
          y1: '0',
          y2: '14',
          'vector-effect': 'non-scaling-stroke',
        }),
      ),
    ),
    h(
      'div',
      { class: 'share__foot' },
      h('span', { text: `Senkrechter Strich: Ziel ${fmtPct(CHEAP_TARGET)}` }),
      h('span', { class: statusClass, text: statusText }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Verlauf: Sätze je Art und die Liste mit «Ältere laden»
// ---------------------------------------------------------------------------

function listText(fields) {
  const names = asArray(fields).map(fieldName);
  return names.length ? `: ${names.join(', ')}` : '';
}

function describeEntry(entry) {
  const detail = entry.detail && typeof entry.detail === 'object' ? entry.detail : {};
  const inApp = detail.app ? ` in ${appName(detail.app)}` : '';
  switch (entry.kind) {
    case 'account.created':
      return { icon: '+', tone: 'neutral', text: 'Konto angelegt' };
    case 'session.created':
      return { icon: '→', tone: 'neutral', text: `Angemeldet${inApp}` };
    case 'session.failed':
      return {
        icon: '✕',
        tone: 'danger',
        text: `Anmeldung${inApp} fehlgeschlagen${detail.reason ? ` (${REASON_TEXT[detail.reason] ?? detail.reason})` : ''}`,
      };
    case 'session.blocked':
      return {
        icon: '⊘',
        tone: 'danger',
        text: detail.app
          ? `Anmeldung in ${appName(detail.app)} abgewiesen, die App ist gesperrt`
          : 'Anmeldung abgewiesen, das Konto ist gesperrt',
      };
    case 'profile.updated':
      return { icon: '✎', tone: 'neutral', text: `Profil geändert${listText(detail.fields)}` };
    case 'collection.changed':
      return {
        icon: '≡',
        tone: 'neutral',
        text:
          `${collectionName(detail.collection)}: ${fmtInt(detail.added ?? 0)} neu, ` +
          `${fmtInt(detail.updated ?? 0)} geändert, ${fmtInt(detail.removed ?? 0)} gelöscht`,
      };
    case 'ai.reply':
      return describeAi(detail, inApp);
    case 'admin.updated':
      return { icon: '⚙︎', tone: 'admin', text: `Im Admin geändert${listText(detail.fields)}` };
    case 'admin.password':
      return { icon: '⚙︎', tone: 'admin', text: 'Passwort im Admin neu gesetzt' };
    case 'admin.deleted':
      return {
        icon: '⚙︎',
        tone: 'danger',
        text: detail.username ? `Konto @${detail.username} im Admin gelöscht` : 'Konto im Admin gelöscht',
      };
    case 'admin.viewed':
      return { icon: '⚙︎', tone: 'admin', text: `App${inApp} im Admin angesehen, nur lesend` };
    case 'plan.requested':
      return { icon: '★', tone: 'neutral', text: `Abo${inApp} angefragt` };
    case 'admin.planApproved':
      return { icon: '⚙︎', tone: 'admin', text: `Abo${inApp} im Admin freigeschaltet` };
    case 'admin.planDeclined':
      return { icon: '⚙︎', tone: 'admin', text: `Abo-Anfrage${inApp} im Admin abgelehnt` };
    default:
      return { icon: '•', tone: 'neutral', text: `Ereignis «${entry.kind ?? 'unbekannt'}»` };
  }
}

function describeAi(detail, inApp) {
  const parts = [
    detail.tier ? tierName(detail.tier) : null,
    detail.model || null,
    isNum(detail.costChf) ? fmtChf(detail.costChf) : null,
  ].filter(Boolean);
  const suffix = parts.length ? ` · ${parts.join(' · ')}` : '';
  if (detail.ok === false) {
    return {
      icon: '✕',
      tone: 'danger',
      text: `KI-Anfrage${inApp} fehlgeschlagen${detail.error ? `: ${detail.error}` : ''}${suffix}`,
    };
  }
  return { icon: '✦', tone: 'neutral', text: `KI-Antwort${inApp}${suffix}` };
}

function groupByDay(entries) {
  const groups = [];
  for (const entry of entries) {
    const date = toDate(entry.at);
    const key = date ? dayKeyOf(date) : 'ohne-datum';
    const last = groups.at(-1);
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, entries: [entry] });
  }
  return groups;
}

function entryItem(entry, { showAccount, accountsById }) {
  const description = describeEntry(entry);
  const date = toDate(entry.at);
  const account = entry.accountId ? accountsById.get(entry.accountId) : null;
  const accountLabel = entry.email || account?.email || entry.accountId;
  return h(
    'li',
    { class: `entry entry--${description.tone}` },
    date
      ? h('time', { class: 'entry__time num', datetime: date.toISOString(), title: fmtDateTime(date), text: fmtTime(date) })
      : h('span', { class: 'entry__time', text: '—' }),
    h('span', { class: 'entry__icon', 'aria-hidden': 'true', text: description.icon }),
    h(
      'div',
      { class: 'entry__body' },
      h('p', { class: 'entry__text', text: description.text }),
      h(
        'p',
        { class: 'entry__meta' },
        showAccount
          ? entry.accountId
            ? h('a', { href: accountHref(entry.accountId), text: accountLabel })
            : h('span', { text: 'ohne Konto' })
          : null,
        h('code', { class: 'entry__kind', text: entry.kind ?? '—' }),
      ),
    ),
  );
}

function activityQuery(filter, before) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (filter.accountId) params.set('accountId', filter.accountId);
  if (filter.kind) params.set('kind', filter.kind);
  if (before) params.set('before', before);
  return `/api/activity?${params.toString()}`;
}

function activityFeed({ filter: initialFilter, initial = null, showAccount = true, headingTag = 'h2', accountsById = new Map() }) {
  let filter = { ...initialFilter };
  let entries = asArray(initial);
  let exhausted = false;
  let loading = false;
  let generation = 0;

  const list = h('ol', { class: 'timeline' });
  const emptyNote = h('p', { class: 'empty-note', text: 'Hier ist noch nichts passiert.', hidden: true });
  const errorSlot = h('div');
  const status = h('p', { class: 'feed__status', tabindex: '-1' });
  const moreButton = h('button', { type: 'button', class: 'btn', text: 'Ältere laden', on: { click: () => load(false) } });
  const root = h(
    'div',
    { class: 'feed' },
    errorSlot,
    list,
    emptyNote,
    h('div', { class: 'feed__foot' }, moreButton, status),
  );

  function summary() {
    if (!entries.length) return '';
    const noun = entries.length === 1 ? 'Eintrag' : 'Einträge';
    return `${fmtInt(entries.length)} ${noun}${exhausted ? ' · das ist alles' : ''}`;
  }

  function draw() {
    const hadFocus = document.activeElement === moreButton;
    list.replaceChildren(
      ...groupByDay(entries).map((group) =>
        h(
          'li',
          { class: 'timeline__day' },
          h(headingTag, { class: 'timeline__date', text: dayHeading(group.key) }),
          h('ol', { class: 'timeline__items' }, group.entries.map((e) => entryItem(e, { showAccount, accountsById }))),
        ),
      ),
    );
    emptyNote.hidden = loading || entries.length > 0 || errorSlot.childElementCount > 0;
    moreButton.hidden = exhausted || entries.length === 0;
    if (hadFocus && moreButton.hidden) status.focus();
  }

  async function load(reset) {
    if (loading) return;
    loading = true;
    const gen = generation;
    moreButton.setAttribute('aria-disabled', 'true');
    status.textContent = 'Lädt …';
    errorSlot.replaceChildren();
    if (reset) {
      entries = [];
      exhausted = false;
      draw();
    }
    try {
      const before = reset ? null : entries.at(-1)?.at;
      const response = await api(activityQuery(filter, before));
      if (gen !== generation) return;
      const batch = asArray(response?.entries);
      entries = reset ? batch : [...entries, ...batch];
      exhausted = batch.length < PAGE_SIZE;
    } catch (err) {
      if (gen !== generation) return;
      reportUnexpected(err);
      errorSlot.replaceChildren(inlineError(err, () => load(reset)));
    } finally {
      if (gen === generation) {
        loading = false;
        moreButton.removeAttribute('aria-disabled');
        status.textContent = summary();
        draw();
      }
    }
  }

  function reload(nextFilter = filter) {
    filter = { ...nextFilter };
    generation += 1;
    loading = false;
    load(true);
  }

  if (initial) {
    status.textContent = summary();
    draw();
  } else {
    load(true);
  }
  return { el: root, reload };
}

// ===========================================================================
// Router
// ===========================================================================

const VIEWS = {
  overview: renderOverview,
  accounts: renderAccounts,
  account: renderAccountDetail,
  activity: renderActivity,
  costs: renderCosts,
  notfound: renderNotFound,
};

let viewToken = 0;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const queryIndex = raw.indexOf('?');
  const path = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const query = new URLSearchParams(queryIndex >= 0 ? raw.slice(queryIndex + 1) : '');
  const segments = path.split('/').filter(Boolean).map(safeDecode);
  const [first, second] = segments;
  if (!first || first === 'overview') return { name: 'overview', query };
  if (first === 'accounts' && second) return { name: 'account', id: second, query };
  if (first === 'accounts') return { name: 'accounts', query };
  if (first === 'activity') return { name: 'activity', query };
  if (first === 'costs') return { name: 'costs', query };
  return { name: 'notfound', query };
}

function markNav(route) {
  const section = route.name === 'account' ? 'accounts' : route.name;
  document.querySelectorAll('.nav__link').forEach((link) => {
    if (link.getAttribute('data-route') === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

async function renderRoute({ moveFocus }) {
  const route = parseRoute();
  const token = (viewToken += 1);
  const main = document.getElementById('main');
  markNav(route);
  main.setAttribute('aria-busy', 'true');
  main.replaceChildren(loadingBlock());
  const ctx = {
    route,
    isCurrent: () => token === viewToken,
    reload: () => renderRoute({ moveFocus: false }),
  };
  let node;
  try {
    node = await VIEWS[route.name](ctx);
  } catch (err) {
    reportUnexpected(err);
    node = errorPage(err, ctx.reload);
  }
  if (!ctx.isCurrent()) return;
  main.replaceChildren(node);
  main.removeAttribute('aria-busy');
  document.title = `${node.getAttribute('data-title') || 'Dashboard'} · Better Admin`;
  if (moveFocus) {
    window.scrollTo(0, 0);
    const heading = main.querySelector('h1');
    (heading ?? main).focus({ preventScroll: true });
  }
}

function boot() {
  const envBadge = document.getElementById('env-badge');
  if (DEMO_MODE && envBadge) {
    envBadge.textContent = DEMO_MODE === 'offline' ? 'Demo: Dienst aus' : 'Demo-Daten, nicht echt';
    envBadge.classList.add('topbar__env--demo');
  }
  document.getElementById('skip-link')?.addEventListener('click', () => {
    const main = document.getElementById('main');
    (main?.querySelector('h1') ?? main)?.focus();
  });
  window.addEventListener('hashchange', () => renderRoute({ moveFocus: true }));
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    history.replaceState(null, '', `${location.pathname}${location.search}#/overview`);
  }
  renderRoute({ moveFocus: false });
}

// ===========================================================================
// 1. Übersicht
// ===========================================================================

async function renderOverview(ctx) {
  const data = await api('/api/overview');
  const accounts = data?.accounts ?? {};
  const ai = data?.ai ?? {};
  const speech = data?.speech ?? {};
  const storage = data?.storage ?? {};
  const apps = [...asArray(data?.apps)].sort(
    (a, b) => indexOfApp(a.id) - indexOfApp(b.id),
  );
  const generated = toDate(data?.generatedAt) ?? new Date();
  const maxDataDay = asArray(ai.byDay)
    .map((row) => row.day)
    .filter((day) => parseDayKey(day))
    .sort()
    .at(-1);
  const endDay = maxDataDay && maxDataDay > dayKeyOf(generated) ? maxDataDay : dayKeyOf(generated);
  const moduleRows = asArray(data?.modules);

  return page(
    {
      title: 'Übersicht',
      subtitle: `Stand ${fmtDateTime(generated)}`,
      actions: [reloadButton(ctx.reload)],
    },
    stats(
      [
        ['Konten', fmtInt(accounts.total)],
        ['Aktiv 7 Tage', fmtInt(accounts.active7)],
        ['Aktiv 30 Tage', fmtInt(accounts.active30)],
        ['Neu diese Woche', fmtInt(accounts.newThisWeek)],
        ['Gesperrt', fmtInt(accounts.disabled), accounts.disabled > 0 ? 'danger' : null],
      ],
      'kpis',
    ),
    // Wer auf ein Abo wartet, steht ganz oben — das ist heute der einzige Weg zum Abo.
    planRequestsUi().requestsCard(data?.planRequests),
    h(
      'section',
      { 'aria-labelledby': 'overview-apps' },
      h('h2', { id: 'overview-apps', class: 'section-title', text: 'Apps' }),
      apps.length
        ? h('div', { class: 'grid grid--apps' }, apps.map(appCard))
        : h('p', { class: 'empty-note', text: 'Der Dienst meldet keine Apps.' }),
    ),
    billingUi().marginCard(data?.margin),
    h(
      'div',
      { class: 'grid grid--2' },
      h('div', { class: 'stack' }, aiCard(ai), speechCard(speech)),
      dailyChartCard({ title: 'KI pro Tag, letzte 30 Tage', byDay: ai.byDay, dayKeys: lastDayKeys(endDay, OVERVIEW_DAYS) }),
    ),
    h(
      'div',
      { class: 'grid grid--main-side' },
      card(
        {
          title: 'Einträge pro Funktion',
          actions: [h('span', { class: 'num', text: `${fmtInt(sumOf(moduleRows, (row) => row.items))} zusammen` })],
        },
        moduleCountsTable(moduleRows, 'Einträge pro Funktion'),
      ),
      card(
        { title: 'Speicher' },
        stats(
          [
            ['Datenbank', fmtBytes(storage.dbBytes)],
            ['Hochgeladene Bilder', fmtBytes(storage.uploadsBytes)],
            [
              'Zusammen',
              isNum(storage.dbBytes) || isNum(storage.uploadsBytes)
                ? fmtBytes((isNum(storage.dbBytes) ? storage.dbBytes : 0) + (isNum(storage.uploadsBytes) ? storage.uploadsBytes : 0))
                : '—',
            ],
          ],
          'stats stats--list',
        ),
      ),
    ),
  );
}

function indexOfApp(id) {
  const index = APPS.findIndex((app) => app.id === id);
  return index < 0 ? APPS.length : index;
}

function appCard(app) {
  const meta = APP_BY_ID.get(app.id);
  return card(
    {
      title: [
        h('span', { class: 'app-code', 'aria-hidden': 'true', text: meta?.short ?? '?' }),
        app.name || appName(app.id),
      ],
      className: 'card--app',
      headingTag: 'h3',
    },
    stats(
      [
        ['Nutzer', fmtInt(app.users)],
        ['Aktiv 7 Tage', fmtInt(app.active7)],
        ['Gesperrt', fmtInt(app.blockedCount), app.blockedCount > 0 ? 'danger' : null],
      ],
      'stats stats--list',
    ),
  );
}

function aiCard(ai) {
  return card(
    { title: 'KI' },
    stats(
      [
        ['Eingerichtet', ai.configured ? pill('✓', 'Ja', 'ok') : pill('✕', 'Nein', 'danger')],
        ['Anfragen 30 Tage', fmtInt(ai.requests30)],
        ['Kosten diesen Monat', fmtChf(ai.costChfMonth)],
        ['Kosten 30 Tage', fmtChf(ai.costChf30)],
        ['Mindestgebühr pro Monat', fmtChf(ai.monthlyMinimumChf)],
      ],
      'stats stats--list',
    ),
    shareMeter(ai.cheapShare30),
  );
}

const PURPOSE_LABELS = { speech: 'Satz', sample: 'Probe' };

function speechCard(speech) {
  const cache = speech.cache ?? {};
  return card(
    { title: 'Stimme (ElevenLabs)' },
    stats(
      [
        ['Eingerichtet', speech.configured ? pill('✓', 'Ja', 'ok') : pill('✕', 'Nein', 'danger')],
        ['Sätze 30 Tage', fmtInt(speech.requests30)],
        ['davon aus dem Zwischenspeicher', fmtInt(speech.cached30)],
        ['Credits 30 Tage', fmtCredits(speech.credits30)],
        ['Gesparte Credits 30 Tage', fmtCredits(speech.savedCredits30)],
        ['Gespeicherte Sätze', isNum(cache.entries) ? `${fmtInt(cache.entries)} · ${fmtBytes(cache.bytes)}` : '—'],
      ],
      'stats stats--list',
    ),
    creditMeter(speech.creditsMonth, speech.monthlyCredits),
  );
}

/** Wie viel vom Monatskontingent schon weg ist. */
function creditMeter(used, limit) {
  const hasValue = isNum(used) && isNum(limit) && limit > 0;
  const share = hasValue ? clamp(used / limit, 0, 1) : null;
  const over = hasValue && used >= limit;
  const labelId = uid('credits');
  const statusText = !hasValue ? 'Kein Kontingent' : over ? '! Aufgebraucht' : `${fmtCredits(limit - used)} übrig`;
  return h(
    'div',
    { class: 'share' },
    h(
      'div',
      { class: 'share__head' },
      h('span', { id: labelId, class: 'share__label', text: 'Credits diesen Monat' }),
      h('span', { class: 'share__value num', text: hasValue ? `${fmtCredits(used)} / ${fmtInt(limit)}` : '—' }),
    ),
    h(
      'div',
      {
        role: 'meter',
        'aria-labelledby': labelId,
        'aria-valuemin': '0',
        'aria-valuemax': hasValue ? String(limit) : '0',
        'aria-valuenow': hasValue ? String(Math.min(used, limit)) : null,
        'aria-valuetext': hasValue ? `${fmtCredits(used)} von ${fmtInt(limit)} Credits` : 'keine Daten',
      },
      svg(
        'svg',
        { class: 'meter', viewBox: '0 0 100 14', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
        svg('rect', { class: 'meter__track', x: '0', y: '3', width: '100', height: '8' }),
        hasValue
          ? svg('rect', {
              class: over ? 'meter__bar meter__bar--over' : 'meter__bar',
              x: '0',
              y: '3',
              width: (share * 100).toFixed(2),
              height: '8',
            })
          : null,
      ),
    ),
    h(
      'div',
      { class: 'share__foot' },
      h('span', { text: 'Kalendermonat in UTC — ElevenLabs zählt ab dem eigenen Abrechnungstag.' }),
      h('span', { class: over ? 'share__status share__status--low' : 'share__status', text: statusText }),
    ),
  );
}

// ===========================================================================
// 2. Konten
// ===========================================================================

let accountsUi = { query: '', status: 'all', sort: { key: 'lastSeenAt', dir: 'desc' } };

const ACCOUNT_COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    sortValue: (a) => displayName(a).replace(/^@/, ''),
    render: (a) => accountNameCell(a),
  },
  { key: 'email', label: 'E-Mail', sortValue: (a) => a.email, render: (a) => a.email || '—' },
  {
    key: 'createdAt',
    label: 'Erstellt',
    type: 'date',
    sortValue: (a) => timeValue(a.createdAt),
    render: (a) => timeEl(a.createdAt, fmtDate),
  },
  {
    key: 'lastSeenAt',
    label: 'Zuletzt aktiv',
    type: 'date',
    sortValue: (a) => timeValue(a.lastSeenAt),
    render: (a) => (a.lastSeenAt ? timeEl(a.lastSeenAt, fmtRelative) : h('span', { class: 'muted', text: 'nie' })),
  },
  { key: 'apps', label: 'Apps', sortable: false, render: (a) => appPills(a) },
  {
    key: 'paidApps',
    label: 'Abo',
    sortValue: (a) => asArray(a.paidApps).length,
    render: (a) => billingUi().paidCell(a),
  },
  { key: 'items', label: 'Einträge', type: 'num', sortValue: (a) => a.items, render: (a) => fmtInt(a.items) },
  {
    key: 'costChfMonth',
    label: 'Kosten Monat',
    type: 'num',
    sortValue: (a) => a.costChfMonth,
    render: (a) => fmtChf(a.costChfMonth),
  },
  {
    key: 'usage',
    label: 'Verbrauch 30 Tage',
    type: 'num',
    sortValue: (a) => a.usage?.last30?.ai?.tokens ?? null,
    render: (a) => usageCell(a.usage?.last30),
  },
  {
    key: 'disabled',
    label: 'Status',
    sortValue: (a) => (a.disabled ? 1 : 0),
    render: (a) => statusPill(a.disabled),
  },
];

/** „12’340 Tokens · 1’230 Credits“ — KI-Tokens und Credits der Stimmen. */
function usageCell(usage) {
  if (!usage) return h('span', { class: 'muted', text: '—' });
  return h('span', {
    class: 'usage-cell',
    title: 'KI-Tokens und Credits von ElevenLabs, letzte 30 Tage',
    text: `${fmtInt(usage.ai?.tokens)} Tokens · ${fmtCredits(usage.speech?.credits)} Credits`,
  });
}

function accountNameCell(account) {
  const first = typeof account.firstName === 'string' ? account.firstName.trim() : '';
  return h(
    'div',
    { class: 'name-cell' },
    h('a', { class: 'name-cell__link', href: accountHref(account.id), text: displayName(account) }),
    first && account.username ? h('span', { class: 'name-cell__user', text: `@${account.username}` }) : null,
  );
}

function filterAccounts(accounts, { query, status }) {
  const needle = query.trim().toLowerCase().replace(/^@/, '');
  return accounts.filter((account) => {
    if (status === 'disabled' && !account.disabled) return false;
    if (status === 'active' && account.disabled) return false;
    if (!needle) return true;
    return [account.firstName, account.username, account.email, account.id].some(
      (value) => typeof value === 'string' && value.toLowerCase().includes(needle),
    );
  });
}

async function renderAccounts(ctx) {
  const data = await api('/api/accounts');
  const accounts = asArray(data?.accounts);
  const table = createTable({
    caption: 'Konten',
    columns: ACCOUNT_COLUMNS,
    sort: accountsUi.sort,
    onSortChange: (sort) => {
      accountsUi = { ...accountsUi, sort };
    },
    rowHref: (account) => accountHref(account.id),
    emptyText: accounts.length ? 'Kein Konto passt zur Suche.' : 'Noch keine Konten.',
  });
  const count = h('p', { class: 'toolbar__count', 'aria-live': 'polite' });
  const searchInput = h('input', {
    id: uid('search'),
    class: 'input',
    type: 'search',
    value: accountsUi.query,
    placeholder: 'Name, @benutzername oder E-Mail',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const statusSelect = h(
    'select',
    { id: uid('status'), class: 'select' },
    h('option', { value: 'all', text: 'Alle' }),
    h('option', { value: 'active', text: 'Aktiv' }),
    h('option', { value: 'disabled', text: 'Gesperrt' }),
  );
  statusSelect.value = accountsUi.status;

  function apply() {
    const filtered = filterAccounts(accounts, accountsUi);
    table.setRows(filtered);
    count.textContent = `${fmtInt(filtered.length)} von ${fmtInt(accounts.length)} Konten`;
  }
  searchInput.addEventListener('input', () => {
    accountsUi = { ...accountsUi, query: searchInput.value };
    apply();
  });
  statusSelect.addEventListener('change', () => {
    accountsUi = { ...accountsUi, status: statusSelect.value };
    apply();
  });
  apply();

  return page(
    { title: 'Konten', subtitle: 'Ein Klick auf eine Zeile öffnet das Konto.', actions: [reloadButton(ctx.reload)] },
    h(
      'div',
      { class: 'toolbar' },
      h('div', { class: 'field field--grow' }, h('label', { class: 'field__label', for: searchInput.id, text: 'Suchen' }), searchInput),
      field('Status', statusSelect),
      count,
    ),
    appLegend(),
    table.el,
  );
}

// ===========================================================================
// 3. Konto-Detail
// ===========================================================================

async function renderAccountDetail(ctx) {
  let data;
  try {
    data = await api(accountPath(ctx.route.id));
  } catch (err) {
    if (err instanceof ApiError && err.code === 'not_found') {
      return errorPage(err, ctx.reload, { href: '#/accounts', label: 'Zur Kontenliste' });
    }
    throw err;
  }
  if (!data?.account || typeof data.account !== 'object') throw new ApiError('bad_response');
  const store = createStore(data.account);
  const counts = asArray(data.counts);

  return h(
    'div',
    { class: 'page', 'data-title': displayName(data.account) },
    accountHeader(store),
    h(
      'div',
      { class: 'grid grid--2' },
      h('div', { class: 'stack' }, profileCard(store), detailsCard(store)),
      // Sperre, Zugang und Abo stehen beieinander: alles, was der Admin am Konto freigibt.
      h('div', { class: 'stack' }, lockCard(store), billingUi().accessCard(store), passwordCard(store), deleteCard(store)),
    ),
    usageCard(data.account.usage),
    card(
      {
        title: 'Einträge pro Funktion',
        actions: [h('span', { class: 'num', text: `${fmtInt(sumOf(counts, (row) => row.items))} zusammen` })],
      },
      moduleCountsTable(counts, 'Einträge pro Funktion'),
    ),
    aiUsageCard(data.ai),
    historyCard(data.account.id ?? ctx.route.id, data.activity),
  );
}

async function patchAccount(store, body) {
  const response = await api(accountPath(store.get().id), { method: 'PATCH', body });
  const next = response?.account && typeof response.account === 'object' ? response.account : {};
  store.set({ ...store.get(), ...next });
  return next;
}

function accountHeader(store) {
  const title = h('h1', { class: 'page__title', tabindex: '-1' });
  const statusSlot = h('span');
  const email = h('span');
  const username = h('span');
  const id = store.get().id ?? '';

  function draw(account) {
    title.textContent = displayName(account);
    statusSlot.replaceChildren(statusPill(account.disabled));
    email.textContent = account.email ?? '';
    email.hidden = !account.email;
    username.textContent = account.username ? `@${account.username}` : '';
    username.hidden = !account.username;
  }
  draw(store.get());
  store.subscribe(draw);

  return h(
    'header',
    { class: 'account-head' },
    h('a', { class: 'back', href: '#/accounts' }, h('span', { 'aria-hidden': 'true', text: '‹ ' }), 'Konten'),
    h('div', { class: 'account-head__row' }, title, statusSlot, billingUi().viewButton(store)),
    h(
      'div',
      { class: 'account-head__meta' },
      email,
      username,
      h(
        'span',
        { class: 'id-chip' },
        h('span', { class: 'sr-only', text: 'Id:' }),
        h('code', { text: id }),
        h('button', {
          type: 'button',
          class: 'btn btn--small',
          text: 'Id kopieren',
          on: {
            click: async () => {
              const copied = await copyText(id);
              toast(copied ? 'Id kopiert.' : 'Kopieren ging nicht. Markiere die Id von Hand.', copied ? 'ok' : 'error');
            },
          },
        }),
      ),
    ),
  );
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fällt auf den alten Weg zurück.
  }
  const previous = document.activeElement;
  const area = h('textarea', { class: 'offscreen', readonly: true, 'aria-hidden': 'true', tabindex: '-1' });
  area.value = text;
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  if (previous instanceof HTMLElement) previous.focus();
  return copied;
}

function usernameProblem(value) {
  if (!value) return 'Der Benutzername fehlt.';
  if (value.length < 3) return 'Mindestens 3 Zeichen.';
  if (value.length > 24) return 'Höchstens 24 Zeichen.';
  if (/[A-Z]/.test(value)) return 'Nur Kleinbuchstaben.';
  if (!/^[a-z0-9]/.test(value)) return 'Am Anfang steht ein Buchstabe oder eine Ziffer.';
  return 'Erlaubt sind nur a–z, 0–9, Punkt, Strich und Unterstrich.';
}

function profileCard(store) {
  const ids = { name: uid('f'), user: uid('f'), hint: uid('f'), error: uid('f'), lang: uid('f') };
  const nameInput = h('input', { id: ids.name, class: 'input', type: 'text', autocomplete: 'off', maxlength: '80' });
  const userInput = h('input', {
    id: ids.user,
    class: 'input',
    type: 'text',
    autocomplete: 'off',
    autocapitalize: 'none',
    spellcheck: 'false',
    'aria-describedby': `${ids.hint} ${ids.error}`,
  });
  const userHint = h('p', {
    id: ids.hint,
    class: 'field__hint',
    text: '3–24 Zeichen, klein geschrieben: a–z, 0–9, Punkt, Strich, Unterstrich. Am Anfang ein Buchstabe oder eine Ziffer.',
  });
  const userError = h('p', { id: ids.error, class: 'field__error', hidden: true });
  const langSelect = h(
    'select',
    { id: ids.lang, class: 'select' },
    LANGUAGES.map(([value, label]) => h('option', { value, text: label })),
  );
  const saveButton = h('button', { type: 'submit', class: 'btn btn--primary', text: 'Speichern' });
  const dirtyNote = h('span', { class: 'form__note' });
  let touched = false;
  let pending = false;
  let serverError = '';

  function fill(account) {
    nameInput.value = account.firstName ?? '';
    userInput.value = account.username ?? '';
    const language = account.language ?? 'de';
    if (![...langSelect.options].some((option) => option.value === language)) {
      langSelect.append(h('option', { value: language, text: language }));
    }
    langSelect.value = language;
  }

  function changes() {
    const account = store.get();
    const result = {};
    const firstName = nameInput.value.trim();
    if (firstName !== (account.firstName ?? '')) result.firstName = firstName;
    const username = userInput.value.trim();
    if (username !== (account.username ?? '')) result.username = username;
    if (langSelect.value !== (account.language ?? 'de')) result.language = langSelect.value;
    return result;
  }

  function sync() {
    const diff = changes();
    const username = userInput.value.trim();
    const invalid = 'username' in diff && !USERNAME_RE.test(username);
    const showInvalid = invalid && (touched || username.length >= 3);
    setFieldError(userInput, userError, serverError || (showInvalid ? usernameProblem(username) : ''));
    const dirty = Object.keys(diff).length > 0;
    dirtyNote.textContent = dirty ? 'Ungespeicherte Änderungen' : '';
    saveButton.setAttribute('aria-disabled', String(pending || !dirty));
  }

  nameInput.addEventListener('input', sync);
  langSelect.addEventListener('change', sync);
  userInput.addEventListener('input', () => {
    serverError = '';
    sync();
  });
  userInput.addEventListener('blur', () => {
    touched = true;
    sync();
  });

  const form = h(
    'form',
    { class: 'form', novalidate: true },
    field('Spitzname', nameInput),
    field('Benutzername', userInput, userHint, userError),
    field('Sprache', langSelect),
    h('div', { class: 'form__actions' }, saveButton, dirtyNote),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) return;
    const diff = changes();
    if (!Object.keys(diff).length) {
      toast('Nichts geändert.');
      return;
    }
    if ('username' in diff && !USERNAME_RE.test(diff.username)) {
      touched = true;
      sync();
      userInput.focus();
      return;
    }
    pending = true;
    setBusy(saveButton, true, 'Speichert …', 'Speichern');
    try {
      await patchAccount(store, diff);
      fill(store.get());
      toast('Profil gespeichert.');
    } catch (err) {
      reportUnexpected(err);
      if (err instanceof ApiError && (err.code === 'username_taken' || err.code === 'username_invalid')) {
        serverError = ERROR_TEXT[err.code];
        userInput.focus();
      }
      toast(errorContent(err), 'error');
    } finally {
      pending = false;
      setBusy(saveButton, false, 'Speichert …', 'Speichern');
      sync();
    }
  });

  fill(store.get());
  sync();
  return card({ title: 'Profil' }, form);
}

function detailsCard(store) {
  const slot = h('div');
  function draw(account) {
    const look = [account.themeMode, account.themePreset, account.accentKey].filter(Boolean).join(' · ');
    slot.replaceChildren(
      stats(
        [
          ['Erstellt', fmtDateTime(account.createdAt)],
          ['Zuletzt aktiv', account.lastSeenAt ? fmtRelative(account.lastSeenAt) : 'nie'],
          ['Sprache', languageName(account.language)],
          ['Einrichtung', account.onboarded ? 'abgeschlossen' : 'offen'],
          ['Haushalt', account.householdId ? h('code', { text: account.householdId }) : 'keiner'],
          ['Aussehen', look || '—'],
          ['Name des Assistenten', account.assistantName || '—'],
          ['Kosten diesen Monat', fmtChf(account.costChfMonth)],
        ],
        'stats stats--list',
      ),
    );
  }
  draw(store.get());
  store.subscribe(draw);
  return card({ title: 'Details' }, slot);
}

function lockCard(store) {
  let pending = false;
  const labelId = uid('lock');
  const toggleSwitch = createSwitch({
    labelledBy: labelId,
    onText: 'gesperrt',
    offText: 'nicht gesperrt',
    dangerWhen: 'on',
    onToggle: () => toggle(),
  });
  const draw = (account) => toggleSwitch.update({ checked: Boolean(account.disabled), busy: pending });

  async function toggle() {
    if (pending) return;
    const account = store.get();
    const disable = !account.disabled;
    if (disable) {
      const confirmed = await confirmDialog({
        title: 'Konto sperren?',
        body:
          `${displayName(account)} kann sich danach in keiner Better-App mehr anmelden. ` +
          'Die Daten bleiben erhalten, und du kannst die Sperre jederzeit wieder aufheben.',
        confirmLabel: 'Konto sperren',
        tone: 'danger',
      });
      if (!confirmed) return;
    }
    pending = true;
    draw(store.get());
    try {
      const saved = await patchAccount(store, { disabled: disable });
      if (typeof saved.disabled !== 'boolean') store.set({ ...store.get(), disabled: disable });
      toast(disable ? 'Konto gesperrt.' : 'Sperre aufgehoben.');
    } catch (err) {
      reportUnexpected(err);
      toast(errorContent(err), 'error');
    } finally {
      pending = false;
      draw(store.get());
    }
  }

  draw(store.get());
  store.subscribe(draw);
  return card(
    { title: 'Konto sperren', note: 'Ein gesperrtes Konto kann sich nicht mehr anmelden. Die Daten bleiben erhalten.' },
    h(
      'div',
      { class: 'toggle-row' },
      h('div', { class: 'toggle-row__text' }, h('span', { id: labelId, class: 'toggle-row__title', text: 'Konto gesperrt' })),
      toggleSwitch.el,
    ),
  );
}

function passwordCard(store) {
  const ids = { first: uid('pw'), second: uid('pw'), firstError: uid('pw'), secondError: uid('pw') };
  const passwordInput = (id, errorId) =>
    h('input', {
      id,
      class: 'input',
      type: 'password',
      autocomplete: 'new-password',
      spellcheck: 'false',
      autocapitalize: 'none',
      'aria-describedby': errorId,
    });
  const first = passwordInput(ids.first, ids.firstError);
  const second = passwordInput(ids.second, ids.secondError);
  const firstError = h('p', { id: ids.firstError, class: 'field__error', hidden: true });
  const secondError = h('p', { id: ids.secondError, class: 'field__error', hidden: true });
  const submitButton = h('button', { type: 'submit', class: 'btn', text: 'Passwort setzen' });
  let touched = { first: false, second: false };
  let attempted = false;
  let pending = false;

  function validate() {
    const tooShort = first.value.length < PASSWORD_MIN;
    const mismatch = second.value !== first.value;
    const showFirst = attempted || touched.first;
    const showSecond = attempted || touched.second;
    setFieldError(first, firstError, showFirst && tooShort ? `Mindestens ${PASSWORD_MIN} Zeichen.` : '');
    setFieldError(second, secondError, showSecond && !tooShort && mismatch ? 'Die beiden Passwörter stimmen nicht überein.' : '');
    return { tooShort, mismatch };
  }

  first.addEventListener('input', validate);
  second.addEventListener('input', validate);
  first.addEventListener('blur', () => {
    touched = { ...touched, first: first.value.length > 0 || touched.first };
    validate();
  });
  second.addEventListener('blur', () => {
    touched = { ...touched, second: second.value.length > 0 || touched.second };
    validate();
  });

  function clearForm() {
    first.value = '';
    second.value = '';
    touched = { first: false, second: false };
    attempted = false;
    validate();
  }

  const form = h(
    'form',
    { class: 'form', novalidate: true },
    field('Neues Passwort', first, firstError),
    field('Passwort wiederholen', second, secondError),
    h('div', { class: 'form__actions' }, submitButton),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) return;
    attempted = true;
    const { tooShort, mismatch } = validate();
    if (tooShort) {
      first.focus();
      return;
    }
    if (mismatch) {
      second.focus();
      return;
    }
    const confirmed = await confirmDialog({
      title: 'Passwort neu setzen?',
      body:
        `Für ${displayName(store.get())} gilt danach nur noch das neue Passwort. ` +
        'Gib es der Person auf einem sicheren Weg weiter.',
      confirmLabel: 'Passwort setzen',
      tone: 'primary',
    });
    if (!confirmed) return;
    pending = true;
    setBusy(submitButton, true, 'Wird gesetzt …', 'Passwort setzen');
    try {
      await api(`${accountPath(store.get().id)}/password`, { method: 'POST', body: { password: first.value } });
      clearForm();
      toast('Passwort gesetzt.');
    } catch (err) {
      reportUnexpected(err);
      if (err instanceof ApiError && err.code === 'password_too_short') {
        setFieldError(first, firstError, ERROR_TEXT.password_too_short);
        first.focus();
      }
      toast(errorContent(err), 'error');
    } finally {
      pending = false;
      setBusy(submitButton, false, 'Wird gesetzt …', 'Passwort setzen');
    }
  });

  return card(
    { title: 'Passwort setzen', note: `Mindestens ${PASSWORD_MIN} Zeichen. Das Passwort wird nirgends angezeigt oder gespeichert.` },
    form,
  );
}

function deleteCard(store) {
  const button = h('button', { type: 'button', class: 'btn btn--danger', text: 'Konto löschen…' });

  button.addEventListener('click', async () => {
    const account = store.get();
    const email = account.email ?? '';
    const deleted = await typedConfirmDialog({
      title: 'Konto endgültig löschen?',
      body: [
        `${displayName(account)} verliert alle privaten Einträge, eigenen Kalender, Postfächer und Bilder. ` +
          'Was mit dem Haushalt geteilt ist, bleibt dort. Zum Bestätigen die E-Mail des Kontos eintippen: ',
        h('strong', { text: email || '—' }),
      ],
      expected: email,
      inputLabel: 'E-Mail des Kontos',
      confirmLabel: 'Endgültig löschen',
      busyLabel: 'Wird gelöscht …',
      onConfirm: (typed) => api(accountPath(account.id), { method: 'DELETE', body: { confirm: typed } }),
    });
    if (!deleted) return;
    toast('Konto gelöscht.');
    location.hash = '#/accounts';
  });

  return card(
    {
      title: 'Konto löschen',
      className: 'card--danger',
      note: [
        'Löscht das Konto mit allen privaten Einträgen, Kalendern, Postfächern und Bildern. ',
        'Was mit dem Haushalt geteilt ist, bleibt dort. Eine Sicherung landet in ',
        h('code', { text: 'services/api/data/deleted-accounts' }),
        '.',
      ],
    },
    h('div', { class: 'form__actions' }, button),
  );
}

const USAGE_ROWS = [
  { group: 'KI (Safe Swiss Cloud)' },
  { label: 'Anfragen', pick: (u) => u.ai?.requests, format: fmtInt },
  { label: 'Tokens Eingabe', pick: (u) => u.ai?.promptTokens, format: fmtInt },
  { label: 'Tokens Ausgabe', pick: (u) => u.ai?.completionTokens, format: fmtInt },
  { label: 'Tokens zusammen', pick: (u) => u.ai?.tokens, format: fmtInt, strong: true },
  { label: 'Kosten', pick: (u) => u.ai?.costChf, format: fmtChf },
  { group: 'Stimme (ElevenLabs)' },
  { label: 'Gesprochene Sätze', pick: (u) => u.speech?.requests, format: fmtInt },
  { label: 'davon aus dem Zwischenspeicher', pick: (u) => u.speech?.cached, format: fmtInt },
  { label: 'Erzeugte Zeichen', pick: (u) => u.speech?.characters, format: fmtInt },
  { label: 'Credits', pick: (u) => u.speech?.credits, format: fmtCredits, strong: true },
  { label: 'davon Proben', pick: (u) => u.speech?.sampleCredits, format: fmtCredits },
  { label: 'Gesparte Credits', pick: (u) => u.speech?.savedCredits, format: fmtCredits },
];

/** Tokens der KI und Credits der Stimmen: letzte 30 Tage und gesamt. */
function usageCard(usage) {
  const windows = [
    ['Letzte 30 Tage', usage?.last30 ?? {}],
    ['Gesamt', usage?.total ?? {}],
  ];
  const table = h(
    'table',
    { class: 'table usage-table' },
    h(
      'thead',
      null,
      h('tr', null, h('th', { scope: 'col', text: 'Was' }), windows.map(([label]) => h('th', { scope: 'col', class: 'num', text: label }))),
    ),
    h(
      'tbody',
      null,
      USAGE_ROWS.map((row) =>
        row.group
          ? h('tr', { class: 'group-row' }, h('th', { scope: 'rowgroup', colspan: String(windows.length + 1), text: row.group }))
          : h(
              'tr',
              null,
              h('th', { scope: 'row', class: 'usage-table__label', text: row.label }),
              windows.map(([, values]) =>
                h('td', { class: row.strong ? 'num usage-table__strong' : 'num', text: row.format(row.pick(values)) }),
              ),
            ),
      ),
    ),
  );
  return card(
    {
      title: 'Verbrauch',
      note: 'Tokens der KI und Credits von ElevenLabs. Ein Satz aus dem Zwischenspeicher kostet nichts.',
    },
    h('div', { class: 'table-wrap', role: 'region', 'aria-label': 'Verbrauch', tabindex: '0' }, table),
  );
}

const AI_RECENT_COLUMNS = [
  { key: 'at', label: 'Zeit', type: 'date', sortValue: (r) => timeValue(r.at), render: (r) => timeEl(r.at, fmtDateTime) },
  { key: 'app', label: 'App', sortValue: (r) => appName(r.app), render: (r) => appName(r.app) },
  { key: 'tier', label: 'Stufe', sortValue: (r) => tierName(r.tier), render: (r) => tierName(r.tier) },
  { key: 'model', label: 'Modell', sortValue: (r) => r.model, render: (r) => (r.model ? h('code', { text: r.model }) : '—') },
  { key: 'intent', label: 'Absicht', sortValue: (r) => r.intent, render: (r) => r.intent || '—' },
  {
    key: 'voice',
    label: 'Stimme',
    sortValue: (r) => (typeof r.voice === 'string' ? r.voice : r.voice ? 'ja' : ''),
    render: (r) => (typeof r.voice === 'string' && r.voice ? r.voice : r.voice === true ? 'ja' : '—'),
  },
  {
    key: 'ok',
    label: 'Ergebnis',
    sortValue: (r) => (r.ok ? 1 : 0),
    render: (r) =>
      r.ok
        ? pill('✓', 'ok', 'ok')
        : h('span', null, pill('✕', 'Fehler', 'danger'), r.error ? h('span', { class: 'cell-sub', text: ` ${r.error}` }) : null),
  },
  {
    key: 'tokens',
    label: 'Tokens ein / aus',
    type: 'num',
    sortValue: (r) => (r.promptTokens ?? 0) + (r.completionTokens ?? 0),
    render: (r) => `${fmtInt(r.promptTokens)} / ${fmtInt(r.completionTokens)}`,
  },
  { key: 'costChf', label: 'Kosten', type: 'num', sortValue: (r) => r.costChf, render: (r) => fmtChf(r.costChf) },
  { key: 'durationMs', label: 'Dauer', type: 'num', sortValue: (r) => r.durationMs, render: (r) => fmtDuration(r.durationMs) },
];

function aiUsageCard(ai) {
  const totals = ai?.totals ?? {};
  const byApp = createTable({
    caption: 'KI-Nutzung pro App',
    columns: [
      { key: 'app', label: 'App', sortValue: (r) => appName(r.app), render: (r) => appName(r.app) },
      { key: 'requests', label: 'Anfragen', type: 'num', sortValue: (r) => r.requests, render: (r) => fmtInt(r.requests) },
      { key: 'costChf', label: 'Kosten', type: 'num', sortValue: (r) => r.costChf, render: (r) => fmtChf(r.costChf) },
    ],
    sort: { key: 'costChf', dir: 'desc' },
    emptyText: 'Noch keine KI-Anfragen.',
  });
  byApp.setRows(ai?.byApp);
  const recent = createTable({
    caption: 'Letzte KI-Anfragen',
    columns: AI_RECENT_COLUMNS,
    sort: { key: 'at', dir: 'desc' },
    emptyText: 'Noch keine KI-Anfragen.',
  });
  recent.setRows(ai?.recent);
  return card(
    { title: 'KI-Nutzung' },
    stats([
      ['Anfragen', fmtInt(totals.requests)],
      ['Kosten', fmtChf(totals.costChf)],
      ['Tokens Eingabe', fmtInt(totals.promptTokens)],
      ['Tokens Ausgabe', fmtInt(totals.completionTokens)],
    ]),
    h('h3', { class: 'subhead', text: 'Pro App' }),
    byApp.el,
    h('h3', { class: 'subhead', text: 'Letzte Anfragen' }),
    recent.el,
  );
}

function historyCard(accountId, initial) {
  const feed = activityFeed({
    filter: { accountId, kind: '' },
    initial: Array.isArray(initial) ? initial : null,
    showAccount: false,
    headingTag: 'h3',
  });
  return card(
    {
      title: 'Verlauf',
      actions: [
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Neu laden', on: { click: () => feed.reload() } }),
        h('a', { class: 'btn btn--ghost btn--small', href: activityHref({ accountId }), text: 'Im ganzen Verlauf öffnen' }),
      ],
    },
    feed.el,
  );
}

// ===========================================================================
// 4. Verlauf
// ===========================================================================

async function renderActivity(ctx) {
  let accounts = [];
  let accountsFailed = null;
  try {
    accounts = asArray((await api('/api/accounts'))?.accounts);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'offline') throw err;
    reportUnexpected(err);
    accountsFailed = err;
  }
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const filter = {
    accountId: ctx.route.query.get('accountId') ?? '',
    kind: ctx.route.query.get('kind') ?? '',
  };

  const sortedAccounts = [...accounts].sort((a, b) => collator.compare(displayName(a), displayName(b)));
  const accountSelect = h(
    'select',
    { id: uid('filter'), class: 'select' },
    h('option', { value: '', text: 'Alle Konten' }),
    sortedAccounts.map((account) =>
      h('option', {
        value: account.id,
        text: account.email && displayName(account) !== account.email ? `${displayName(account)} — ${account.email}` : displayName(account),
      }),
    ),
  );
  if (filter.accountId && !accountsById.has(filter.accountId)) {
    accountSelect.append(h('option', { value: filter.accountId, text: filter.accountId }));
  }
  accountSelect.value = filter.accountId;

  const kindSelect = h(
    'select',
    { id: uid('filter'), class: 'select' },
    h('option', { value: '', text: 'Alle Arten' }),
    Object.entries(KIND_LABELS).map(([value, label]) => h('option', { value, text: label })),
  );
  if (filter.kind && !(filter.kind in KIND_LABELS)) kindSelect.append(h('option', { value: filter.kind, text: filter.kind }));
  kindSelect.value = filter.kind;

  const feed = activityFeed({ filter, showAccount: true, headingTag: 'h2', accountsById });
  const resetButton = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Filter zurücksetzen' });

  function currentFilter() {
    return { accountId: accountSelect.value, kind: kindSelect.value };
  }
  function apply() {
    const next = currentFilter();
    history.replaceState(null, '', `${location.pathname}${location.search}${activityHref(next)}`);
    resetButton.hidden = !next.accountId && !next.kind;
    feed.reload(next);
  }
  accountSelect.addEventListener('change', apply);
  kindSelect.addEventListener('change', apply);
  resetButton.addEventListener('click', () => {
    accountSelect.value = '';
    kindSelect.value = '';
    apply();
    accountSelect.focus();
  });
  resetButton.hidden = !filter.accountId && !filter.kind;

  return page(
    {
      title: 'Verlauf',
      subtitle: 'Was in den Konten passiert ist, das Neueste zuerst.',
      actions: [reloadButton(() => feed.reload(currentFilter()))],
    },
    h('div', { class: 'toolbar' }, field('Konto', accountSelect), field('Art', kindSelect), resetButton),
    accountsFailed
      ? h('p', { class: 'note' }, 'Die Kontenliste fehlt gerade, darum geht der Filter nach Konto nicht. ', errorContent(accountsFailed))
      : null,
    feed.el,
  );
}

// ===========================================================================
// 5. Kosten
// ===========================================================================

const costsPath = (month) => `/api/costs?month=${encodeURIComponent(month)}`;

async function renderCosts(ctx) {
  const months = recentMonthKeys(COST_MONTHS);
  const requested = ctx.route.query.get('month');
  const initialMonth = requested && MONTH_RE.test(requested) ? requested : months[0];
  const options = months.includes(initialMonth) ? months : [initialMonth, ...months];
  const select = h(
    'select',
    { id: uid('month'), class: 'select' },
    options.map((month) => h('option', { value: month, text: monthLabel(month) })),
  );
  select.value = initialMonth;

  const first = await api(costsPath(initialMonth));
  const body = h('div', { class: 'costs-body' }, costsContent(first, initialMonth));
  let generation = 0;

  async function loadMonth() {
    const month = select.value;
    history.replaceState(null, '', `${location.pathname}${location.search}#/costs?month=${month}`);
    const gen = (generation += 1);
    body.setAttribute('aria-busy', 'true');
    try {
      const data = await api(costsPath(month));
      if (gen !== generation) return;
      body.replaceChildren(costsContent(data, month));
    } catch (err) {
      if (gen !== generation) return;
      reportUnexpected(err);
      body.replaceChildren(inlineError(err, loadMonth));
    } finally {
      if (gen === generation) body.removeAttribute('aria-busy');
    }
  }
  select.addEventListener('change', loadMonth);

  return page(
    {
      title: 'Kosten',
      subtitle: 'Pro Monat: die KI in Franken, die Stimmen in Credits.',
      actions: [field('Monat', select), reloadButton(ctx.reload)],
    },
    body,
  );
}

function costsContent(data, requestedMonth) {
  const month = typeof data?.month === 'string' && MONTH_RE.test(data.month) ? data.month : requestedMonth;
  const total = data?.totalChf;
  const minimum = data?.monthlyMinimumChf;
  const coverage = isNum(total) && isNum(minimum) && minimum > 0 ? total / minimum : null;
  const tierRows = asArray(data?.byTier);
  const tierRequests = sumOf(tierRows, (row) => row.requests);

  const appTable = createTable({
    caption: 'Kosten pro App',
    columns: [
      { key: 'app', label: 'App', sortValue: (r) => appName(r.app), render: (r) => appName(r.app) },
      { key: 'requests', label: 'Anfragen', type: 'num', sortValue: (r) => r.requests, render: (r) => fmtInt(r.requests) },
      { key: 'promptTokens', label: 'Tokens ein', type: 'num', sortValue: (r) => r.promptTokens, render: (r) => fmtInt(r.promptTokens) },
      {
        key: 'completionTokens',
        label: 'Tokens aus',
        type: 'num',
        sortValue: (r) => r.completionTokens,
        render: (r) => fmtInt(r.completionTokens),
      },
      { key: 'costChf', label: 'Kosten', type: 'num', sortValue: (r) => r.costChf, render: (r) => fmtChf(r.costChf) },
    ],
    sort: { key: 'costChf', dir: 'desc' },
    emptyText: 'In diesem Monat keine Anfragen.',
  });
  appTable.setRows(data?.byApp);

  const tierTable = createTable({
    caption: 'Kosten pro Stufe',
    columns: [
      { key: 'tier', label: 'Stufe', sortValue: (r) => tierName(r.tier), render: (r) => tierCell(r.tier) },
      { key: 'requests', label: 'Anfragen', type: 'num', sortValue: (r) => r.requests, render: (r) => fmtInt(r.requests) },
      {
        key: 'share',
        label: 'Anteil',
        type: 'num',
        sortValue: (r) => (tierRequests > 0 && isNum(r.requests) ? r.requests / tierRequests : null),
        render: (r) => (tierRequests > 0 && isNum(r.requests) ? fmtPct(r.requests / tierRequests) : '—'),
      },
      { key: 'costChf', label: 'Kosten', type: 'num', sortValue: (r) => r.costChf, render: (r) => fmtChf(r.costChf) },
    ],
    sort: { key: 'requests', dir: 'desc' },
    emptyText: 'In diesem Monat keine Anfragen.',
  });
  tierTable.setRows(tierRows);

  const accountTable = createTable({
    caption: 'Kosten pro Konto',
    columns: [
      {
        key: 'account',
        label: 'Konto',
        sortValue: (r) => r.username || r.email || r.accountId,
        render: (r) =>
          r.accountId
            ? h('a', { href: accountHref(r.accountId), text: r.username ? `@${r.username}` : r.email || r.accountId })
            : '—',
      },
      { key: 'email', label: 'E-Mail', sortValue: (r) => r.email, render: (r) => r.email || '—' },
      { key: 'requests', label: 'Anfragen', type: 'num', sortValue: (r) => r.requests, render: (r) => fmtInt(r.requests) },
      { key: 'costChf', label: 'Kosten', type: 'num', sortValue: (r) => r.costChf, render: (r) => fmtChf(r.costChf) },
    ],
    sort: { key: 'costChf', dir: 'desc' },
    rowHref: (r) => (r.accountId ? accountHref(r.accountId) : location.hash),
    emptyText: 'In diesem Monat keine Anfragen.',
  });
  accountTable.setRows(data?.byAccount);

  const priceTable = createTable({
    caption: 'Preise',
    columns: [
      { key: 'model', label: 'Modell', sortValue: (r) => r.model, render: (r) => (r.model ? h('code', { text: r.model }) : '—') },
      { key: 'inputChf', label: 'Eingabe', type: 'num', sortValue: (r) => r.inputChf, render: (r) => fmtPrice(r.inputChf) },
      { key: 'outputChf', label: 'Ausgabe', type: 'num', sortValue: (r) => r.outputChf, render: (r) => fmtPrice(r.outputChf) },
    ],
    sort: { key: 'model', dir: 'asc' },
    emptyText: 'Der Dienst meldet keine Preise.',
  });
  priceTable.setRows(data?.prices);

  return h(
    'div',
    { class: 'page' },
    stats(
      [
        ['Verbrauch', fmtChf(total)],
        ['Mindestgebühr', fmtChf(minimum)],
        ['Zu zahlen', fmtChf(data?.billableChf), 'strong'],
      ],
      'kpis',
    ),
    h(
      'p',
      { class: 'note' },
      'Safe Swiss Cloud verrechnet jeden Monat mindestens die Mindestgebühr: Liegt der Verbrauch darunter, ' +
        'zahlst du die Mindestgebühr, sonst den Verbrauch.',
      coverage !== null ? ` Im ${monthLabel(month)} deckt der Verbrauch ${fmtPct(coverage)} davon.` : '',
    ),
    billingUi().marginCard(data?.margin, { title: `Marge im ${monthLabel(month)}` }),
    h(
      'div',
      { class: 'grid grid--2' },
      card({ title: 'Pro App' }, appTable.el),
      card({ title: 'Pro Stufe' }, tierTable.el),
    ),
    card({ title: 'Pro Konto' }, accountTable.el),
    speechCostsCard(data?.speech),
    speechCacheCard(data?.speech?.cache),
    dailyChartCard({ title: `Pro Tag im ${monthLabel(month)}`, byDay: data?.byDay, dayKeys: monthDayKeys(month), metric: 'costChf' }),
    card({ title: 'Preise', note: 'Franken pro 1 Mio. Tokens, so wie der Dienst sie rechnet.' }, priceTable.el),
  );
}

const SPEECH_COLUMNS = [
  { key: 'requests', label: 'Sätze', type: 'num', sortValue: (r) => r.requests, render: (r) => fmtInt(r.requests) },
  { key: 'cached', label: 'aus Speicher', type: 'num', sortValue: (r) => r.cached, render: (r) => fmtInt(r.cached) },
  { key: 'characters', label: 'Zeichen', type: 'num', sortValue: (r) => r.characters, render: (r) => fmtInt(r.characters) },
  { key: 'credits', label: 'Credits', type: 'num', sortValue: (r) => r.credits, render: (r) => fmtCredits(r.credits) },
  {
    key: 'sampleCredits',
    label: 'davon Proben',
    type: 'num',
    sortValue: (r) => r.sampleCredits,
    render: (r) => fmtCredits(r.sampleCredits),
  },
];

function speechCostsCard(speech) {
  if (!speech || typeof speech !== 'object') return null;
  const accountTable = createTable({
    caption: 'Stimme pro Konto',
    columns: [
      {
        key: 'account',
        label: 'Konto',
        sortValue: (r) => r.username || r.email || r.accountId,
        render: (r) =>
          r.accountId
            ? h('a', { href: accountHref(r.accountId), text: r.username ? `@${r.username}` : r.email || r.accountId })
            : h('span', { class: 'muted', text: 'ohne Anmeldung' }),
      },
      ...SPEECH_COLUMNS,
    ],
    sort: { key: 'credits', dir: 'desc' },
    rowHref: (r) => (r.accountId ? accountHref(r.accountId) : location.hash),
    emptyText: 'In diesem Monat keine Sätze.',
  });
  accountTable.setRows(speech.byAccount);
  const appTable = createTable({
    caption: 'Stimme pro App',
    columns: [{ key: 'app', label: 'App', sortValue: (r) => appName(r.app), render: (r) => appName(r.app) }, ...SPEECH_COLUMNS],
    sort: { key: 'credits', dir: 'desc' },
    emptyText: 'In diesem Monat keine Sätze.',
  });
  appTable.setRows(asArray(speech.byApp).filter((row) => row.requests > 0));
  const limit = speech.monthlyCredits;
  return card(
    {
      title: 'Stimme (ElevenLabs)',
      note: 'ElevenLabs rechnet in Credits pro Zeichen. Ein Satz aus dem Zwischenspeicher kostet nichts, eine Probe entsteht je Stimme nur einmal.',
    },
    stats([
      ['Credits', isNum(limit) && limit > 0 ? `${fmtCredits(speech.credits)} / ${fmtInt(limit)}` : fmtCredits(speech.credits)],
      ['Erzeugte Zeichen', fmtInt(speech.characters)],
      ['Sätze', fmtInt(speech.requests)],
      ['aus dem Zwischenspeicher', fmtInt(speech.cached)],
      ['Gesparte Credits', fmtCredits(speech.savedCredits)],
      ['davon Proben', fmtCredits(speech.sampleCredits)],
    ]),
    h('h3', { class: 'subhead', text: 'Pro Konto' }),
    accountTable.el,
    h('h3', { class: 'subhead', text: 'Pro App' }),
    appTable.el,
  );
}

/** Der Zwischenspeicher: Zahlen und die zehn meistgespielten — nie der Wortlaut. */
function speechCacheCard(cache) {
  if (!cache || typeof cache !== 'object') return null;
  const top = createTable({
    caption: 'Die zehn meistgespielten Sätze',
    columns: [
      { key: 'rank', label: 'Platz', type: 'num', sortValue: (r) => r.rank, render: (r) => fmtInt(r.rank) },
      {
        key: 'purpose',
        label: 'Art',
        sortValue: (r) => PURPOSE_LABELS[r.purpose] ?? '',
        render: (r) => PURPOSE_LABELS[r.purpose] ?? '—',
      },
      { key: 'characters', label: 'Zeichen', type: 'num', sortValue: (r) => r.characters, render: (r) => fmtInt(r.characters) },
      { key: 'hits', label: 'Aus dem Speicher', type: 'num', sortValue: (r) => r.hits, render: (r) => fmtInt(r.hits) },
      { key: 'bytes', label: 'Grösse', type: 'num', sortValue: (r) => r.bytes, render: (r) => fmtBytes(r.bytes) },
      {
        key: 'lastPlayedAt',
        label: 'Zuletzt',
        type: 'date',
        sortValue: (r) => timeValue(r.lastPlayedAt),
        render: (r) => timeEl(r.lastPlayedAt, fmtRelative),
      },
    ],
    sort: { key: 'rank', dir: 'asc' },
    emptyText: 'Noch kam kein Satz aus dem Zwischenspeicher.',
  });
  top.setRows(asArray(cache.top).map((row, index) => ({ ...row, rank: index + 1 })));
  return card(
    {
      title: 'Zwischenspeicher der Stimmen',
      note: 'Oft gesagte Sätze bleiben am längsten, Proben immer. Der Wortlaut steht hier bewusst nicht — nur Länge und wie oft.',
    },
    stats([
      ['Gespeicherte Sätze', isNum(cache.maxFiles) ? `${fmtInt(cache.entries)} von ${fmtInt(cache.maxFiles)}` : fmtInt(cache.entries)],
      ['Grösse', isNum(cache.maxBytes) ? `${fmtBytes(cache.bytes)} von ${fmtBytes(cache.maxBytes)}` : fmtBytes(cache.bytes)],
      ['Proben', fmtInt(cache.samples)],
      ['Wiedergaben aus dem Speicher', fmtInt(cache.replays)],
    ]),
    h('h3', { class: 'subhead', text: 'Die zehn meistgespielten' }),
    top.el,
  );
}

function tierCell(tier) {
  return h('span', { title: String(tier ?? '') }, tierName(tier));
}

// ===========================================================================
// Unbekannte Adresse
// ===========================================================================

function renderNotFound() {
  return page(
    { title: 'Seite nicht gefunden' },
    h('p', null, 'Diese Adresse kennt das Dashboard nicht. ', h('a', { href: '#/overview', text: 'Zur Übersicht' })),
  );
}

// ===========================================================================
// DEMO — nur mit ?demo=1 (Beispieldaten) oder ?demo=offline (Dienst aus).
// Ohne diesen Parameter wird nichts davon benutzt. Kein Teil davon verlässt
// den Browser; die Daten entstehen beim Laden und sind danach wieder weg.
// ===========================================================================

function readDemoMode() {
  if (typeof location === 'undefined') return null;
  const value = new URLSearchParams(location.search).get('demo');
  return value === '1' || value === 'offline' ? value : null;
}

const DEMO_MODULES = [
  ['getbetter', 'calendar', 'Kalender', 'events'],
  ['getbetter', 'tasks', 'Aufgaben', 'tasks'],
  ['getbetter', 'notes', 'Notizen', 'notes'],
  ['getbetter', 'contacts', 'Kontakte', 'contacts'],
  ['getbetter', 'habits', 'Gewohnheiten', 'habits'],
  ['betterfamily', 'shopping', 'Einkauf', 'shoppingItems'],
  ['betterfamily', 'chores', 'Ämtli', 'chores'],
  ['betterfamily', 'recipes', 'Rezepte', 'recipes'],
  ['bettergym', 'gym', 'Training', 'workouts'],
  ['bettergym', 'water', 'Trinken', 'drinks'],
  ['bettergym', 'sleep', 'Schlaf', 'sleeps'],
  ['betterai', 'ai', 'Gespräche', 'chats'],
  ['bettermoney', 'budget', 'Budget', 'expenses'],
  ['bettermoney', 'bills', 'Rechnungen', 'bills'],
  ['bettermoney', 'subscriptions', 'Abos', 'subscriptions'],
];

const DEMO_TIERS = [
  { tier: 'cheap_model', model: 'small-instruct', inputChf: 0.1, outputChf: 0.3 },
  { tier: 'chat_model', model: 'chat-medium', inputChf: 0.4, outputChf: 2 },
  { tier: 'reasoning_model', model: 'reasoner-large', inputChf: 2, outputChf: 5 },
  { tier: 'vision_model', model: 'vision-large', inputChf: 2, outputChf: 6 },
];

const DEMO_MINIMUM_CHF = 25;
let demoDb = null;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDemoDb() {
  const rand = mulberry32(20260914);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const people = [
    ['Matteo', 'matteo', 'matteo@example.ch', 'de'],
    ['Lea', 'lea.meier', 'lea@example.ch', 'de'],
    ['Nico', 'nico_r', 'nico@example.ch', 'fr'],
    ['Giulia', 'giulia', 'giulia@example.ch', 'it'],
    ['Sam', 'sam-k', 'sam@example.ch', 'en'],
    ['', 'ohne.name', 'anon@example.ch', 'de'],
    ['<img src=x> & "Test"', 'xss.test', 'xss+<b>@example.ch', 'de'],
  ];
  const accounts = people.map(([firstName, username, email, language], i) => {
    const createdMs = now - (58 - i * 9) * DAY_MS;
    const used = i === 5 ? [] : APPS.filter((_, j) => j === 0 || (i + j) % 3 !== 2);
    const apps = used.map((app) => ({
      id: app.id,
      firstSeenAt: iso(createdMs + HOUR_MS),
      lastSeenAt: iso(now - Math.floor(rand() * 12 * DAY_MS)),
    }));
    const lastSeenAt = apps.map((app) => app.lastSeenAt).sort().at(-1) ?? null;
    return {
      id: `acc_${username.replace(/[^a-z0-9]/g, '')}`,
      email,
      username,
      firstName,
      language,
      createdAt: iso(createdMs),
      lastSeenAt,
      disabled: i === 4,
      blockedApps: i === 2 ? ['bettermoney'] : [],
      paidApps: [['betterai', 'getbetter'], ['bettergym'], [], ['betterfamily']][i] ?? [],
      apps,
      items: 0,
      costChfMonth: 0,
      themeMode: pick(['light', 'dark', 'system']),
      accentKey: pick(['olive', 'sky', 'rose']),
      themePreset: pick(['clean', 'colorful', 'mono']),
      assistantName: pick(['Club', 'Bea', 'Otto']),
      onboarded: i !== 5,
      householdId: i < 3 ? 'house_7K2PQM' : null,
    };
  });

  const counts = Object.fromEntries(
    accounts.map((account) => [
      account.id,
      DEMO_MODULES.map(([app, module, name, collection]) => ({
        app,
        module,
        name,
        collection,
        items: account.apps.some((a) => a.id === app) ? Math.floor(rand() * 40) : 0,
      })),
    ]),
  );

  const aiCalls = [];
  for (let k = 0; k < 220; k += 1) {
    const account = pick(accounts.filter((a) => a.apps.length > 0));
    const roll = rand();
    const tier = DEMO_TIERS[roll < 0.76 ? 0 : roll < 0.9 ? 1 : roll < 0.97 ? 2 : 3];
    const promptTokens = 200 + Math.floor(rand() * 2400);
    const completionTokens = 40 + Math.floor(rand() * 700);
    const ok = rand() > 0.06;
    aiCalls.push({
      at: iso(now - k * 5 * HOUR_MS - Math.floor(rand() * HOUR_MS)),
      accountId: account.id,
      app: rand() < 0.6 ? 'betterai' : 'getbetter',
      tier: tier.tier,
      model: tier.model,
      intent: pick(['chat', 'termin', 'einkauf', 'zusammenfassen', null]),
      voice: rand() < 0.2,
      ok,
      error: ok ? null : pick(['timeout', 'rate_limited']),
      promptTokens,
      completionTokens,
      costChf: ok ? (promptTokens * tier.inputChf + completionTokens * tier.outputChf) / 1e6 : 0,
      durationMs: 300 + Math.floor(rand() * 4200),
    });
  }

  const speechCalls = [];
  for (let k = 0; k < 180; k += 1) {
    const account = rand() < 0.1 ? null : pick(accounts.filter((a) => a.apps.length > 0));
    const sample = rand() < 0.15;
    const characters = sample ? 21 : 12 + Math.floor(rand() * 140);
    const cached = rand() < (sample ? 0.8 : 0.4);
    const ok = cached || rand() > 0.04;
    speechCalls.push({
      at: iso(now - k * 4 * HOUR_MS - Math.floor(rand() * HOUR_MS)),
      accountId: account?.id ?? null,
      app: account ? 'getbetter' : null,
      purpose: sample ? 'sample' : 'speech',
      model: 'eleven_multilingual_v2',
      voiceId: 'DemoVoice0001',
      characters,
      credits: cached || !ok ? 0 : characters,
      cached,
      ok,
      error: ok ? null : 'rate_limited',
    });
  }

  const activity = [];
  const kinds = ['session.created', 'collection.changed', 'collection.changed', 'collection.changed', 'profile.updated', 'session.failed', 'session.blocked', 'ai.reply'];
  for (let k = 0; k < 260; k += 1) {
    const account = pick(accounts);
    const kind = pick(kinds);
    const app = pick(APPS).id;
    const call = pick(aiCalls);
    const details = {
      'session.created': { app },
      'session.failed': { app, reason: 'wrong_password' },
      'session.blocked': { app: 'bettermoney' },
      'profile.updated': { fields: pick([['firstName'], ['language', 'themeMode'], ['assistantVoice']]) },
      'collection.changed': {
        collection: pick([...Object.keys(COLLECTION_NAMES), 'weatherPlaces']),
        added: Math.floor(rand() * 4),
        updated: Math.floor(rand() * 3),
        removed: Math.floor(rand() * 2),
      },
      'ai.reply': { app: call.app, tier: call.tier, model: call.model, costChf: call.costChf, ok: call.ok, error: call.error },
    };
    activity.push({ at: iso(now - k * 2 * HOUR_MS - Math.floor(rand() * HOUR_MS)), accountId: account.id, kind, detail: details[kind] });
  }
  accounts.forEach((account) => activity.push({ at: account.createdAt, accountId: account.id, kind: 'account.created', detail: {} }));
  // Drei offene Abo-Anfragen (Nico, Giulia, ohne Namen) und eine schon abgelehnte.
  const planRequests = [
    [2, 'getbetter', 3 * HOUR_MS, 'pending'],
    [3, 'bettergym', 50 * 60 * 1000, 'pending'],
    [5, 'betterai', 26 * HOUR_MS, 'pending'],
    [1, 'betterai', 9 * DAY_MS, 'declined'],
  ].map(([index, app, ageMs, status], i) => ({
    id: `plr_demo${i + 1}`,
    accountId: accounts[index].id,
    app,
    status,
    createdAt: iso(now - ageMs),
    decidedAt: status === 'pending' ? null : iso(now - ageMs + HOUR_MS),
  }));
  planRequests.forEach((request) =>
    activity.push({ at: request.createdAt, accountId: request.accountId, kind: 'plan.requested', detail: { app: request.app } }),
  );
  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const month = monthKeyOf(new Date());
  const withTotals = accounts.map((account) => ({
    ...account,
    items: sumOf(counts[account.id], (row) => row.items),
    costChfMonth: sumOf(
      aiCalls.filter((c) => c.accountId === account.id && monthKeyOf(new Date(c.at)) === month),
      (c) => c.costChf,
    ),
    usage: demoUsage(aiCalls, speechCalls, account.id),
  }));
  return { accounts: withTotals, counts, aiCalls, speechCalls, activity, planRequests };
}

/** Wie `pendingRequests` im Dienst: offen, mit Konto, die älteste zuerst. */
function demoPendingRequests(db, accountId) {
  const byId = new Map(db.accounts.map((a) => [a.id, a]));
  return asArray(db.planRequests)
    .filter((r) => r.status === 'pending' && byId.has(r.accountId) && (!accountId || r.accountId === accountId))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((r) => {
      const a = byId.get(r.accountId);
      return { id: r.id, accountId: r.accountId, email: a.email, username: a.username, firstName: a.firstName, app: r.app, createdAt: r.createdAt };
    });
}

/** Ein Konto, wie der Dienst es im Admin zeigt: mit Kontingent und offenen Abo-Anfragen. */
function demoAccountView(db, account) {
  return {
    ...account,
    billing: demoBilling(db, account),
    planRequests: demoPendingRequests(db, account.id).map(({ id, app, createdAt }) => ({ id, app, createdAt })),
  };
}

/** Freischalten oder ablehnen, wie im Dienst — mit Abo am Konto und Eintrag im Verlauf. */
function demoDecide(db, id, action, body) {
  if (body && typeof body === 'object' && Object.keys(body).length > 0) throw new ApiError('bad_request', 400);
  const request = asArray(db.planRequests).find((r) => r.id === id);
  if (!request) throw new ApiError('not_found', 404);
  if (request.status !== 'pending') throw new ApiError('already_decided', 409);
  const account = db.accounts.find((a) => a.id === request.accountId);
  if (!account) throw new ApiError('not_found', 404);
  const approved = action === 'approve';
  const decidedAt = new Date().toISOString();
  const paid = asArray(account.paidApps);
  const next = approved && !paid.includes(request.app) ? { ...account, paidApps: [...paid, request.app] } : account;
  const decided = { ...request, status: approved ? 'approved' : 'declined', decidedAt };
  demoDb = {
    ...db,
    accounts: db.accounts.map((a) => (a.id === account.id ? next : a)),
    planRequests: db.planRequests.map((r) => (r.id === id ? decided : r)),
    activity: [
      { at: decidedAt, accountId: account.id, kind: approved ? 'admin.planApproved' : 'admin.planDeclined', detail: { app: request.app } },
      ...db.activity,
    ],
  };
  return {
    request: { id, app: request.app, status: decided.status, createdAt: request.createdAt, decidedAt },
    account: demoAccountView(demoDb, next),
  };
}

const DEMO_SPEECH_CREDITS = 10000;

function demoAiTotals(calls) {
  const promptTokens = sumOf(calls, (c) => c.promptTokens);
  const completionTokens = sumOf(calls, (c) => c.completionTokens);
  return {
    requests: calls.length,
    promptTokens,
    completionTokens,
    tokens: promptTokens + completionTokens,
    costChf: sumOf(calls, (c) => c.costChf),
  };
}

function demoSpeechTotals(calls) {
  const empty = { requests: 0, errors: 0, cached: 0, characters: 0, credits: 0, savedCredits: 0, samples: 0, sampleCredits: 0 };
  return calls.reduce(
    (t, c) => ({
      requests: t.requests + 1,
      errors: t.errors + (c.ok ? 0 : 1),
      cached: t.cached + (c.cached ? 1 : 0),
      characters: t.characters + (c.credits > 0 ? c.characters : 0),
      credits: t.credits + c.credits,
      savedCredits: t.savedCredits + (c.cached ? c.characters : 0),
      samples: t.samples + (c.purpose === 'sample' ? 1 : 0),
      sampleCredits: t.sampleCredits + (c.purpose === 'sample' ? c.credits : 0),
    }),
    empty,
  );
}

function demoUsage(aiCalls, speechCalls, accountId) {
  const within30 = (c) => Date.now() - Date.parse(c.at) <= 30 * DAY_MS;
  const ai = aiCalls.filter((c) => c.accountId === accountId);
  const speech = speechCalls.filter((c) => c.accountId === accountId);
  return {
    last30: { ai: demoAiTotals(ai.filter(within30)), speech: demoSpeechTotals(speech.filter(within30)) },
    total: { ai: demoAiTotals(ai), speech: demoSpeechTotals(speech) },
  };
}

function demoCache() {
  const top = [
    [312, 24, 'speech'],
    [201, 31, 'speech'],
    [118, 21, 'sample'],
    [96, 38, 'speech'],
    [71, 21, 'sample'],
    [44, 27, 'speech'],
    [30, 52, 'speech'],
    [18, 19, 'speech'],
    [9, 64, 'speech'],
    [4, 23, 'sample'],
  ];
  return {
    entries: 214,
    samples: 6,
    bytes: 9412331,
    replays: 1288,
    maxFiles: 2000,
    maxBytes: 200 * 1024 * 1024,
    top: top.map(([hits, characters, purpose], index) => ({
      purpose,
      characters,
      hits,
      bytes: characters * 1800,
      lastPlayedAt: new Date(Date.now() - (index + 1) * 3 * HOUR_MS).toISOString(),
    })),
  };
}

function demoSpeechOverview(db) {
  const now = Date.now();
  const month = monthKeyOf(new Date());
  const last30 = demoSpeechTotals(db.speechCalls.filter((c) => now - Date.parse(c.at) <= 30 * DAY_MS));
  const inMonth = demoSpeechTotals(db.speechCalls.filter((c) => monthKeyOf(new Date(c.at)) === month));
  return {
    configured: true,
    requests30: last30.requests,
    cached30: last30.cached,
    credits30: last30.credits,
    savedCredits30: last30.savedCredits,
    creditsMonth: inMonth.credits,
    charactersMonth: inMonth.characters,
    sampleCreditsMonth: inMonth.sampleCredits,
    monthlyCredits: DEMO_SPEECH_CREDITS,
    cache: demoCache(),
  };
}

function demoSpeechCosts(db, month) {
  const calls = db.speechCalls.filter((c) => monthKeyOf(new Date(c.at)) === month);
  const accountOf = new Map(db.accounts.map((a) => [a.id, a]));
  const groups = (keyOf) => {
    const map = new Map();
    for (const call of calls) map.set(keyOf(call), [...(map.get(keyOf(call)) ?? []), call]);
    return [...map];
  };
  return {
    ...demoSpeechTotals(calls),
    monthlyCredits: DEMO_SPEECH_CREDITS,
    byApp: groups((c) => c.app).map(([app, list]) => ({ app, ...demoSpeechTotals(list) })),
    byAccount: groups((c) => c.accountId)
      .map(([accountId, list]) => ({
        accountId,
        email: accountOf.get(accountId)?.email ?? null,
        username: accountOf.get(accountId)?.username ?? null,
        ...demoSpeechTotals(list),
      }))
      .sort((a, b) => b.credits - a.credits),
    cache: demoCache(),
  };
}

function demoData() {
  demoDb = demoDb ?? buildDemoDb();
  return demoDb;
}

/** Abo und Marge wie im Dienst, nur grob: Preise inkl. MwSt, Stimmen zu 0.10 USD je 1000 Credits. */
const DEMO_PRICES = { getbetter: 1, betterfamily: 3, bettergym: 5, betterai: 8, bettermoney: null };
const demoNet = (price) => (price === null ? 0 : (price / 1.081) * 0.85);
const DEMO_CHF_PER_CREDIT = (0.1 / 1000) * 0.92;

function demoMonthSums(db, month) {
  const sums = new Map();
  const add = (call, field, chf) => {
    if (!call.app || !call.accountId || monthKeyOf(new Date(call.at)) !== month) return;
    const key = `${call.app}|${call.accountId}`;
    const known = sums.get(key) ?? { aiChf: 0, speechChf: 0 };
    sums.set(key, { ...known, [field]: known[field] + chf });
  };
  db.aiCalls.forEach((call) => add(call, 'aiChf', call.costChf));
  db.speechCalls.forEach((call) => add(call, 'speechChf', call.credits * DEMO_CHF_PER_CREDIT));
  return sums;
}

function demoBilling(db, account) {
  const now = new Date();
  const sums = demoMonthSums(db, monthKeyOf(now));
  const resetsOn = dayKeyOf(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  return APPS.map((app) => {
    const price = DEMO_PRICES[app.id];
    const plan = price !== null && asArray(account.paidApps).includes(app.id) ? 'paid' : 'trial';
    const budgetChf = plan === 'paid' ? demoNet(price) * 0.75 : 0.1;
    const { aiChf, speechChf } = sums.get(`${app.id}|${account.id}`) ?? { aiChf: 0, speechChf: 0 };
    const spentChf = aiChf + speechChf;
    return { app: app.id, plan, priceChf: price, budgetChf, aiChf, speechChf, spentChf, usedShare: Math.min(1, spentChf / budgetChf), resetsOn };
  });
}

function demoMargin(db, month) {
  const sums = demoMonthSums(db, month);
  const byApp = APPS.map((app) => {
    const price = DEMO_PRICES[app.id];
    const paid = new Set(db.accounts.filter((a) => price !== null && asArray(a.paidApps).includes(app.id)).map((a) => a.id));
    const rows = [...sums].filter(([key]) => key.startsWith(`${app.id}|`));
    const costOf = (keep) => sumOf(rows.filter(([key]) => keep(paid.has(key.split('|')[1]))), ([, v]) => v.aiChf + v.speechChf);
    const netRevenueChf = paid.size * demoNet(price);
    const variableCostChf = costOf(() => true);
    const marginChf = netRevenueChf - variableCostChf;
    return {
      app: app.id,
      priceChf: price,
      paidAccounts: paid.size,
      netRevenueChf,
      aiChf: sumOf(rows, ([, v]) => v.aiChf),
      speechChf: sumOf(rows, ([, v]) => v.speechChf),
      paidCostChf: costOf((isPaid) => isPaid),
      trialCostChf: costOf((isPaid) => !isPaid),
      variableCostChf,
      marginChf,
      marginShare: netRevenueChf > 0 ? marginChf / netRevenueChf : null,
    };
  });
  const total = (field) => sumOf(byApp, (row) => row[field]);
  const aiBillableChf = Math.max(total('aiChf'), DEMO_MINIMUM_CHF);
  const fixedChf = aiBillableChf - total('aiChf');
  const marginChf = total('marginChf');
  return {
    month,
    vat: 0.081,
    storeFee: 0.15,
    userShare: 0.75,
    byApp,
    totals: {
      paidAccounts: total('paidAccounts'),
      netRevenueChf: total('netRevenueChf'),
      aiChf: total('aiChf'),
      speechChf: total('speechChf'),
      unassignedChf: 0,
      trialCostChf: total('trialCostChf'),
      variableCostChf: total('variableCostChf'),
      marginChf,
      marginShare: null,
      aiMinimumChf: DEMO_MINIMUM_CHF,
      aiBillableChf,
      speechFixedChf: 0,
      fixedChf,
      marginWithFixedChf: marginChf - fixedChf,
    },
  };
}

function demoListShape(account) {
  const { id, email, username, firstName, language, createdAt, lastSeenAt, disabled, blockedApps, paidApps, apps, items, costChfMonth, usage } =
    account;
  return { id, email, username, firstName, language, createdAt, lastSeenAt, disabled, blockedApps, paidApps, apps, items, costChfMonth, usage };
}

function demoGroupDays(calls) {
  const map = new Map();
  for (const call of calls) {
    const day = dayKeyOf(new Date(call.at));
    const row = map.get(day) ?? { day, requests: 0, costChf: 0 };
    map.set(day, { day, requests: row.requests + 1, costChf: row.costChf + call.costChf });
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function demoGroupBy(calls, keyOf, init) {
  const map = new Map();
  for (const call of calls) {
    const key = keyOf(call);
    const row = map.get(key) ?? init(call);
    map.set(key, {
      ...row,
      requests: row.requests + 1,
      costChf: row.costChf + call.costChf,
      promptTokens: (row.promptTokens ?? 0) + call.promptTokens,
      completionTokens: (row.completionTokens ?? 0) + call.completionTokens,
    });
  }
  return [...map.values()];
}

function demoOverview(db) {
  const now = Date.now();
  const within = (value, days) => Boolean(value) && now - Date.parse(value) <= days * DAY_MS;
  const calls30 = db.aiCalls.filter((c) => within(c.at, 30));
  const month = monthKeyOf(new Date());
  return {
    generatedAt: new Date().toISOString(),
    accounts: {
      total: db.accounts.length,
      active7: db.accounts.filter((a) => within(a.lastSeenAt, 7)).length,
      active30: db.accounts.filter((a) => within(a.lastSeenAt, 30)).length,
      newThisWeek: db.accounts.filter((a) => within(a.createdAt, 7)).length,
      disabled: db.accounts.filter((a) => a.disabled).length,
    },
    apps: APPS.map((app) => ({
      id: app.id,
      name: app.name,
      users: db.accounts.filter((a) => a.apps.some((x) => x.id === app.id)).length,
      active7: db.accounts.filter((a) => a.apps.some((x) => x.id === app.id && within(x.lastSeenAt, 7))).length,
      blockedCount: db.accounts.filter((a) => a.blockedApps.includes(app.id)).length,
    })),
    modules: DEMO_MODULES.map(([app, id, name, collection]) => ({
      app,
      id,
      name,
      collection,
      items: sumOf(Object.values(db.counts).flat().filter((row) => row.module === id), (row) => row.items),
    })),
    ai: {
      configured: true,
      requests30: calls30.length,
      costChf30: sumOf(calls30, (c) => c.costChf),
      costChfMonth: sumOf(db.aiCalls.filter((c) => monthKeyOf(new Date(c.at)) === month), (c) => c.costChf),
      cheapShare30: calls30.length ? calls30.filter((c) => c.tier === 'cheap_model').length / calls30.length : 0,
      byDay: demoGroupDays(calls30),
      monthlyMinimumChf: DEMO_MINIMUM_CHF,
    },
    speech: demoSpeechOverview(db),
    margin: demoMargin(db, month),
    planRequests: demoPendingRequests(db),
    storage: { dbBytes: 1834221, uploadsBytes: 12400512 },
  };
}

function demoActivity(db, params) {
  const limit = clamp(Number.parseInt(params.get('limit') ?? '', 10) || PAGE_SIZE, 1, 500);
  const before = params.get('before');
  const emailOf = new Map(db.accounts.map((a) => [a.id, a.email]));
  return db.activity
    .filter((entry) => !params.get('accountId') || entry.accountId === params.get('accountId'))
    .filter((entry) => !params.get('kind') || entry.kind === params.get('kind'))
    .filter((entry) => !before || Date.parse(entry.at) < Date.parse(before))
    .slice(0, limit)
    .map((entry) => ({ ...entry, email: emailOf.get(entry.accountId) ?? null }));
}

function demoDetail(db, account) {
  const calls = db.aiCalls.filter((c) => c.accountId === account.id);
  return {
    account: demoAccountView(db, account),
    counts: db.counts[account.id],
    activity: demoActivity(db, new URLSearchParams({ accountId: account.id, limit: '15' })),
    ai: {
      totals: {
        requests: calls.length,
        costChf: sumOf(calls, (c) => c.costChf),
        promptTokens: sumOf(calls, (c) => c.promptTokens),
        completionTokens: sumOf(calls, (c) => c.completionTokens),
      },
      byApp: demoGroupBy(calls, (c) => c.app, (c) => ({ app: c.app, requests: 0, costChf: 0 })).map(({ app, requests, costChf }) => ({
        app,
        requests,
        costChf,
      })),
      recent: calls.slice(0, 25),
    },
  };
}

function demoPatch(db, account, body) {
  const input = body && typeof body === 'object' ? body : {};
  const next = { ...account };
  const fields = [];
  if ('username' in input) {
    if (typeof input.username !== 'string' || !USERNAME_RE.test(input.username)) throw new ApiError('username_invalid', 400);
    if (db.accounts.some((a) => a.id !== account.id && a.username === input.username)) throw new ApiError('username_taken', 409);
    next.username = input.username;
    fields.push('username');
  }
  if ('firstName' in input) {
    next.firstName = String(input.firstName);
    fields.push('firstName');
  }
  if ('language' in input) {
    if (!LANGUAGES.some(([value]) => value === input.language)) throw new ApiError('bad_request', 400);
    next.language = input.language;
    fields.push('language');
  }
  if ('disabled' in input) {
    next.disabled = Boolean(input.disabled);
    fields.push('disabled');
  }
  if ('blockedApps' in input) {
    // Zum Ausprobieren der Rücknahme: BetterAi bei Sam sperren schlägt absichtlich fehl.
    if (account.username === 'sam-k' && asArray(input.blockedApps).includes('betterai')) throw new ApiError('http_error', 500);
    next.blockedApps = asArray(input.blockedApps).filter((id) => APP_BY_ID.has(id));
    fields.push('blockedApps');
  }
  if ('paidApps' in input) {
    next.paidApps = asArray(input.paidApps).filter((id) => APP_BY_ID.has(id));
    fields.push('paidApps');
  }
  // Das Abo direkt eingeschaltet: offene Anfragen fuer diese Apps sind damit erledigt.
  const added = 'paidApps' in input ? next.paidApps.filter((id) => !asArray(account.paidApps).includes(id)) : [];
  const decidedAt = new Date().toISOString();
  demoDb = {
    ...db,
    accounts: db.accounts.map((a) => (a.id === account.id ? next : a)),
    planRequests: asArray(db.planRequests).map((r) =>
      r.accountId === account.id && r.status === 'pending' && added.includes(r.app) ? { ...r, status: 'approved', decidedAt } : r,
    ),
    activity: [{ at: decidedAt, accountId: account.id, kind: 'admin.updated', detail: { fields } }, ...db.activity],
  };
  return { account: demoAccountView(demoDb, next) };
}

function demoCosts(db, monthParam) {
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : monthKeyOf(new Date());
  const calls = db.aiCalls.filter((c) => monthKeyOf(new Date(c.at)) === month);
  const accountOf = new Map(db.accounts.map((a) => [a.id, a]));
  const totalChf = sumOf(calls, (c) => c.costChf);
  return {
    month,
    totalChf,
    monthlyMinimumChf: DEMO_MINIMUM_CHF,
    billableChf: Math.max(totalChf, DEMO_MINIMUM_CHF),
    byApp: demoGroupBy(calls, (c) => c.app, (c) => ({ app: c.app, requests: 0, costChf: 0, promptTokens: 0, completionTokens: 0 })),
    byAccount: demoGroupBy(calls, (c) => c.accountId, (c) => ({
      accountId: c.accountId,
      email: accountOf.get(c.accountId)?.email ?? null,
      username: accountOf.get(c.accountId)?.username ?? null,
      requests: 0,
      costChf: 0,
    })).map(({ accountId, email, username, requests, costChf }) => ({ accountId, email, username, requests, costChf })),
    byTier: demoGroupBy(calls, (c) => c.tier, (c) => ({ tier: c.tier, requests: 0, costChf: 0 })).map(({ tier, requests, costChf }) => ({
      tier,
      requests,
      costChf,
    })),
    byDay: demoGroupDays(calls),
    prices: DEMO_TIERS.map(({ model, inputChf, outputChf }) => ({ model, inputChf, outputChf })),
    speech: demoSpeechCosts(db, month),
    margin: demoMargin(db, month),
  };
}

/** Wie der Dienst: nur mit der E-Mail des Kontos, danach ist es aus Liste, Zahlen und Detail weg. */
function demoDelete(db, account, body) {
  const typed = normaliseConfirm(body?.confirm);
  if (!typed || typed !== normaliseConfirm(account.email)) throw new ApiError('confirm_mismatch', 400);
  const removed = asArray(db.counts[account.id])
    .filter((row) => row.collection && row.items > 0)
    .reduce((totals, row) => ({ ...totals, [row.collection]: (totals[row.collection] ?? 0) + row.items }), { accounts: 1 });
  demoDb = {
    ...db,
    accounts: db.accounts.filter((a) => a.id !== account.id),
    counts: Object.fromEntries(Object.entries(db.counts).filter(([id]) => id !== account.id)),
    activity: [
      { at: new Date().toISOString(), accountId: account.id, kind: 'admin.deleted', detail: { username: account.username } },
      ...db.activity,
    ],
  };
  return { ok: true, removed };
}

async function demoApi(method, path, body) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (DEMO_MODE === 'offline') throw new ApiError('offline');
  const db = demoData();
  const url = new URL(path, location.origin);
  const parts = url.pathname.split('/').filter(Boolean).map(safeDecode);
  const copy = (value) => structuredClone(value);

  if (method === 'GET' && url.pathname === '/api/overview') return copy(demoOverview(db));
  if (method === 'GET' && url.pathname === '/api/accounts') return copy({ accounts: db.accounts.map(demoListShape) });
  if (method === 'GET' && url.pathname === '/api/activity') return copy({ entries: demoActivity(db, url.searchParams) });
  if (method === 'GET' && url.pathname === '/api/costs') return copy(demoCosts(db, url.searchParams.get('month')));
  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'plan-requests' && parts.length === 4 && ['approve', 'decline'].includes(parts[3])) {
    return copy(demoDecide(db, parts[2], parts[3], body));
  }
  if (parts[0] === 'api' && parts[1] === 'accounts' && parts[2]) {
    const account = db.accounts.find((a) => a.id === parts[2]);
    if (!account) throw new ApiError('not_found', 404);
    if (method === 'GET' && parts.length === 3) return copy(demoDetail(db, account));
    if (method === 'PATCH' && parts.length === 3) return copy(demoPatch(db, account, body));
    if (method === 'DELETE' && parts.length === 3) return copy(demoDelete(db, account, body));
    // „App ansehen“ braucht die echten Apps — in der Demo gibt es keine Adresse.
    if (method === 'POST' && parts[3] === 'view') return { url: null, expiresAt: null };
    if (method === 'POST' && parts[3] === 'password') {
      if (typeof body?.password !== 'string' || body.password.length < PASSWORD_MIN) throw new ApiError('password_too_short', 400);
      return { ok: true };
    }
  }
  throw new ApiError('http_error', 404);
}

// ===========================================================================
// Start — ganz am Ende, damit alle Konstanten oben schon stehen.
// ===========================================================================

if (typeof document !== 'undefined') boot();
