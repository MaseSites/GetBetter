/**
 * Der Assistent startet leer. Es gibt noch kein Modell dahinter — was
 * getippt wird, beantwortet er mit genau diesem Satz, statt so zu tun,
 * als koenne er schon etwas eintragen.
 */
export const ASSISTANT_CANNED_REPLY =
  'Das kann ich noch nicht — hinter mir steckt bisher kein Modell. Sobald eines da ist, trage ich so etwas fuer dich ein und frage vorher nach.';

/** Wie lange die Antwort auf sich warten laesst, damit es nicht abgehackt wirkt. */
export const ASSISTANT_REPLY_DELAY_MS = 700;
