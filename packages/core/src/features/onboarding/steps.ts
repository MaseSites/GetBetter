/**
 * Das Einrichten als Gespraech mit dem Avatar, in Schritten:
 *
 * - `name`      — wie darf ich dich ansprechen? Der Spitzname, mit dem die App
 *                 dich anredet (nur, wenn das Konto noch keinen hat). Der
 *                 Benutzername steht schon seit dem Registrieren fest.
 * - `assistant` — „Mein Name ist …“: man gibt dem Assistenten seinen Namen
 * - `style`     — hell oder dunkel, Akzentfarbe, Voreinstellung, Hintergrund
 * - `ready`     — kennst du dich schon aus? Tutorial oder direkt rein
 *
 * Reine Rechnung ohne React, damit sie unter Node getestet werden kann.
 */
export type SetupStep = 'name' | 'assistant' | 'style' | 'ready';

export type SetupDraft = { firstName: string; assistantName: string };

export function setupSteps(hasFirstName: boolean): readonly SetupStep[] {
  return hasFirstName ? ['assistant', 'style', 'ready'] : ['name', 'assistant', 'style', 'ready'];
}

/** Ob man von diesem Schritt weiter darf: Namen brauchen mindestens ein Zeichen. */
export function canLeave(step: SetupStep, draft: SetupDraft): boolean {
  if (step === 'name') return draft.firstName.trim().length > 0;
  if (step === 'assistant') return draft.assistantName.trim().length > 0;
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
