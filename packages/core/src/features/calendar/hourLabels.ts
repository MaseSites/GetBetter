/**
 * Wann die Stundenzahl im Zeitraster der Jetzt-Zeit weichen muss.
 *
 * Beide Beschriftungen stehen mittig auf ihrer Linie und sind eine Zeile
 * hoch. Sie ueberlagern sich also genau dann, wenn ihre Mitten naeher als
 * eine Zeilenhoehe beieinander liegen — nicht schon, wenn die Minuten
 * "irgendwie nah" sind. Um 12:40 bleibt 13:00 stehen.
 */
export function hourLabelHidden(
  hour: number,
  nowMinutes: number | null,
  hourHeight: number,
  labelHeight: number,
): boolean {
  // Mitternacht steht am oberen Rand und hat keinen Platz ueber sich.
  if (hour === 0) return true;
  if (nowMinutes === null) return false;
  const distance = Math.abs(hour * 60 - nowMinutes) * (hourHeight / 60);
  return distance < labelHeight;
}
