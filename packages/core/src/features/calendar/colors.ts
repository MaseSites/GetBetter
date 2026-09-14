import type { TranslationKey } from '@/i18n';

/**
 * Die Farben, die ein Termin haben kann. Bewusst gedeckt, damit sie neben
 * dem ruhigen Rest der App nicht schreien. Jede traegt weisse Schrift mit
 * 4.5:1 und hebt sich als Streifen auch auf dunklem Papier mit 3:1 ab —
 * dafuer ist nur ein schmales Helligkeitsband frei (`contrast.test.ts`).
 */
export const EVENT_COLORS = {
  sage: '#45725F',
  blue: '#3B6EA5',
  violet: '#6F6098',
  rose: '#A0526A',
  amber: '#9A6B2B',
  teal: '#2E7D7B',
  slate: '#616A78',
} as const;

/** Schrift auf einer Terminfarbe — jede traegt sie mit 4.5:1 (`contrast.test.ts`). */
export const EVENT_TEXT_COLOR = '#FFFFFF';

export type EventColorKey = keyof typeof EVENT_COLORS;

export const EVENT_COLOR_KEYS = Object.keys(EVENT_COLORS) as EventColorKey[];

export const DEFAULT_EVENT_COLOR: EventColorKey = 'sage';

export function isEventColorKey(value: string | null | undefined): value is EventColorKey {
  return value !== null && value !== undefined && value in EVENT_COLORS;
}

/** Termine aus der Zeit vor den Farben bekommen die Standardfarbe. */
export function eventColor(key: string | null | undefined): string {
  return EVENT_COLORS[isEventColorKey(key) ? key : DEFAULT_EVENT_COLOR];
}

export function eventColorKey(key: string | null | undefined): EventColorKey {
  return isEventColorKey(key) ? key : DEFAULT_EVENT_COLOR;
}

export function colorLabelKey(key: EventColorKey): TranslationKey {
  return `calendar.color.${key}` as TranslationKey;
}
