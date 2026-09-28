/**
 * BetterGym und BetterAi, ausgebaut (25.09.2026): Schlafschuld, „Was dir
 * guttut“, Blutdruck einordnen, Reichweite der Medikamente, Suche und
 * Anheften in BetterAi, Gesundheit im Assistenten. Teil von `de` per Spread.
 */
export const deGymPlus = {
  'gymplus.hm': '{hours} Std. {minutes} Min.',
  'gymplus.h': '{hours} Std.',
  'gymplus.m': '{minutes} Min.',

  // Schlaf
  'gymplus.sleep.summary': '{average} Schnitt · {debt} Schuld',
  'gymplus.sleep.summaryNoDebt': '{average} Schnitt · keine Schuld',
  'gymplus.sleep.regularity': 'Bettzeit schwankt um {minutes} Min.',
  'gymplus.sleep.window': 'Die letzten 14 Nächte, jüngere zählen mehr.',
  'gymplus.sleep.catchUp': 'Heute {bedtime} ins Bett holt {minutes} auf.',

  // Kopf frei: was dir guttut
  'gymplus.mood.title': 'Was dir guttut',
  'gymplus.mood.workout': 'An Tagen mit Training: Laune {with} statt {without}',
  'gymplus.mood.sleep': 'Nach 7 Std. Schlaf oder mehr: Laune {with} statt {without}',
  'gymplus.mood.water': 'An Tagen mit erreichtem Trinkziel: Laune {with} statt {without}',
  'gymplus.mood.days': '{with} Tage gegen {without}',
  'gymplus.mood.note': 'Ein Zusammenhang, keine Ursache.',

  // Blutdruck
  'gymplus.bp.normal': 'Nicht erhöht',
  'gymplus.bp.elevated': 'Erhöht',
  'gymplus.bp.hypertension': 'Hypertonie',
  'gymplus.bp.note': 'Eine Einordnung, keine Diagnose.',

  // Medikamente
  'gymplus.meds.daysLeft': 'reicht noch {count} Tage',
  'gymplus.meds.daysLeft.one': 'reicht noch 1 Tag',
  'gymplus.meds.empty': 'Vorrat leer',
  'gymplus.meds.takeAll': 'Alle genommen',
  'gymplus.meds.tookAll': '{count} Einnahmen abgehakt',
  'gymplus.meds.tookAll.one': '1 Einnahme abgehakt',

  // BetterAi
  'gymplus.chats.search': 'Gespräche durchsuchen',
  'gymplus.chats.noResults': 'Nichts gefunden',
  'gymplus.chats.noResultsBody': 'Kein Gespräch enthält „{query}“.',
  'gymplus.chats.pin': 'Anheften',
  'gymplus.chats.unpin': 'Lösen',
  'gymplus.chats.pinned': 'Angeheftet',
  'gymplus.chats.rename': 'Umbenennen',
  'gymplus.chats.renameTitle': 'Gespräch umbenennen',

  // Assistent in BetterGym
  'assistant.did.sleep': 'Eingetragen: {duration} geschlafen, {bedtime} – {wake}.',
  'assistant.did.med': 'Abgehakt: {name}, {slot}.',
  'assistant.did.medAlready': '{name} ist für {slot} schon abgehakt.',
  'assistant.did.medWhich': 'Welches meinst du: {names}?',
  'assistant.did.noMed': 'Dieses Medikament finde ich nicht.',
  'assistant.did.mood': 'Festgehalten: {mood}.',
  'assistant.did.vital': 'Eingetragen: {kind} {value} {unit}.',} as const;
