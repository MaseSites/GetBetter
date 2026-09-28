import type { deFixes } from './de-fixes';

/** Riscontri del rapporto del 24.09. — nuovi testi. Complete: a missing key is a type error. */
export const itFixes: Readonly<Record<keyof typeof deFixes, string>> = {
  'fixes.mail.setupTitle': 'Collega una casella',
  'fixes.tasks.todayBody': 'Aggiungi ciò che ti aspetta oggi con il più.',
  'fixes.tasks.inboxBody': 'Le attività senza data aspettano qui finché non le pianifichi.',
  'fixes.notes.emptyBody':
    'Annota ciò che ti passa per la testa — la prima riga diventa il titolo.',
  'fixes.notes.emptyTagBody': 'Scrivi #{tag} in una nota e comparirà qui.',
  'fixes.value.kcalOf': '{kcal} di {target} kcal',
  'fixes.value.kg': '{kg} kg',
  'fixes.value.due': '{count} da fare',
  'fixes.value.water': '{count} da annaffiare',
  'fixes.value.savedOf': '{saved} di {target}',
  'fixes.household.invite': 'Invita',
  'fixes.household.inviteA11y': 'Invita qualcuno nella famiglia',
  'fixes.fit.futureSets': 'Le serie le registri il giorno dell’allenamento.',
};
