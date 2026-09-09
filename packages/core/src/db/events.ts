/**
 * Ein kleiner Ersatz fuer einen Query-Cache: Schreiboperationen melden sich,
 * laufende Abfragen laden dann neu. Reicht fuer eine App dieser Groesse.
 *
 * Bewusst ohne Abhaengigkeiten — Speicher und Abfragen haengen beide hier
 * dran, ohne sich gegenseitig zu brauchen.
 */
const listeners = new Set<() => void>();

export function notifyDataChanged(): void {
  listeners.forEach((listener) => listener());
}

/** Meldet sich bei jeder Aenderung; die Rueckgabe meldet wieder ab. */
export function subscribeDataChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
