/**
 * Was eine Antwort oder Weiterleitung von der urspruenglichen Mail uebernimmt:
 * die Kette fuer `References`, den Betreff und — beim Weiterleiten — Kopf und
 * Text der Mail als Zitat. Ohne Netz und ohne Speicher, damit es sich pruefen laesst.
 *
 * Die Beschriftungen (`From:`, `Date:` …) sind englisch, wie in den Koepfen der
 * Mail selbst: der Dienst weiss nicht, in welcher Sprache der Empfaenger liest.
 */
const { formatDate } = require('./smtp.js');

const FORWARD_PREFIX = /^\s*(?:fwd?|wg|tr)\s*:/i;
const FORWARD_LINE = '---------- Forwarded message ----------';

/** Die eigenen `References` der beantworteten Mail, ihre Message-ID zuletzt. */
function referencesFor(parent) {
  const references = Array.isArray(parent?.references)
    ? parent.references.filter((id) => typeof id === 'string')
    : [];
  const own = typeof parent?.messageId === 'string' ? parent.messageId : null;
  return own ? [...references.filter((id) => id !== own), own] : references;
}

/** `Fwd: …` — ausser der Betreff ist schon eine Weiterleitung. */
function forwardSubject(subject) {
  const text = String(subject ?? '').trim();
  return FORWARD_PREFIX.test(text) ? text : `Fwd: ${text}`.trim();
}

const addressText = (entry) =>
  entry?.name ? `${entry.name} <${entry.address}>` : String(entry?.address ?? '');

function dateText(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : formatDate(date);
}

/**
 * Der eigene Text, darunter Kopf und Text der weitergeleiteten Mail mit `> `.
 * Anhaenge der Mail gehen nicht mit — nur ihr Text.
 */
function forwardText(text, original) {
  const own = String(text ?? '').replace(/\s+$/, '');
  const cc = Array.isArray(original.cc) ? original.cc : [];
  const head = [
    FORWARD_LINE,
    `From: ${addressText(original.from)}`,
    `Date: ${dateText(original.date)}`,
    `Subject: ${String(original.subject ?? '')}`,
    `To: ${(Array.isArray(original.to) ? original.to : []).map(addressText).join(', ')}`,
    ...(cc.length > 0 ? [`Cc: ${cc.map(addressText).join(', ')}`] : []),
  ];
  const quoted = String(original.text ?? '')
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n');
  return `${own.length > 0 ? `${own}\n\n` : ''}${head.join('\n')}\n\n${quoted}\n`;
}

module.exports = { forwardSubject, forwardText, referencesFor };
