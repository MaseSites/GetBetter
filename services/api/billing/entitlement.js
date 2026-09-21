/**
 * Was ohne Abo gesperrt ist: alles am Aussehen ausser hell/dunkel, dazu Name,
 * Avatar und Stimme des Assistenten. Rein und ohne Speicher — getestet.
 *
 * Gesperrt heisst: der Dienst schreibt es nicht. Gespeicherte Werte bleiben
 * stehen, damit sie mit einem Abo wiederkommen; die Apps zeigen solange den
 * Standard (`features/plan/entitlement.ts`).
 */
const { canPersonalize } = require('./plans.js');

/** Dieselbe Liste steht in den Apps (`features/plan/entitlement.ts`). */
const LOCKED_FIELDS = [
  'accentKey',
  'themePreset',
  'backdrop',
  'assistantAvatar',
  'assistantName',
  'assistantVoice',
];

/** Gleich, auch wenn ein Objekt seine Felder anders ordnet (der Avatar). */
function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const keys = Object.keys(a).sort();
  const other = Object.keys(b).sort();
  return (
    keys.length === other.length &&
    keys.every((key, index) => key === other[index] && sameValue(a[key], b[key]))
  );
}

/**
 * Die gesperrten Felder, die `changes` wirklich aendern wuerde — nur unter
 * `fields` (was die Route ueberhaupt schreibt). Denselben Wert nochmal zu
 * schicken, aendert nichts und ist erlaubt.
 */
function lockedChangesOf(row, changes, fields = LOCKED_FIELDS) {
  return LOCKED_FIELDS.filter(
    (field) =>
      fields.includes(field) &&
      changes?.[field] !== undefined &&
      !sameValue(changes[field], row?.[field]),
  );
}

/**
 * Fuer `PUT /v1/db/accounts`: darf das gespeicherte Konto nicht
 * personalisieren, gelten die gespeicherten Werte — was die App schickt, zaehlt
 * nicht. Ein neues Konto (`known` fehlt) hat kein Abo und nichts Gespeichertes.
 */
function keepLockedFields(row, known, settings) {
  if (canPersonalize(known, settings)) return row;
  const copy = { ...row };
  for (const field of LOCKED_FIELDS) {
    if (known?.[field] !== undefined) copy[field] = known[field];
    else delete copy[field];
  }
  return copy;
}

module.exports = { LOCKED_FIELDS, keepLockedFields, lockedChangesOf, sameValue };
