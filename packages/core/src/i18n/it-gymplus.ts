import type { TranslationKey } from './de';

/** Italienisch: BetterGym und BetterAi, ausgebaut (de-gymplus.ts). Teil von `it`. */
export const itGymPlus = {
  'gymplus.hm': '{hours} h {minutes} min',
  'gymplus.h': '{hours} h',
  'gymplus.m': '{minutes} min',

  'gymplus.sleep.summary': '{average} di media · {debt} di debito',
  'gymplus.sleep.summaryNoDebt': '{average} di media · nessun debito',
  'gymplus.sleep.regularity': 'L’ora di andare a letto varia di {minutes} min',
  'gymplus.sleep.window': 'Le ultime 14 notti, le più recenti contano di più.',
  'gymplus.sleep.catchUp': 'A letto alle {bedtime} stasera recuperi {minutes}.',

  'gymplus.mood.title': 'Cosa ti fa bene',
  'gymplus.mood.workout': 'Nei giorni con allenamento: umore {with} invece di {without}',
  'gymplus.mood.sleep': 'Dopo 7 h di sonno o più: umore {with} invece di {without}',
  'gymplus.mood.water':
    'Nei giorni in cui raggiungi l’obiettivo d’acqua: umore {with} invece di {without}',
  'gymplus.mood.days': '{with} giorni contro {without}',
  'gymplus.mood.note': 'Una correlazione, non una causa.',

  'gymplus.bp.normal': 'Non elevata',
  'gymplus.bp.elevated': 'Elevata',
  'gymplus.bp.hypertension': 'Ipertensione',
  'gymplus.bp.note': 'Una classificazione, non una diagnosi.',

  'gymplus.meds.daysLeft': 'basta ancora {count} giorni',
  'gymplus.meds.daysLeft.one': 'basta ancora 1 giorno',
  'gymplus.meds.empty': 'Scorta esaurita',
  'gymplus.meds.takeAll': 'Tutto preso',
  'gymplus.meds.tookAll': '{count} assunzioni spuntate',
  'gymplus.meds.tookAll.one': '1 assunzione spuntata',

  'gymplus.chats.search': 'Cerca nelle conversazioni',
  'gymplus.chats.noResults': 'Nessun risultato',
  'gymplus.chats.noResultsBody': 'Nessuna conversazione contiene «{query}».',
  'gymplus.chats.pin': 'Fissa',
  'gymplus.chats.unpin': 'Sblocca',
  'gymplus.chats.pinned': 'Fissata',
  'gymplus.chats.rename': 'Rinomina',
  'gymplus.chats.renameTitle': 'Rinomina conversazione',

  'assistant.did.sleep': 'Registrato: {duration} di sonno, {bedtime} – {wake}.',
  'assistant.did.med': 'Spuntato: {name}, {slot}.',
  'assistant.did.medAlready': '{name} è già spuntato per {slot}.',
  'assistant.did.medWhich': 'Quale intendi: {names}?',
  'assistant.did.noMed': 'Non trovo questo farmaco.',
  'assistant.did.mood': 'Annotato: {mood}.',
  'assistant.did.vital': 'Registrato: {kind} {value} {unit}.',} as const satisfies Partial<Record<TranslationKey, string>>;
