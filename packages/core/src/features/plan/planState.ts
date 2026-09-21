import type { AppId } from '../../app/identity';
import type { TranslationKey } from '../../i18n/de';

/**
 * Wie das Abo-Fenster steht und was es verspricht — reine Rechnung, getestet.
 *
 * - `soon`      — die App hat noch keinen Preis (BetterMoney): kein Knopf
 * - `active`    — das Konto zahlt fuer diese App
 * - `cancelled` — gekuendigt, laeuft aber noch bis zum Stichtag
 * - `pending`   — angefragt, der Admin hat noch nicht entschieden
 * - `available` — „Abo anfragen“
 */
export type PlanState = 'soon' | 'active' | 'cancelled' | 'pending' | 'available';

export function planStateOf({
  priceChf,
  paid,
  pending,
  cancelled = false,
}: {
  priceChf: number | null;
  paid: boolean;
  pending: boolean;
  /** Gekuendigt: bis zum Stichtag laeuft alles weiter. */
  cancelled?: boolean;
}): PlanState {
  if (priceChf === null) return 'soon';
  if (paid) return cancelled ? 'cancelled' : 'active';
  return pending ? 'pending' : 'available';
}

/** Der Wert der Zeile „Abo“ in den Einstellungen. */
export const PLAN_ROW_VALUE: Readonly<Record<PlanState, TranslationKey>> = {
  soon: 'plan.row.soon',
  active: 'plan.row.active',
  cancelled: 'plan.row.cancelled',
  pending: 'plan.row.pending',
  available: 'plan.row.free',
};

export type PlanBenefit = Readonly<{ title: TranslationKey; hint?: TranslationKey }>;

/**
 * Was das Abo bringt, als Liste zum Abhaken — ehrlich und kurz. Die KI hat ein
 * Kontingent, nie „unbegrenzt“. BetterAi fuehrt keinen sprechenden Assistenten:
 * dort fallen Stimme, Name und Avatar weg.
 */
export function planBenefitsOf(appId: AppId): readonly PlanBenefit[] {
  const chats = appId === 'betterai';
  const assistant: readonly PlanBenefit[] = chats
    ? []
    : [
        { title: 'plan.benefit.voices', hint: 'plan.benefit.voices.hint' },
        { title: 'plan.benefit.voicePick' },
        { title: 'plan.benefit.assistantName' },
        { title: 'plan.benefit.avatar' },
      ];
  return [
    { title: chats ? 'plan.benefit.aiChat' : 'plan.benefit.ai', hint: 'plan.benefit.ai.hint' },
    ...assistant,
    { title: 'plan.benefit.accent' },
    { title: 'plan.benefit.preset' },
    { title: 'plan.benefit.backdrop' },
    { title: 'plan.benefit.everywhere', hint: 'plan.benefit.everywhere.hint' },
    { title: 'plan.benefit.cancelAnytime' },
  ];
}
