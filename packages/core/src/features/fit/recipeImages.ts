import type { ImageSourcePropType } from 'react-native';

/**
 * Die Bilder der Rezeptbibliothek, erzeugt mit `scripts/recipe-photos.py`
 * (alle im selben Stil: von oben, Fensterlicht, helles Leinen). Ein eigenes
 * Rezept zeigt das Bild seiner Vorlage (`basedOn`), sonst keins.
 */
const IMAGES: Record<string, ImageSourcePropType> = {
  'banana-bread': require('../../assets/recipes/banana-bread.jpg'),
  'banana-pancakes': require('../../assets/recipes/banana-pancakes.jpg'),
  'porridge-banana': require('../../assets/recipes/porridge-banana.jpg'),
  'quark-berries': require('../../assets/recipes/quark-berries.jpg'),
  'veggie-omelette': require('../../assets/recipes/veggie-omelette.jpg'),
  'rice-chicken-broccoli': require('../../assets/recipes/rice-chicken-broccoli.jpg'),
  'spaghetti-bolognese': require('../../assets/recipes/spaghetti-bolognese.jpg'),
  'pasta-tomato': require('../../assets/recipes/pasta-tomato.jpg'),
  'lentil-curry': require('../../assets/recipes/lentil-curry.jpg'),
  'tofu-stirfry': require('../../assets/recipes/tofu-stirfry.jpg'),
  'salmon-potatoes': require('../../assets/recipes/salmon-potatoes.jpg'),
  'chickpea-salad': require('../../assets/recipes/chickpea-salad.jpg'),
  'scrambled-eggs-bread': require('../../assets/recipes/scrambled-eggs-bread.jpg'),
  'yogurt-muesli': require('../../assets/recipes/yogurt-muesli.jpg'),
  'baked-potato-cottage': require('../../assets/recipes/baked-potato-cottage.jpg'),
  'tuna-salad': require('../../assets/recipes/tuna-salad.jpg'),
  'protein-shake': require('../../assets/recipes/protein-shake.jpg'),
  'tofu-scramble': require('../../assets/recipes/tofu-scramble.jpg'),
  'soy-shake': require('../../assets/recipes/soy-shake.jpg'),
  'apple-almonds': require('../../assets/recipes/apple-almonds.jpg'),
};

/** `lib:rice-chicken-broccoli` → das Bild; eigene Rezepte über ihre Vorlage. */
export function recipeImageFor(recipe: {
  id?: string | null;
  basedOn?: string | null;
  libraryId?: string | null;
}): ImageSourcePropType | null {
  for (const id of [recipe.id, recipe.basedOn, recipe.libraryId]) {
    if (typeof id !== 'string') continue;
    const image = IMAGES[id.replace(/^lib:/, '')];
    if (image) return image;
  }
  return null;
}
