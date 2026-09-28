/**
 * Ämtli reihum — wie der Schweizer Ämtliplan: nach dem Erledigen ist die
 * nächste Person dran. Rein gerechnet (`rotation.test.ts`).
 */

export type RotatingChore = {
  assignedTo: string | null;
  rotation?: readonly string[] | null;
};

/**
 * Wer nach dem Erledigen dran ist. Ohne Reihum bleibt es bei der zugeteilten
 * Person. `active` (die Mitglieder des Haushalts) lässt weg, wer ausgetreten
 * ist; bleibt niemand übrig, gilt wieder die zugeteilte Person.
 */
export function nextAssignee(chore: RotatingChore, active?: readonly string[]): string | null {
  const order = (chore.rotation ?? []).filter(
    (id, index, all) => all.indexOf(id) === index && (!active || active.includes(id)),
  );
  if (order.length === 0) return chore.assignedTo;
  const at = chore.assignedTo === null ? -1 : order.indexOf(chore.assignedTo);
  if (at === -1) return order[0] ?? null;
  return order[(at + 1) % order.length] ?? null;
}

/** Reihum heisst mindestens zwei Personen — mit einer ist es eine feste Zuteilung. */
export function isRotating(chore: Pick<RotatingChore, 'rotation'>): boolean {
  return (chore.rotation?.length ?? 0) >= 2;
}
