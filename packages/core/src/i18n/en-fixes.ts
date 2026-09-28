import type { deFixes } from './de-fixes';

/** Findings from the 24.09. status report — new texts. Complete: a missing key is a type error. */
export const enFixes: Readonly<Record<keyof typeof deFixes, string>> = {
  'fixes.mail.setupTitle': 'Connect a mailbox',
  'fixes.tasks.todayBody': 'Add what’s on for today with the plus.',
  'fixes.tasks.inboxBody': 'Tasks without a date wait here until you plan them.',
  'fixes.notes.emptyBody': 'Write down what’s on your mind — the first line becomes the title.',
  'fixes.notes.emptyTagBody': 'Write #{tag} in a note and it shows up here.',
  'fixes.value.kcalOf': '{kcal} of {target} kcal',
  'fixes.value.kg': '{kg} kg',
  'fixes.value.due': '{count} due',
  'fixes.value.water': '{count} to water',
  'fixes.value.savedOf': '{saved} of {target}',
  'fixes.household.invite': 'Invite',
  'fixes.household.inviteA11y': 'Invite someone to the household',
  'fixes.fit.futureSets': 'You log sets on the day of the workout.',
};
