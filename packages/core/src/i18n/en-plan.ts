import type { TranslationKey } from './de';

/** Englisch: Abo, Kontingent und „App ansehen“ (de-plan.ts). Teil von `en`. */
export const enPlan = {
  'assistant.ai.budgetExhausted': 'Your AI allowance for this month is used up. It continues on {date}.',
  'assistant.ai.trialExhausted':
    'Your free allowance is used up. With the subscription ({price} a month) you can keep going.',
  'assistant.ai.trialExhaustedSoon':
    'Your free allowance is used up. A subscription for this app is coming soon.',
  'assistant.ai.planRequired': 'I only look at pictures with the subscription.',

  'assistant.cloud.planRequired': 'Real voices come with the subscription.',
  'assistant.cloud.budgetExhausted':
    'The real voices are used up for this month — until then, the browser speaks.',

  'settings.ai.month': 'AI this month',
  'settings.ai.plan.trial': 'Free',
  'settings.ai.plan.paid': 'Subscription',
  'settings.ai.value': '{plan} · {share} used',
  'settings.ai.hint': 'The AI allowance applies to this app and is full again on {date}.',

  'view.banner': 'Viewing @{username} · read only',
  'view.bannerAnon': 'Viewing · read only',
  'view.readOnly': 'View only',
  'view.expired.title': 'This view has expired',
  'view.expired.body': 'The link works once and for one minute. Open the app again in the admin.',
} as const satisfies Partial<Record<TranslationKey, string>>;
