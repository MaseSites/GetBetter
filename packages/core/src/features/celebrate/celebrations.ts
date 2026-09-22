import type { IconName } from '../../ui/Icon';

/**
 * Was gefeiert wird, wenn etwas dazukommt: ein Ding faehrt durchs Bild, und
 * die passenden Kleinigkeiten fallen hinein — der Einkaufswagen faengt
 * Bananen, der Kalender bekommt seine Haken.
 *
 * Reine Zuordnung, damit sie sich testen laesst; gezeichnet wird in
 * `CelebrationLayer.tsx`.
 */
export type CelebrationKind =
  | 'shopping'
  | 'chore'
  | 'event'
  | 'task'
  | 'note'
  | 'water'
  | 'workout'
  | 'record'
  | 'money'
  | 'birthday'
  | 'done';

export type Celebration = Readonly<{
  /** Was durchs Bild faehrt. */
  carrier: IconName;
  /** Was hineinfaellt — eins bis drei Dinge. */
  items: readonly IconName[];
}>;

const CELEBRATIONS: Readonly<Record<CelebrationKind, Celebration>> = {
  shopping: { carrier: 'cart', items: ['meal', 'cart', 'sparkles'] },
  chore: { carrier: 'broom', items: ['sparkles', 'check'] },
  event: { carrier: 'calendar', items: ['clock', 'check'] },
  task: { carrier: 'checkCircle', items: ['check', 'sparkles'] },
  note: { carrier: 'note', items: ['lines', 'sparkles'] },
  water: { carrier: 'water', items: ['water', 'water'] },
  workout: { carrier: 'fitness', items: ['flame', 'sparkles'] },
  // Ein neuer Rekord im Training: die Hantel mit einem Stern obendrauf.
  record: { carrier: 'fitness', items: ['starFilled', 'sparkles', 'flame'] },
  money: { carrier: 'wallet', items: ['card', 'chart'] },
  birthday: { carrier: 'gift', items: ['sparkles', 'heart'] },
  done: { carrier: 'checkCircle', items: ['sparkles'] },
};

export function celebrationOf(kind: CelebrationKind): Celebration {
  return CELEBRATIONS[kind];
}

/** Alle Arten — fuer Tests und die Musterseite. */
export const CELEBRATION_KINDS = Object.keys(CELEBRATIONS) as readonly CelebrationKind[];
