/**
 * Das Einrichten als Gespraech mit dem Avatar, in Schritten:
 *
 * - `voice`       — zuerst, wie er klingen soll. Nur mit Abo (ohne spricht die
 *                   beste Stimme) und nur, wo es ueberhaupt Stimmen gibt.
 * - `name`        — wie darf ich dich ansprechen? Der Spitzname (nur, wenn das
 *                   Konto noch keinen hat).
 * - `personalize` — App und Assistent auf einer Seite: hell oder dunkel,
 *                   Farbe, Voreinstellung, Hintergrund, sein Name und Avatar.
 *                   Ohne Abo darf man alles anprobieren (siehe `Trial`); wer
 *                   etwas davon behalten will, bekommt beim Weiter das Abo.
 * - `ready`       — kennst du dich schon aus? Tutorial oder direkt rein
 *
 * Reine Rechnung ohne React, damit sie unter Node getestet werden kann.
 */
export type SetupStep = 'voice' | 'name' | 'personalize' | 'ready';

export type SetupDraft = { firstName: string; assistantName: string };

/** Die Schritte dieser Einrichtung. */
export function setupSteps(
  hasFirstName: boolean,
  canPickVoice: boolean,
  canPersonalize = true,
): readonly SetupStep[] {
  const voice: readonly SetupStep[] = canPersonalize && canPickVoice ? ['voice'] : [];
  const name: readonly SetupStep[] = hasFirstName ? [] : ['name'];
  return [...voice, ...name, 'personalize', 'ready'];
}

/** Ob man von diesem Schritt weiter darf: der Spitzname braucht mindestens ein Zeichen. */
export function canLeave(step: SetupStep, draft: SetupDraft): boolean {
  if (step === 'name') return draft.firstName.trim().length > 0;
  return true;
}

/** Der Nachbar in dieser Richtung, oder `null` am Anfang und am Ende. */
export function neighbourStep(
  steps: readonly SetupStep[],
  index: number,
  direction: 1 | -1,
): number | null {
  const next = index + direction;
  return next >= 0 && next < steps.length ? next : null;
}

/** Ein Vorschlag braucht mindestens so viele Buchstaben. */
const MIN_SUGGESTION = 2;
const MAX_SUGGESTION = 20;

function firstWordOf(raw: string): string | null {
  const word = raw
    .trim()
    .split(/[^\p{L}]+/u)
    .find((part) => part.length >= MIN_SUGGESTION);
  if (!word) return null;
  const short = word.slice(0, MAX_SUGGESTION).toLowerCase();
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/**
 * Ein Spitzname zum Antippen: das erste Wort des Benutzernamens
 * („matteo.cocetrone“ → „Matteo“), sonst das der E-Mail vor dem @. Ohne
 * brauchbares Wort kein Vorschlag.
 */
export function nicknameSuggestion(username: string, email: string): string | null {
  return firstWordOf(username) ?? firstWordOf(email.split('@')[0] ?? '');
}
