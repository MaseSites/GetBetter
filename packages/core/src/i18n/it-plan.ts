import type { TranslationKey } from './de';

/** Italienisch: Abo, Kontingent und „App ansehen“ (de-plan.ts). Teil von `it`. */
export const itPlan = {
  'assistant.ai.budgetExhausted': 'La tua quota di IA per questo mese è esaurita. Si riparte il {date}.',
  'assistant.ai.trialExhausted':
    'La tua quota gratuita è esaurita. Con l’abbonamento ({price} al mese) puoi continuare.',
  'assistant.ai.trialExhaustedSoon':
    'La tua quota gratuita è esaurita. Un abbonamento per questa app arriva presto.',
  'assistant.ai.planRequired': 'Le immagini le guardo solo con l’abbonamento.',

  'assistant.cloud.planRequired': 'Le voci naturali arrivano con l’abbonamento.',
  'assistant.cloud.budgetExhausted':
    'Le voci naturali sono esaurite per questo mese — nel frattempo parla il browser.',

  'settings.ai.month': 'IA questo mese',
  'settings.ai.plan.trial': 'Gratis',
  'settings.ai.plan.paid': 'Abbonamento',
  'settings.ai.value': '{plan} · {share} usato',
  'settings.ai.hint': 'La quota di IA vale per questa app e si ricarica il {date}.',

  'view.banner': 'Vista di @{username} · sola lettura',
  'view.bannerAnon': 'Vista · sola lettura',
  'view.readOnly': 'Sola lettura',
  'view.expired.title': 'Questa vista è scaduta',
  'view.expired.body': 'Il link vale una volta sola e per un minuto. Riapri l’app nell’admin.',
} as const satisfies Partial<Record<TranslationKey, string>>;
