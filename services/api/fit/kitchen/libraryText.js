/**
 * Die Rezeptbibliothek auf Franzoesisch, Italienisch und Englisch. Deutsch
 * steht in `library.js` und bleibt die gespeicherte Fassung; uebersetzt wird
 * erst in der Antwort (`localizedTemplate`). Du-Form, Schweizer Gebrauch.
 */
const TEXT = {
  'lib:banana-bread': {
    fr: { title: 'Cake à la banane', steps: ['Préchauffe le four à 180 °C et graisse un moule à cake.', 'Écrase finement les bananes à la fourchette.', 'Fais fondre le beurre, mélange-le avec le sucre, les œufs et le lait, puis ajoute les bananes.', 'Mélange la farine et la poudre à lever et incorpore-les brièvement.', 'Verse dans le moule et fais cuire 50–55 minutes. Vérifie la cuisson avec une aiguille.'] },
    it: { title: 'Cake alla banana', steps: ['Preriscalda il forno a 180 °C e ungi uno stampo da cake.', 'Schiaccia finemente le banane con una forchetta.', 'Sciogli il burro, mescolalo con zucchero, uova e latte, poi aggiungi le banane.', 'Mescola farina e lievito in polvere e incorporali brevemente.', 'Versa nello stampo e cuoci per 50–55 minuti. Fai la prova dello stecchino.'] },
    en: { title: 'Banana bread', steps: ['Preheat the oven to 180 °C and grease a loaf tin.', 'Mash the bananas finely with a fork.', 'Melt the butter, stir in the sugar, eggs and milk, then add the bananas.', 'Mix the flour and baking powder and fold them in briefly.', 'Pour into the tin and bake for 50–55 minutes. Check with a skewer.'] },
  },
  'lib:banana-pancakes': {
    fr: { title: 'Pancakes à la banane', steps: ['Écrase les bananes et mélange-les aux œufs jusqu’à obtenir une pâte lisse.', 'Incorpore la farine et la poudre à lever, laisse gonfler 5 minutes.', 'Chauffe un peu d’huile dans une poêle, mets 2 cs de pâte par pancake.', 'Fais cuire à feu moyen 2 minutes de chaque côté.'] },
    it: { title: 'Pancake alla banana', steps: ['Schiaccia le banane e mescolale con le uova fino a ottenere un composto liscio.', 'Incorpora farina e lievito, lascia riposare 5 minuti.', 'Scalda un po’ d’olio in padella, versa 2 cucchiai di pastella per pancake.', 'Cuoci a fuoco medio 2 minuti per lato.'] },
    en: { title: 'Banana pancakes', steps: ['Mash the bananas and whisk them with the eggs until smooth.', 'Stir in the flour and baking powder, let it rest for 5 minutes.', 'Heat a little oil in a frying pan, add 2 tbsp of batter per pancake.', 'Cook over medium heat for 2 minutes on each side.'] },
  },
  'lib:porridge-banana': {
    fr: { title: 'Porridge à la banane', steps: ['Porte les flocons d’avoine à ébullition avec le lait.', 'Laisse mijoter 4 minutes en remuant.', 'Ajoute la banane en rondelles et, si tu veux, des amandes hachées.'] },
    it: { title: 'Porridge con banana', steps: ['Porta a bollore i fiocchi d’avena con il latte.', 'Lascia sobbollire 4 minuti mescolando.', 'Aggiungi la banana a rondelle e, se vuoi, mandorle tritate.'] },
    en: { title: 'Porridge with banana', steps: ['Bring the oats to the boil with the milk.', 'Simmer for 4 minutes, stirring.', 'Top with sliced banana and, if you like, chopped almonds.'] },
  },
  'lib:quark-berries': {
    fr: { title: 'Séré aux baies', steps: ['Remue le séré jusqu’à ce qu’il soit lisse.', 'Ajoute les baies par-dessus et, si tu veux, sucre avec du miel.'] },
    it: { title: 'Quark con frutti di bosco', steps: ['Mescola il quark finché è liscio.', 'Aggiungi i frutti di bosco e, se vuoi, addolcisci con miele.'] },
    en: { title: 'Quark with berries', steps: ['Stir the quark until smooth.', 'Top with the berries and sweeten with honey if you like.'] },
  },
  'lib:veggie-omelette': {
    fr: { title: 'Omelette aux légumes', steps: ['Coupe le poivron et l’oignon en petits morceaux et fais-les revenir 3 minutes dans l’huile.', 'Bats les œufs avec le sel et verse-les par-dessus.', 'Couvre et laisse prendre 5 minutes à feu doux.'] },
    it: { title: 'Frittata di verdure', steps: ['Taglia a pezzetti peperone e cipolla e falli appassire nell’olio per 3 minuti.', 'Sbatti le uova con il sale e versale sopra.', 'Copri e lascia rapprendere 5 minuti a fuoco basso.'] },
    en: { title: 'Vegetable omelette', steps: ['Chop the pepper and onion and soften them in the oil for 3 minutes.', 'Whisk the eggs with the salt and pour them over.', 'Cover and let it set over low heat for 5 minutes.'] },
  },
  'lib:rice-chicken-broccoli': {
    fr: { title: 'Riz au poulet et brocoli', steps: ['Cuis le riz selon l’emballage.', 'Coupe le poulet en lanières et fais-le dorer 6 minutes dans l’huile.', 'Détaille le brocoli en bouquets, fais-le sauter 4 minutes avec le poulet, déglace à la sauce soja.', 'Sers avec le riz.'] },
    it: { title: 'Riso con pollo e broccoli', steps: ['Cuoci il riso secondo le indicazioni sulla confezione.', 'Taglia il pollo a listarelle e rosolalo nell’olio per 6 minuti.', 'Dividi i broccoli in cimette, saltali 4 minuti con il pollo e sfuma con la salsa di soia.', 'Servi con il riso.'] },
    en: { title: 'Rice with chicken and broccoli', steps: ['Cook the rice as directed on the pack.', 'Cut the chicken into strips and fry in the oil for 6 minutes.', 'Cut the broccoli into florets, fry for 4 minutes with the chicken, deglaze with soy sauce.', 'Serve with the rice.'] },
  },
  'lib:spaghetti-bolognese': {
    fr: { title: 'Spaghetti bolognaise', steps: ['Hache finement l’oignon et la carotte, fais-les revenir dans l’huile.', 'Ajoute la viande hachée et fais-la dorer en l’émiettant.', 'Ajoute la sauce tomate et laisse mijoter 20 minutes.', 'Cuis les spaghetti al dente et sers-les avec la sauce, avec du parmesan si tu veux.'] },
    it: { title: 'Spaghetti alla bolognese', steps: ['Trita finemente cipolla e carota e falle appassire nell’olio.', 'Aggiungi la carne macinata e rosolala sgranandola.', 'Aggiungi la salsa di pomodoro e lascia sobbollire 20 minuti.', 'Cuoci gli spaghetti al dente e servili con il sugo, se vuoi con parmigiano.'] },
    en: { title: 'Spaghetti bolognese', steps: ['Finely chop the onion and carrot and soften them in the oil.', 'Add the mince and fry until crumbly.', 'Add the tomato sauce and simmer for 20 minutes.', 'Cook the spaghetti al dente and serve with the sauce, with parmesan if you like.'] },
  },
  'lib:pasta-tomato': {
    fr: { title: 'Pâtes à la sauce tomate', steps: ['Cuis les pâtes.', 'Fais revenir brièvement l’ail dans l’huile, ajoute la sauce tomate et laisse mijoter 10 minutes.', 'Mélange avec les pâtes.'] },
    it: { title: 'Pasta al pomodoro', steps: ['Cuoci la pasta.', 'Fai soffriggere brevemente l’aglio nell’olio, aggiungi la salsa di pomodoro e lascia sobbollire 10 minuti.', 'Unisci la pasta.'] },
    en: { title: 'Pasta with tomato sauce', steps: ['Cook the pasta.', 'Briefly fry the garlic in the oil, add the tomato sauce and simmer for 10 minutes.', 'Stir in the pasta.'] },
  },
  'lib:lentil-curry': {
    fr: { title: 'Curry de lentilles corail', steps: ['Hache l’oignon et l’ail, fais-les revenir dans l’huile, fais brièvement rôtir le concentré de tomate.', 'Ajoute les lentilles, le bouillon et le lait de coco, laisse mijoter 20 minutes.', 'Cuis le riz et sers-le avec.'] },
    it: { title: 'Curry di lenticchie rosse', steps: ['Trita cipolla e aglio, falli appassire nell’olio e tosta brevemente il concentrato di pomodoro.', 'Aggiungi lenticchie, brodo e latte di cocco e lascia sobbollire 20 minuti.', 'Cuoci il riso e servilo come contorno.'] },
    en: { title: 'Red lentil curry', steps: ['Chop the onion and garlic, soften them in the oil and briefly toast the tomato paste.', 'Add the lentils, stock and coconut milk and simmer for 20 minutes.', 'Cook the rice and serve alongside.'] },
  },
  'lib:tofu-stirfry': {
    fr: { title: 'Poêlée de tofu aux légumes', steps: ['Cuis le riz.', 'Coupe le tofu en dés et fais-le dorer dans l’huile.', 'Ajoute les légumes en lanières, fais-les sauter 5 minutes, déglace à la sauce soja.'] },
    it: { title: 'Padellata di tofu e verdure', steps: ['Cuoci il riso.', 'Taglia il tofu a dadini e rosolalo nell’olio finché è dorato.', 'Aggiungi le verdure a listarelle, saltale 5 minuti e sfuma con la salsa di soia.'] },
    en: { title: 'Tofu and vegetable stir-fry', steps: ['Cook the rice.', 'Dice the tofu and fry it in the oil until golden.', 'Add the vegetables cut into strips, fry for 5 minutes, deglaze with soy sauce.'] },
  },
  'lib:salmon-potatoes': {
    fr: { title: 'Saumon, pommes de terre et épinards', steps: ['Coupe les pommes de terre en quartiers et fais-les cuire 25 minutes au four à 200 °C avec la moitié de l’huile.', 'Ajoute le saumon pour les 12 dernières minutes.', 'Fais tomber les épinards dans le reste de l’huile et arrose-les de citron.'] },
    it: { title: 'Salmone con patate e spinaci', steps: ['Taglia le patate in quarti e cuocile in forno a 200 °C per 25 minuti con metà dell’olio.', 'Aggiungi il salmone negli ultimi 12 minuti.', 'Fai appassire gli spinaci nell’olio rimasto e condiscili con limone.'] },
    en: { title: 'Salmon with potatoes and spinach', steps: ['Quarter the potatoes and roast them at 200 °C for 25 minutes with half of the oil.', 'Add the salmon for the last 12 minutes.', 'Wilt the spinach in the remaining oil and drizzle with lemon.'] },
  },
  'lib:chickpea-salad': {
    fr: { title: 'Salade de pois chiches', steps: ['Coupe les légumes en dés.', 'Mélange-les avec les pois chiches égouttés.', 'Assaisonne avec l’huile et le jus de citron, avec de la feta si tu veux.'] },
    it: { title: 'Insalata di ceci', steps: ['Taglia le verdure a dadini.', 'Mescolale con i ceci scolati.', 'Condisci con olio e succo di limone, se vuoi con feta.'] },
    en: { title: 'Chickpea salad', steps: ['Dice the vegetables.', 'Mix them with the drained chickpeas.', 'Dress with the oil and lemon juice, with feta if you like.'] },
  },
  'lib:scrambled-eggs-bread': {
    fr: { title: 'Œufs brouillés et pain', steps: ['Bats les œufs avec le sel.', 'Fais fondre le beurre et laisse prendre les œufs lentement en remuant.', 'Sers avec le pain.'] },
    it: { title: 'Uova strapazzate con pane', steps: ['Sbatti le uova con il sale.', 'Sciogli il burro e lascia rapprendere le uova lentamente mescolando.', 'Servi con il pane.'] },
    en: { title: 'Scrambled eggs with bread', steps: ['Whisk the eggs with the salt.', 'Melt the butter and let the eggs set slowly while stirring.', 'Serve with the bread.'] },
  },
  'lib:yogurt-muesli': {
    fr: { title: 'Yogourt, birchermüesli et pomme', steps: ['Râpe la pomme.', 'Mélange-la avec le yogourt et le müesli.'] },
    it: { title: 'Yogurt con müesli e mela', steps: ['Grattugia la mela.', 'Mescolala con lo yogurt e il müesli.'] },
    en: { title: 'Yoghurt with muesli and apple', steps: ['Grate the apple.', 'Mix it with the yoghurt and muesli.'] },
  },
  'lib:baked-potato-cottage': {
    fr: { title: 'Pommes de terre au four et cottage cheese', steps: ['Coupe les pommes de terre en deux et fais-les cuire 35 minutes à 200 °C avec l’huile et le sel.', 'Coupe le concombre en dés et mélange-le avec le cottage cheese.', 'Sers avec les pommes de terre.'] },
    it: { title: 'Patate al forno con fiocchi di latte', steps: ['Taglia le patate a metà e cuocile a 200 °C per 35 minuti con olio e sale.', 'Taglia il cetriolo a dadini e mescolalo con i fiocchi di latte.', 'Servi con le patate.'] },
    en: { title: 'Baked potatoes with cottage cheese', steps: ['Halve the potatoes and bake them at 200 °C for 35 minutes with the oil and salt.', 'Dice the cucumber and mix it with the cottage cheese.', 'Serve with the potatoes.'] },
  },
  'lib:tuna-salad': {
    fr: { title: 'Salade de thon au maïs', steps: ['Lave et effeuille la salade.', 'Ajoute le thon, le maïs et la tomate.', 'Assaisonne avec l’huile.'] },
    it: { title: 'Insalata di tonno e mais', steps: ['Lava e sfoglia l’insalata.', 'Aggiungi tonno, mais e pomodoro.', 'Condisci con l’olio.'] },
    en: { title: 'Tuna salad with sweetcorn', steps: ['Wash the lettuce and tear it into pieces.', 'Add the tuna, sweetcorn and tomato.', 'Dress with the oil.'] },
  },
  'lib:protein-shake': {
    fr: { title: 'Shake protéiné à la banane', steps: ['Mixe le tout 20 secondes au blender.'] },
    it: { title: 'Frullato proteico alla banana', steps: ['Frulla tutto nel mixer per 20 secondi.'] },
    en: { title: 'Protein shake with banana', steps: ['Blend everything for 20 seconds.'] },
  },
  'lib:tofu-scramble': {
    fr: { title: 'Tofu brouillé aux épinards', steps: ['Émiette le tofu à la fourchette.', 'Fais-le revenir 5 minutes dans l’huile et sale.', 'Ajoute les épinards et laisse-les tomber.'] },
    it: { title: 'Tofu strapazzato con spinaci', steps: ['Sbriciola il tofu con una forchetta.', 'Rosolalo nell’olio per 5 minuti e sala.', 'Aggiungi gli spinaci e lasciali appassire.'] },
    en: { title: 'Tofu scramble with spinach', steps: ['Crumble the tofu with a fork.', 'Fry it in the oil for 5 minutes and season with salt.', 'Add the spinach and let it wilt.'] },
  },
  'lib:soy-shake': {
    fr: { title: 'Shake au soja et beurre de cacahuète', steps: ['Mixe le tout 20 secondes au blender.'] },
    it: { title: 'Frullato di soia e burro d’arachidi', steps: ['Frulla tutto nel mixer per 20 secondi.'] },
    en: { title: 'Soy shake with peanut butter', steps: ['Blend everything for 20 seconds.'] },
  },
  'lib:apple-almonds': {
    fr: { title: 'Pomme et amandes', steps: ['Coupe la pomme en quartiers et savoure-la avec les amandes.'] },
    it: { title: 'Mela con mandorle', steps: ['Taglia la mela a spicchi e gustala con le mandorle.'] },
    en: { title: 'Apple with almonds', steps: ['Cut the apple into wedges and enjoy it with the almonds.'] },
  },
};

/**
 * Titel und Schritte einer Bibliotheksvorlage in `language`. Eigene Rezepte
 * und Deutsch bleiben, wie sie sind; fehlt eine Uebersetzung, gilt Deutsch.
 */
function localizedTemplate(template, language) {
  const text = TEXT[template?.id]?.[language];
  if (!text) return template;
  return { ...template, title: text.title, steps: text.steps.length === (template.steps ?? []).length ? text.steps : template.steps };
}

module.exports = { LIBRARY_TEXT: TEXT, localizedTemplate };
