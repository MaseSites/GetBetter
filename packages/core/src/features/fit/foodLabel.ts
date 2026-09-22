/**
 * Lebensmittelnamen aus der Schweizer Nährwertdatenbank sind amtlich genau:
 * „Hühnerei, ganz, roh“, „Kichererbse, gekocht (ohne Zugabe von Fett und
 * Salz)“, „Mehl (Durchschnitt)“. Zum Auswählen braucht es die ganze Form, zum
 * Lesen im Alltag nur den Kopf: „Hühnerei“, „Kichererbse“, „Mehl“.
 *
 * `shortFoodName` nimmt den Teil vor dem ersten Komma und wirft Klammern weg.
 * Gebraucht wird er in Listen (Tag, Vorrat, Einkauf, Rezeptzeilen) — nie in
 * der Suche oder beim Bestätigen eines Fotos, wo die Zubereitung zählt.
 */
export function shortFoodName(name: string): string {
  const head = name.split(',')[0] ?? name;
  const clean = head
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > 0 ? clean : name.trim();
}

/** Mehrere Namen kurz und ohne Doppelte, in der gegebenen Reihenfolge. */
export function shortFoodNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const short = shortFoodName(name);
    const key = short.toLocaleLowerCase('de-CH');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(short);
  }
  return result;
}
