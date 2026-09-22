import type { MealSlot } from '../../db/fitTypes';

/** Better Fit rechnet in Zuerich — derselbe Tag und dieselbe Stunde wie im Dienst. */
const ZONE = 'Europe/Zurich';

/** Der heutige Tag in Zuerich, `YYYY-MM-DD`. */
export function zurichDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE }).format(now);
}

/** Die Stunde in Zuerich (0–23), egal in welcher Zeitzone das Geraet steht. */
export function zurichHour(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const value = Number(hour);
  return Number.isFinite(value) ? value % 24 : now.getHours();
}

/** Die Mahlzeit, die gerade dran ist — damit das Plus meist schon richtig steht. */
export function slotForNow(hour: number = zurichHour()): MealSlot {
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snack';
}

/** Tag ± n, rein als Text — ohne Zeitzone, die den Tag verschieben koennte. */
export function shiftDayKey(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
}
