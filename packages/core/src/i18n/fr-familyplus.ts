import type { deFamilyPlus } from './de-familyplus';

/** BetterFamily : courses sans doublons, articles fréquents, recettes recalculées, tâches à tour de rôle. Complete: a missing key is a type error. */
export const frFamilyPlus: Readonly<Record<keyof typeof deFamilyPlus, string>> = {
  'familyplus.shopping.merged': '{name} était déjà sur la liste — maintenant {quantity}',
  'familyplus.shopping.frequent': 'Souvent acheté',
  'familyplus.shopping.addFrequent': 'Ajouter {name} à la liste',
  'familyplus.shopping.edit': 'Article',
  'familyplus.shopping.editItem': 'Modifier : {name}',
  'familyplus.shopping.name': 'Quoi',
  'familyplus.shopping.quantity': 'Quantité',
  'familyplus.shopping.quantityPlaceholder': 'p. ex. 2 ou 500 g',
  'familyplus.shopping.category': 'Rayon',
  'familyplus.recipes.shopFor': 'Acheter pour',
  'familyplus.recipes.fewer': 'Une personne de moins',
  'familyplus.recipes.more': 'Une personne de plus',
  'familyplus.recipes.sent': '{added} nouveaux, {merged} déjà sur la liste',
  'familyplus.chores.rotation': 'À tour de rôle',
  'familyplus.chores.rotationPick': 'Choisis au moins deux personnes',
};
