/**
 * Das Einrichten als Gespraech mit dem Avatar, in Schritten:
 *
 * - `voice`     — zuerst, wie er klingen soll. Er redet von Anfang an mit dir,
 *                 also waehlt man seine Stimme, bevor er viel sagt. Nur, wo es
 *                 ueberhaupt Stimmen gibt.
 * - `name`      — wie darf ich dich ansprechen? Der Spitzname, mit dem die App
 *                 dich anredet (nur, wenn das Konto noch keinen hat). Der
 *                 Benutzername steht schon seit dem Registrieren fest.
 * - `assistant` — „Mein Name ist …“: man gibt dem Assistenten seinen Namen
 * - `avatar`    — er stellt sich vor und verwandelt sich: Figur und Farbe
 * - `style`     — hell oder dunkel, Akzentfarbe, Voreinstellung, Hintergrund
 * - `ready`     — kennst du dich schon aus? Tutorial oder direkt rein
 *
 * Ohne Abo (jede neue Registrierung) fallen Stimme, Name und Avatar weg — dort
 * gaebe es nichts zu waehlen. `style` bleibt: hell oder dunkel ist frei, der
 * Rest zeigt den Standard mit „Mit Abo personalisierbar“.
 *
 * Reine Rechnung ohne React, damit sie unter Node getestet werden kann.
 */
export type SetupStep = 'name' | 'assistant' | 'avatar' | 'voice' | 'style' | 'ready';

export type SetupDraft = { firstName: string; assistantName: string };

/**
 * Die Schritte dieser Einrichtung. Die Stimme kommt zuerst — aber nur, wo es
 * mehr als eine gibt; sonst waere das ein Schritt ohne Wahl.
 */
export function setupSteps(
  hasFirstName: boolean,
  canPickVoice: boolean,
  canPersonalize = true,
): readonly SetupStep[] {
  const name: readonly SetupStep[] = hasFirstName ? [] : ['name'];
  // Ohne Abo kurz: der Spitzname, hell oder dunkel, fertig.
  if (!canPersonalize) return [...name, 'style', 'ready'];
  const voice: readonly SetupStep[] = canPickVoice ? ['voice'] : [];
  // Kaum hat er einen Namen, zeigt er sich — und man darf ihn gleich umgestalten.
  return [...voice, ...name, 'assistant', 'avatar', 'style', 'ready'];
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
