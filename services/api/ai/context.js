/**
 * Was der Assistent ueber die Daten der Person weiss: die App schickt eine
 * kurze Liste mit (`context`), der Dienst raeumt sie auf und schreibt sie in
 * den Systemtext. So kann er „Was habe ich morgen?“ beantworten und bestehende
 * Eintraege ueber ihre Kennung treffen (`[T2]`), ohne je selbst in die
 * Datenbank zu greifen.
 *
 * `{ now: 'YYYY-MM-DDTHH:MM', items: [{ ref?, kind, title, date?, time?, end?, note? }],
 * facts: [{ label, value }] }` — alles in der Ortszeit der Person. Kaputtes faellt
 * weg, Zu-Langes wird gekuerzt; eine Anfrage scheitert nie am Kontext.
 */

const MAX_ITEMS = 80;
const MAX_FACTS = 12;
const MAX_TITLE = 120;
const MAX_NOTE = 120;
const MAX_FACT = 60;
/** So viele Tage stehen als Liste da — daraus nimmt das Modell seine Daten. */
const DAYS_AHEAD = 14;

const NOW_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const REF_PATTERN = /^[A-Z]\d{1,3}$/;

/** Die Arten in der Reihenfolge, in der sie im Systemtext stehen. */
const SECTIONS = {
  event: 'Termine',
  task: 'Offene Aufgaben',
  alarm: 'Wecker',
  birthday: 'Geburtstage',
  habit: 'Gewohnheiten',
  note: 'Letzte Notizen',
  shopping: 'Einkaufsliste',
  chore: 'Ämtli',
  bill: 'Offene Rechnungen',
};
const KINDS = Object.keys(SECTIONS);
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Einzeilig und gekuerzt — nichts im Kontext kann den Systemtext umbrechen. */
function line(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const matching = (value, pattern) => (typeof value === 'string' && pattern.test(value) ? value : null);

function itemOf(raw) {
  if (!isObject(raw) || !KINDS.includes(raw.kind)) return null;
  const title = line(raw.title, MAX_TITLE);
  if (title === null) return null;
  return {
    ref: matching(raw.ref, REF_PATTERN),
    kind: raw.kind,
    title,
    date: matching(raw.date, DATE_PATTERN),
    time: matching(raw.time, TIME_PATTERN),
    end: matching(raw.end, TIME_PATTERN),
    note: line(raw.note, MAX_NOTE),
  };
}

function factOf(raw) {
  if (!isObject(raw)) return null;
  const label = line(raw.label, MAX_FACT);
  const value = line(typeof raw.value === 'number' ? String(raw.value) : raw.value, MAX_FACT);
  return label && value ? { label, value } : null;
}

/** Der aufgeraeumte Kontext oder null, wenn `now` fehlt oder kaputt ist. */
function cleanContext(raw) {
  if (!isObject(raw) || !NOW_PATTERN.test(raw.now ?? '')) return null;
  const items = (Array.isArray(raw.items) ? raw.items : []).map(itemOf).filter(Boolean).slice(0, MAX_ITEMS);
  const facts = (Array.isArray(raw.facts) ? raw.facts : []).map(factOf).filter(Boolean).slice(0, MAX_FACTS);
  return { now: raw.now, items, facts };
}

function dayOf(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const keyOf = (date) => date.toISOString().slice(0, 10);
const weekdayOf = (key) => WEEKDAYS[dayOf(key).getUTCDay()];
const withWeekday = (key) => `${weekdayOf(key)} ${key}`;

/** Heute, morgen und die Tage danach — mit Wochentag, damit „naechsten Dienstag“ stimmt. */
function daysFrom(today) {
  const start = dayOf(today);
  return Array.from({ length: DAYS_AHEAD }, (_, index) => {
    const key = keyOf(new Date(start.getTime() + index * 86_400_000));
    const label = index === 0 ? 'heute ' : index === 1 ? 'morgen ' : '';
    return `${label}${withWeekday(key)}`;
  }).join(' · ');
}

function itemLine(item) {
  const parts = [
    item.ref ? `[${item.ref}]` : null,
    item.date ? withWeekday(item.date) : null,
    item.time ? (item.end ? `${item.time}–${item.end}` : item.time) : null,
    item.title,
    item.note ? `(${item.note})` : null,
  ];
  return `- ${parts.filter(Boolean).join(' ')}`;
}

/** Der Kontext als Text fuer den Systemtext. */
function contextText(context) {
  const [, year, month, day, hour, minute] = NOW_PATTERN.exec(context.now);
  const today = `${year}-${month}-${day}`;
  const lines = [
    `Jetzt: ${withWeekday(today)}, ${hour}:${minute} Uhr.`,
    `Die naechsten Tage: ${daysFrom(today)}.`,
  ];
  for (const kind of KINDS) {
    const items = context.items.filter((item) => item.kind === kind);
    if (items.length === 0) continue;
    lines.push(`${SECTIONS[kind]}:`, ...items.map(itemLine));
  }
  if (context.facts.length > 0) {
    lines.push('Zahlen:', ...context.facts.map((fact) => `- ${fact.label}: ${fact.value}`));
  }
  return lines.join('\n');
}

module.exports = { DAYS_AHEAD, MAX_ITEMS, cleanContext, contextText };
