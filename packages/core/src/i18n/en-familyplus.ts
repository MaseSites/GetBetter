import type { deFamilyPlus } from './de-familyplus';

/** BetterFamily: no duplicate items, frequent items, scaled recipes, rotating chores. Complete: a missing key is a type error. */
export const enFamilyPlus: Readonly<Record<keyof typeof deFamilyPlus, string>> = {
  'familyplus.shopping.merged': '{name} was already on the list — now {quantity}',
  'familyplus.shopping.frequent': 'Often bought',
  'familyplus.shopping.addFrequent': 'Add {name} to the list',
  'familyplus.shopping.edit': 'Item',
  'familyplus.shopping.editItem': 'Edit: {name}',
  'familyplus.shopping.name': 'What',
  'familyplus.shopping.quantity': 'Quantity',
  'familyplus.shopping.quantityPlaceholder': 'e.g. 2 or 500 g',
  'familyplus.shopping.category': 'Aisle',
  'familyplus.recipes.shopFor': 'Shop for',
  'familyplus.recipes.fewer': 'One person fewer',
  'familyplus.recipes.more': 'One person more',
  'familyplus.recipes.sent': '{added} new, {merged} already on the list',
  'familyplus.chores.rotation': 'Take turns',
  'familyplus.chores.rotationPick': 'Pick at least two',
};
