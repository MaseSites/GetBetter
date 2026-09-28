import type { TranslationKey } from './de';

/** Englisch: BetterGym und BetterAi, ausgebaut (de-gymplus.ts). Teil von `en`. */
export const enGymPlus = {
  'gymplus.hm': '{hours} h {minutes} min',
  'gymplus.h': '{hours} h',
  'gymplus.m': '{minutes} min',

  'gymplus.sleep.summary': '{average} average · {debt} debt',
  'gymplus.sleep.summaryNoDebt': '{average} average · no debt',
  'gymplus.sleep.regularity': 'Bedtime varies by {minutes} min',
  'gymplus.sleep.window': 'The last 14 nights, recent ones count more.',
  'gymplus.sleep.catchUp': 'Bed at {bedtime} tonight makes up {minutes}.',

  'gymplus.mood.title': 'What does you good',
  'gymplus.mood.workout': 'On days with a workout: mood {with} instead of {without}',
  'gymplus.mood.sleep': 'After 7 h of sleep or more: mood {with} instead of {without}',
  'gymplus.mood.water': 'On days you hit your water goal: mood {with} instead of {without}',
  'gymplus.mood.days': '{with} days against {without}',
  'gymplus.mood.note': 'A correlation, not a cause.',

  'gymplus.bp.normal': 'Not elevated',
  'gymplus.bp.elevated': 'Elevated',
  'gymplus.bp.hypertension': 'Hypertension',
  'gymplus.bp.note': 'A classification, not a diagnosis.',

  'gymplus.meds.daysLeft': 'lasts {count} more days',
  'gymplus.meds.daysLeft.one': 'lasts 1 more day',
  'gymplus.meds.empty': 'Out of stock',
  'gymplus.meds.takeAll': 'All taken',
  'gymplus.meds.tookAll': '{count} doses checked off',
  'gymplus.meds.tookAll.one': '1 dose checked off',

  'gymplus.chats.search': 'Search chats',
  'gymplus.chats.noResults': 'Nothing found',
  'gymplus.chats.noResultsBody': 'No chat contains “{query}”.',
  'gymplus.chats.pin': 'Pin',
  'gymplus.chats.unpin': 'Unpin',
  'gymplus.chats.pinned': 'Pinned',
  'gymplus.chats.rename': 'Rename',
  'gymplus.chats.renameTitle': 'Rename chat',

  'assistant.did.sleep': 'Logged: slept {duration}, {bedtime} – {wake}.',
  'assistant.did.med': 'Checked off: {name}, {slot}.',
  'assistant.did.medAlready': '{name} is already checked off for {slot}.',
  'assistant.did.medWhich': 'Which one do you mean: {names}?',
  'assistant.did.noMed': 'I can’t find that medication.',
  'assistant.did.mood': 'Noted: {mood}.',
  'assistant.did.vital': 'Logged: {kind} {value} {unit}.',} as const satisfies Partial<Record<TranslationKey, string>>;
