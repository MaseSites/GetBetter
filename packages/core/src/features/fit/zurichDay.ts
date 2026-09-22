/**
 * Der Tag in Zuerich als `YYYY-MM-DD` — die eine Tagesgrenze fuer Training,
 * Trinken und die Startseite von BetterGym (der Dienst rechnet genauso).
 * Um Mitternacht und beim Zurueckkehren in die App wechselt er von selbst.
 */

const ZONE = 'Europe/Zurich';
const format = new Intl.DateTimeFormat('sv-SE', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function zurichDayOf(date: Date = new Date()): string {
  return format.format(date);
}

export function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
}

/**
 * Millisekunden bis zum naechsten Tageswechsel in Zuerich. Gesucht in
 * Minutenschritten ab der vollen Stunde — so stimmt es auch an den Tagen der
 * Zeitumstellung, ohne Zeitzonen-Tabelle.
 */
export function msUntilNextDay(now: Date = new Date()): number {
  const today = zurichDayOf(now);
  const hour = 3600000;
  let probe = Math.ceil(now.getTime() / hour) * hour;
  while (zurichDayOf(new Date(probe)) === today) probe += hour;
  // Die erste Stunde des neuen Tages gefunden — jetzt auf die Minute genau zurueck.
  let minute = probe - hour;
  while (zurichDayOf(new Date(minute)) === today) minute += 60000;
  return Math.max(1000, minute - now.getTime());
}
