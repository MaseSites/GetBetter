import type { deFamilyPlus } from './de-familyplus';

/** BetterFamily: spesa senza doppioni, articoli frequenti, ricette ricalcolate, faccende a turno. Complete: a missing key is a type error. */
export const itFamilyPlus: Readonly<Record<keyof typeof deFamilyPlus, string>> = {
  'familyplus.shopping.merged': '{name} era già sulla lista — ora {quantity}',
  'familyplus.shopping.frequent': 'Comprati spesso',
  'familyplus.shopping.addFrequent': 'Aggiungi {name} alla lista',
  'familyplus.shopping.edit': 'Articolo',
  'familyplus.shopping.editItem': 'Modifica: {name}',
  'familyplus.shopping.name': 'Cosa',
  'familyplus.shopping.quantity': 'Quantità',
  'familyplus.shopping.quantityPlaceholder': 'p. es. 2 o 500 g',
  'familyplus.shopping.category': 'Reparto',
  'familyplus.recipes.shopFor': 'Spesa per',
  'familyplus.recipes.fewer': 'Una persona in meno',
  'familyplus.recipes.more': 'Una persona in più',
  'familyplus.recipes.sent': '{added} nuovi, {merged} già sulla lista',
  'familyplus.chores.rotation': 'A turno',
  'familyplus.chores.rotationPick': 'Scegli almeno due persone',
};
