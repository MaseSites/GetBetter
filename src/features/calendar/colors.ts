import type { TranslationKey } from '@/i18n';

/**
 * Die Farben, die ein Termin haben kann. Bewusst gedeckt, damit sie neben
 * dem ruhigen Rest der App nicht schreien, und dunkel genug fuer weisse Schrift.
 */
export const EVENT_COLORS = {
  sage: '#3F6E5A',
  blue: '#3B6EA5',
  violet: '#6B5B95',
  rose: '#A0526A',
  amber: '#A9762F',
  teal: '#2E7D7B',
  slate: '#5A6472',
} as const;

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
