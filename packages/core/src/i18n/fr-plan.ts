import type { TranslationKey } from './de';

/** Französisch: Abo, Kontingent und „App ansehen“ (de-plan.ts). Teil von `fr`. */
export const frPlan = {
  'assistant.ai.budgetExhausted': 'Ton quota d’IA pour ce mois est épuisé. Ça reprend le {date}.',
  'assistant.ai.trialExhausted':
    'Ton quota gratuit est épuisé. Avec l’abonnement ({price} par mois), tu peux continuer.',
  'assistant.ai.trialExhaustedSoon':
    'Ton quota gratuit est épuisé. Un abonnement pour cette app arrive bientôt.',
  'assistant.ai.planRequired': 'Je ne regarde les images qu’avec l’abonnement.',

  'assistant.cloud.planRequired': 'Les voix naturelles viennent avec l’abonnement.',
  'assistant.cloud.budgetExhausted':
    'Les voix naturelles sont épuisées pour ce mois — en attendant, c’est le navigateur qui parle.',

  'settings.ai.month': 'IA ce mois-ci',
  'settings.ai.plan.trial': 'Gratuit',
  'settings.ai.plan.paid': 'Abonnement',
  'settings.ai.value': '{plan} · {share} utilisé',
  'settings.ai.hint': 'Le quota d’IA vaut pour cette app et se recharge le {date}.',

  'view.banner': 'Vue de @{username} · lecture seule',
  'view.bannerAnon': 'Vue · lecture seule',
  'view.readOnly': 'Lecture seule',
  'view.expired.title': 'Cette vue a expiré',
  'view.expired.body': 'Le lien ne marche qu’une fois et pendant une minute. Rouvre l’app dans l’admin.',
} as const satisfies Partial<Record<TranslationKey, string>>;
