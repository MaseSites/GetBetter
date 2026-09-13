import { useEffect, useState } from 'react';

import { localeFor, type Language } from '@/i18n';

/**
 * Zeiten eines Orts in dessen Zeitzone — ueber `Intl`, wie alles andere. Kennt
 * die Laufzeit die Zone nicht, faellt es auf die Zeit des Geraets zurueck.
 */

const MINUTE_MS = 60_000;

function formatter(
  language: Language,
  options: Intl.DateTimeFormatOptions,
  timeZone?: string,
): Intl.DateTimeFormat {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat(localeFor(language), { ...options, timeZone });
    } catch {
      // Unbekannte Zone: lieber die Zeit des Geraets als gar keine.
    }
  }
  return new Intl.DateTimeFormat(localeFor(language), options);
}

/** „16 Uhr“, „16 h“ — fuer Saetze. */
export function hourLabel(language: Language, ts: number, timeZone?: string): string {
  return formatter(language, { hour: 'numeric' }, timeZone).format(ts);
}

/** Nur die Zahl, „16“ — fuer die Stundenleiste. */
export function hourNumber(language: Language, ts: number, timeZone?: string): string {
  const parts = formatter(language, { hour: 'numeric' }, timeZone).formatToParts(ts);
  return parts.find((part) => part.type === 'hour')?.value ?? hourLabel(language, ts, timeZone);
}

/** „14:32“ */
export function clockTime(language: Language, ts: number, timeZone?: string): string {
  return formatter(language, { hour: '2-digit', minute: '2-digit' }, timeZone).format(ts);
}

/** „Mo“ */
export function weekdayShort(language: Language, ts: number, timeZone?: string): string {
  return formatter(language, { weekday: 'short' }, timeZone).format(ts);
}

/** „Montag, 15. September“ */
export function longDay(language: Language, ts: number, timeZone?: string): string {
  return formatter(language, { weekday: 'long', day: 'numeric', month: 'long' }, timeZone).format(
    ts,
  );
}

/** „12.9.“ */
export function shortDay(language: Language, ts: number, timeZone?: string): string {
  return formatter(language, { day: 'numeric', month: 'numeric' }, timeZone).format(ts);
}

/** Ob der Ort gerade eine andere Uhrzeit hat als das Geraet. */
export function isOtherZone(offsetSeconds: number, now: number): boolean {
  return -new Date(now).getTimezoneOffset() * 60 !== offsetSeconds;
}

/** Die Uhrzeit, jede Minute neu — fuer „Jetzt“, das Alter der Daten und die Ortszeit. */
export function useNow(intervalMs = MINUTE_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
