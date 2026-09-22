import { dayKey } from '../../db/pure';

/**
 * Der Vertrag, mit dem andere Bildschirme in den Kalender springen:
 * `/run/calendar?day=YYYY-MM-DD&at=HH:MM&event=<id>` oeffnet den Tag, rollt zur
 * Uhrzeit und hebt den Termin hervor. Rein, getestet.
 */

const DAY_PARAM = /^(\d{4})-(\d{2})-(\d{2})$/u;
const TIME_PARAM = /^(\d{2}):(\d{2})$/u;
const DAY_MINUTES = 24 * 60;

const pad = (value: number) => String(value).padStart(2, '0');

/** Ein Termin im Kalender: sein Tag, bei einem mit Uhrzeit dazu die Zeit. */
export function calendarLinkOf(event: { id: string; startsAt: string; allDay?: boolean }): string {
  const start = new Date(event.startsAt);
  const parts = [
    `day=${dayKey(start)}`,
    event.allDay ? null : `at=${pad(start.getHours())}:${pad(start.getMinutes())}`,
    `event=${encodeURIComponent(event.id)}`,
  ];
  return `/run/calendar?${parts.filter(Boolean).join('&')}`;
}

export type CalendarFocus = {
  /** Mitternacht des Tages, Ortszeit. */
  day: Date;
  /** Minuten seit Mitternacht, zu denen der Kalender rollt. */
  minutes?: number;
  eventId: string | null;
};

/** Wohin der Kalender beim Oeffnen geht — alles aus der Adresse geprueft, sonst null. */
export function calendarFocusOf(params: {
  day?: string | string[];
  at?: string | string[];
  event?: string | string[];
}): CalendarFocus | null {
  const day = typeof params.day === 'string' ? DAY_PARAM.exec(params.day) : null;
  if (!day) return null;
  const [year, month, date] = [Number(day[1]), Number(day[2]), Number(day[3])];
  const midnight = new Date(year, month - 1, date);
  // Kein 31. Februar: was Date verschiebt, war kein echter Tag.
  if (midnight.getMonth() !== month - 1 || midnight.getDate() !== date) return null;
  const time = typeof params.at === 'string' ? TIME_PARAM.exec(params.at) : null;
  const minutes = time ? Number(time[1]) * 60 + Number(time[2]) : null;
  const valid = minutes !== null && Number(time?.[2]) < 60 && minutes < DAY_MINUTES;
  return {
    day: midnight,
    ...(valid && minutes !== null ? { minutes } : {}),
    eventId: typeof params.event === 'string' && params.event.length > 0 ? params.event : null,
  };
}
