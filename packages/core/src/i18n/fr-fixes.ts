import type { deFixes } from './de-fixes';

/** Constats du rapport du 24.09. — nouveaux textes. Complete: a missing key is a type error. */
export const frFixes: Readonly<Record<keyof typeof deFixes, string>> = {
  'fixes.mail.setupTitle': 'Connecter une boîte mail',
  'fixes.tasks.todayBody': 'Ajoute ce qui t’attend aujourd’hui avec le plus.',
  'fixes.tasks.inboxBody': 'Les tâches sans date attendent ici jusqu’à ce que tu les planifies.',
  'fixes.notes.emptyBody': 'Note ce qui te passe par la tête — la première ligne devient le titre.',
  'fixes.notes.emptyTagBody': 'Écris #{tag} dans une note, elle apparaîtra ici.',
  'fixes.value.kcalOf': '{kcal} sur {target} kcal',
  'fixes.value.kg': '{kg} kg',
  'fixes.value.due': '{count} à faire',
  'fixes.value.water': '{count} à arroser',
  'fixes.value.savedOf': '{saved} sur {target}',
  'fixes.household.invite': 'Inviter',
  'fixes.household.inviteA11y': 'Inviter quelqu’un dans le ménage',
  'fixes.fit.futureSets': 'Tu notes les séries le jour de l’entraînement.',
};
