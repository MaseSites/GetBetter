import type { TranslationKey } from './de';

/** Französisch: BetterGym und BetterAi, ausgebaut (de-gymplus.ts). Teil von `fr`. */
export const frGymPlus = {
  'gymplus.hm': '{hours} h {minutes} min',
  'gymplus.h': '{hours} h',
  'gymplus.m': '{minutes} min',

  'gymplus.sleep.summary': '{average} en moyenne · {debt} de dette',
  'gymplus.sleep.summaryNoDebt': '{average} en moyenne · pas de dette',
  'gymplus.sleep.regularity': 'L’heure du coucher varie de {minutes} min',
  'gymplus.sleep.window': 'Les 14 dernières nuits, les plus récentes comptent davantage.',
  'gymplus.sleep.catchUp': 'Au lit à {bedtime} ce soir, tu rattrapes {minutes}.',

  'gymplus.mood.title': 'Ce qui te fait du bien',
  'gymplus.mood.workout': 'Les jours avec entraînement : humeur {with} au lieu de {without}',
  'gymplus.mood.sleep': 'Après 7 h de sommeil ou plus : humeur {with} au lieu de {without}',
  'gymplus.mood.water':
    'Les jours où tu atteins ton objectif d’eau : humeur {with} au lieu de {without}',
  'gymplus.mood.days': '{with} jours contre {without}',
  'gymplus.mood.note': 'Un lien, pas une cause.',

  'gymplus.bp.normal': 'Pas élevée',
  'gymplus.bp.elevated': 'Élevée',
  'gymplus.bp.hypertension': 'Hypertension',
  'gymplus.bp.note': 'Une indication, pas un diagnostic.',

  'gymplus.meds.daysLeft': 'suffit encore {count} jours',
  'gymplus.meds.daysLeft.one': 'suffit encore 1 jour',
  'gymplus.meds.empty': 'Stock épuisé',
  'gymplus.meds.takeAll': 'Tout pris',
  'gymplus.meds.tookAll': '{count} prises cochées',
  'gymplus.meds.tookAll.one': '1 prise cochée',

  'gymplus.chats.search': 'Rechercher dans les conversations',
  'gymplus.chats.noResults': 'Rien trouvé',
  'gymplus.chats.noResultsBody': 'Aucune conversation ne contient « {query} ».',
  'gymplus.chats.pin': 'Épingler',
  'gymplus.chats.unpin': 'Détacher',
  'gymplus.chats.pinned': 'Épinglée',
  'gymplus.chats.rename': 'Renommer',
  'gymplus.chats.renameTitle': 'Renommer la conversation',

  'assistant.did.sleep': 'Noté : {duration} de sommeil, {bedtime} – {wake}.',
  'assistant.did.med': 'Coché : {name}, {slot}.',
  'assistant.did.medAlready': '{name} est déjà coché pour {slot}.',
  'assistant.did.medWhich': 'Lequel veux-tu dire : {names} ?',
  'assistant.did.noMed': 'Je ne trouve pas ce médicament.',
  'assistant.did.mood': 'Noté : {mood}.',
  'assistant.did.vital': 'Noté : {kind} {value} {unit}.',} as const satisfies Partial<Record<TranslationKey, string>>;
