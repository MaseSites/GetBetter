/**
 * Ob gerade eine Anprobe laufen darf — nur, solange das Einrichten offen ist.
 * Ausserhalb von React, damit der Bildschirm sie in einem Effekt oeffnen und
 * beim Verlassen schliessen kann, ohne Zustand im Effekt zu setzen.
 */
let openCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Oeffnet die Anprobe; der Rueckgabewert schliesst sie wieder (fuer `useEffect`). */
export function openTrialGate(): () => void {
  openCount += 1;
  emit();
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    openCount -= 1;
    emit();
  };
}

export function trialGateOpen(): boolean {
  return openCount > 0;
}

export function onTrialGateChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
