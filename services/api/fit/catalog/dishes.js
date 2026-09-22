/**
 * Gerichte, wie sie in der Schweiz auf den Tisch kommen — und was die Kamera
 * daran nicht sieht.
 *
 * Ein Foto zeigt Rösti, nicht die 20 g Butter darin; Älplermagronen, nicht den
 * Rahm. Genau das fehlte dem Benchmark (Öl in 1 von 3 Gerichten genannt,
 * kcal-Verzerrung −31 %). Hier steht darum zu jedem Gericht ein **eigenes,
 * plausibles Standardrezept fuer eine uebliche Portion** — keine Abschrift
 * einer Rezeptseite, sondern gerundete Kuechenpraxis — und daraus ergaenzt die
 * Analyse die stillen Zutaten (Öl, Butter, Rahm, Käse, Zucker).
 *
 * Aufbau einer Zeile:
 *   id | «de|fr|it|en» | weitere Synonyme | [min, typ, max] g | [[Suchbegriff, g], …]
 *
 * Der Suchbegriff ist der deutsche Begriff, den `catalog.match` findet. Was
 * sich nicht finden laesst, faellt still weg — lieber eine Zutat weniger als
 * eine erfundene Zahl.
 */
const { normalize, tokens } = require('./index.js');

/**
 * Zutaten, die auf dem Foto nicht zu sehen sind. Käse zaehlt nur dazu, solange
 * er Beigabe bleibt (hoechstens ein Viertel des Rezepts) — beim Fondue ist er
 * das Gericht selbst und steht sichtbar auf dem Tisch.
 */
const HIDDEN_WORDS = [
  'ol', 'olivenol', 'rapsol', 'sonnenblumenol', 'sesamol', 'bratbutter', 'butter', 'margarine',
  'rahm', 'sahne', 'creme', 'fraiche', 'kokosmilch', 'schmand', 'mayonnaise', 'salatsauce',
  'dressing', 'vinaigrette', 'kase', 'gruyere', 'parmesan', 'mozzarella', 'mascarpone', 'sbrinz',
  'frischkase', 'zucker', 'honig', 'pesto', 'ketchup', 'schmelzkase',
];
/** Ab diesem Anteil am Rezept ist eine Zutat das Gericht, nicht sein Geheimnis. */
const HIDDEN_MAX_SHARE = 0.25;
/** Hoechstens so viele stille Zutaten und hoechstens so viel Masse dazu. */
const MAX_ADDITIONS = 3;
const MAX_ADDED_SHARE = 0.25;
/** Ab hier gilt ein Gericht als erkannt. */
const MIN_DISH_SCORE = 0.75;

const ROWS = [
  // ── Schweizer Küche ────────────────────────────────────────────────────────
  ['roesti', 'Rösti|Rösti|Rösti|Rösti', ['bratkartoffeln', 'hash browns'], [150, 250, 400], [['Kartoffel', 240], ['Butter', 20]]],
  ['aelplermagronen', 'Älplermagronen|Macaronis de l’alpage|Maccheroni dell’alpigiano|Alpine macaroni', ['aelplermakkaroni', 'magronen'], [300, 420, 600], [['Teigwaren', 190], ['Kartoffel', 90], ['Rahm', 60], ['Gruyère', 40], ['Zwiebel', 30], ['Butter', 12]]],
  ['zuercher_geschnetzeltes', 'Zürcher Geschnetzeltes|Émincé de veau à la zurichoise|Spezzatino alla zurighese|Zurich-style veal', ['geschnetzeltes'], [180, 260, 380], [['Kalbfleisch', 140], ['Rahm', 55], ['Champignons', 40], ['Butter', 12], ['Zwiebel', 20]]],
  ['birchermueesli', 'Birchermüesli|Muesli Bircher|Muesli Bircher|Bircher muesli', ['bircher', 'birchermüsli'], [200, 300, 420], [['Haferflocken', 45], ['Milch', 110], ['Joghurt', 80], ['Apfel', 60], ['Honig', 10]]],
  ['kaesefondue', 'Käsefondue|Fondue au fromage|Fonduta di formaggio|Cheese fondue', ['fondue', 'moitié-moitié'], [250, 350, 500], [['Gruyère', 200], ['Brot', 110], ['Weisswein', 50]]],
  ['raclette', 'Raclette|Raclette|Raclette|Raclette', ['racletteteller'], [250, 380, 550], [['Raclettekäse', 200], ['Kartoffel', 250], ['Essiggurken', 25]]],
  ['kaeseschnitte', 'Käseschnitte|Croûte au fromage|Toast al formaggio|Swiss cheese toast', ['chässchnitte'], [180, 260, 360], [['Brot', 80], ['Gruyère', 100], ['Milch', 35], ['Butter', 12]]],
  ['cervelat_kartoffelsalat', 'Cervelat mit Kartoffelsalat|Cervelas et salade de pommes de terre|Cervelat con insalata di patate|Cervelat with potato salad', ['cervelatsalat'], [300, 400, 550], [['Cervelat', 110], ['Kartoffel', 210], ['Rapsöl', 15], ['Zwiebel', 20]]],
  ['hoernli_ghacktem', 'Hörnli mit Ghacktem|Cornettes à la viande hachée|Cornetti con carne macinata|Macaroni with minced beef', ['hörnli und ghackets', 'hörnli mit hackfleisch'], [350, 470, 650], [['Teigwaren', 210], ['Rindshackfleisch', 120], ['Tomatensauce', 100], ['Rapsöl', 10], ['Parmesan', 10]]],
  ['fruechtewaehe', 'Früchtewähe|Gâteau aux fruits|Torta alla frutta|Swiss fruit tart', ['wähe', 'aprikosenwähe', 'zwetschgenwähe', 'apfelwähe'], [120, 180, 280], [['Mehl', 45], ['Butter', 22], ['Rahm', 45], ['Ei', 25], ['Apfel', 70], ['Zucker', 14]]],
  ['zwiebelwaehe', 'Zwiebelwähe|Tarte à l’oignon|Torta di cipolle|Onion tart', ['zwiebelkuchen'], [130, 190, 280], [['Mehl', 45], ['Butter', 22], ['Zwiebel', 90], ['Rahm', 45], ['Ei', 25], ['Speck', 20]]],
  ['zopf', 'Zopf|Tresse|Treccia|Swiss braided bread', ['butterzopf', 'sonntagszopf'], [50, 90, 160], [['Mehl', 55], ['Butter', 9], ['Milch', 25], ['Ei', 5]]],
  ['gipfeli', 'Gipfeli|Croissant|Cornetto|Croissant', ['buttergipfeli', 'croissant'], [40, 60, 95], [['Mehl', 30], ['Butter', 15], ['Milch', 10], ['Zucker', 3]]],
  ['spaetzli', 'Spätzli|Spätzli|Spätzle|Spaetzle', ['knöpfli', 'spätzle'], [150, 230, 340], [['Mehl', 90], ['Ei', 50], ['Milch', 40], ['Butter', 15]]],
  ['bratwurst_roesti', 'Bratwurst mit Rösti|Saucisse grillée et rösti|Salsiccia con rösti|Bratwurst with rösti', ['schüblig mit rösti'], [350, 460, 620], [['Bratwurst', 140], ['Kartoffel', 240], ['Butter', 20], ['Zwiebelsauce', 60]]],
  ['papet_vaudois', 'Papet vaudois|Papet vaudois|Papet vodese|Leek and potato stew with sausage', ['papet'], [350, 460, 620], [['Lauch', 200], ['Kartoffel', 170], ['Saucisson', 110], ['Rahm', 40], ['Butter', 12]]],
  ['berner_platte', 'Berner Platte|Assiette bernoise|Piatto bernese|Bernese platter', [], [400, 560, 800], [['Schweinefleisch', 150], ['Speck', 60], ['Sauerkraut', 190], ['Kartoffel', 150], ['Bohnen', 70]]],
  ['gerstensuppe', 'Bündner Gerstensuppe|Soupe d’orge des Grisons|Zuppa d’orzo grigionese|Grisons barley soup', ['gerstensuppe'], [250, 350, 470], [['Rollgerste', 35], ['Bouillon', 230], ['Karotte', 40], ['Lauch', 30], ['Bündnerfleisch', 20], ['Rahm', 30]]],
  ['capuns', 'Capuns|Capuns|Capuns|Capuns', [], [200, 300, 420], [['Mehl', 60], ['Ei', 30], ['Salsiz', 40], ['Mangold', 60], ['Rahm', 50], ['Bergkäse', 25]]],
  ['pizzoccheri', 'Pizzoccheri|Pizzoccheri|Pizzoccheri|Pizzoccheri', [], [280, 380, 520], [['Teigwaren', 180], ['Wirz', 80], ['Kartoffel', 70], ['Bergkäse', 45], ['Butter', 25]]],
  ['polenta_braten', 'Polenta mit Braten|Polenta et rôti|Polenta con arrosto|Polenta with roast', ['polenta'], [300, 420, 570], [['Maisgriess', 60], ['Milch', 120], ['Rindfleisch', 120], ['Butter', 15], ['Gruyère', 15]]],
  ['chuegelipastete', 'Luzerner Chügelipastete|Vol-au-vent lucernois|Pasticcio lucernese|Lucerne meat vol-au-vent', ['pastetli', 'vol-au-vent'], [220, 320, 450], [['Blätterteig', 90], ['Kalbfleisch', 90], ['Champignons', 40], ['Rahm', 60], ['Butter', 12]]],
  ['fleischkaese_pommes', 'Fleischkäse mit Pommes|Fromage d’Italie et frites|Leberkäse con patatine|Meatloaf with fries', ['fleischkäse'], [300, 420, 560], [['Fleischkäse', 150], ['Pommes frites', 180], ['Rapsöl', 15], ['Ketchup', 20]]],
  ['schnitzel_pommes', 'Schnitzel mit Pommes|Escalope et frites|Cotoletta con patatine|Schnitzel with fries', ['paniertes schnitzel'], [320, 440, 600], [['Schweinefleisch', 130], ['Paniermehl', 25], ['Ei', 15], ['Pommes frites', 180], ['Rapsöl', 25]]],
  ['cordon_bleu', 'Cordon bleu|Cordon bleu|Cordon bleu|Cordon bleu', [], [320, 450, 620], [['Schweinefleisch', 150], ['Schinken', 25], ['Gruyère', 30], ['Paniermehl', 25], ['Rapsöl', 25], ['Pommes frites', 160]]],
  ['fischknusperli', 'Fischknusperli mit Pommes|Beignets de poisson et frites|Bocconcini di pesce con patatine|Fish bites with fries', ['fischknusperli'], [280, 400, 540], [['Fisch', 140], ['Mehl', 25], ['Pommes frites', 160], ['Rapsöl', 25], ['Mayonnaise', 20]]],
  ['eglifilet', 'Eglifilet mit Kartoffeln|Filets de perche et pommes de terre|Filetti di persico con patate|Perch fillet with potatoes', ['eglifilets', 'felchenfilet'], [280, 380, 520], [['Fisch', 150], ['Kartoffel', 180], ['Butter', 20], ['Zitrone', 15]]],
  ['rindsvoressen', 'Rindsvoressen|Ragoût de bœuf|Spezzatino di manzo|Beef stew', ['voressen', 'rindsragout'], [280, 400, 550], [['Rindfleisch', 160], ['Rotwein', 60], ['Karotte', 50], ['Zwiebel', 30], ['Rapsöl', 12], ['Mehl', 10]]],
  ['kalbsbratwurst', 'Kalbsbratwurst mit Zwiebelsauce|Saucisse de veau et sauce à l’oignon|Salsiccia di vitello con salsa di cipolle|Veal sausage with onion sauce', ['bratwurst mit zwiebelsauce'], [250, 350, 480], [['Kalbsbratwurst', 140], ['Zwiebel', 70], ['Rahm', 40], ['Butter', 15], ['Bouillon', 80]]],
  ['malakoff', 'Malakoff|Malakoff|Malakoff|Malakoff', ['käsekrapfen'], [120, 180, 260], [['Gruyère', 90], ['Brot', 45], ['Ei', 20], ['Rapsöl', 20]]],
  ['tartiflette', 'Tartiflette|Tartiflette|Tartiflette|Tartiflette', [], [280, 400, 550], [['Kartoffel', 240], ['Speck', 50], ['Zwiebel', 40], ['Käse', 60], ['Rahm', 40]]],
  ['rueeblitorte', 'Rüeblitorte|Gâteau aux carottes|Torta di carote|Carrot cake', ['karottenkuchen', 'carrot cake'], [80, 120, 180], [['Karotte', 35], ['Mandeln', 30], ['Zucker', 30], ['Ei', 25], ['Mehl', 15]]],
  ['nusstorte', 'Bündner Nusstorte|Tourte aux noix des Grisons|Torta di noci grigionese|Grisons nut tart', ['nusstorte'], [70, 110, 160], [['Baumnüsse', 35], ['Zucker', 30], ['Rahm', 20], ['Mehl', 25], ['Butter', 15]]],
  ['basler_leckerli', 'Basler Läckerli|Läckerli de Bâle|Leckerli di Basilea|Basel spice biscuits', ['läckerli', 'leckerli'], [20, 40, 80], [['Honig', 12], ['Mehl', 14], ['Mandeln', 8], ['Zucker', 8]]],
  ['vermicelles', 'Vermicelles|Vermicelles|Vermicelles|Chestnut vermicelles', ['marronivermicelles'], [130, 200, 300], [['Marroni', 110], ['Rahm', 50], ['Meringue', 25], ['Zucker', 15]]],

  // ── Teigwaren, Pizza, Italien ──────────────────────────────────────────────
  ['spaghetti_bolognese', 'Spaghetti Bolognese|Spaghettis à la bolognaise|Spaghetti alla bolognese|Spaghetti bolognese', ['pasta bolognese', 'spaghetti bolo'], [320, 450, 620], [['Teigwaren', 220], ['Rindshackfleisch', 110], ['Tomatensauce', 120], ['Olivenöl', 12], ['Parmesan', 12], ['Zwiebel', 25]]],
  ['spaghetti_carbonara', 'Spaghetti Carbonara|Spaghettis à la carbonara|Spaghetti alla carbonara|Spaghetti carbonara', ['pasta carbonara'], [300, 420, 570], [['Teigwaren', 230], ['Speck', 55], ['Ei', 50], ['Parmesan', 30], ['Olivenöl', 10]]],
  ['spaghetti_napoli', 'Spaghetti Napoli|Spaghettis à la napolitaine|Spaghetti alla napoletana|Spaghetti napoli', ['pasta napoli', 'spaghetti tomatensauce'], [300, 420, 570], [['Teigwaren', 230], ['Tomatensauce', 150], ['Olivenöl', 14], ['Parmesan', 12]]],
  ['spaghetti_aglio_olio', 'Spaghetti Aglio e Olio|Spaghettis à l’ail et à l’huile|Spaghetti aglio e olio|Spaghetti aglio e olio', [], [260, 360, 500], [['Teigwaren', 230], ['Olivenöl', 25], ['Knoblauch', 8], ['Parmesan', 12]]],
  ['penne_arrabbiata', 'Penne all’Arrabbiata|Penne à l’arrabbiata|Penne all’arrabbiata|Penne arrabbiata', ['penne scharf'], [300, 420, 570], [['Teigwaren', 230], ['Tomatensauce', 150], ['Olivenöl', 18], ['Peperoncini', 5], ['Parmesan', 10]]],
  ['penne_gorgonzola', 'Penne mit Gorgonzolasauce|Penne au gorgonzola|Penne al gorgonzola|Penne with gorgonzola', ['pasta gorgonzola'], [300, 420, 570], [['Teigwaren', 230], ['Rahm', 80], ['Käse', 45], ['Butter', 10]]],
  ['lasagne', 'Lasagne|Lasagnes|Lasagne|Lasagne', ['lasagne bolognese', 'lasagna'], [250, 380, 520], [['Teigwaren', 90], ['Rindshackfleisch', 100], ['Tomatensauce', 110], ['Milch', 70], ['Käse', 40], ['Butter', 15]]],
  ['lasagne_gemuese', 'Gemüselasagne|Lasagnes aux légumes|Lasagne vegetariane|Vegetable lasagne', ['vegetarische lasagne'], [250, 380, 520], [['Teigwaren', 90], ['Zucchetti', 110], ['Tomatensauce', 110], ['Milch', 70], ['Käse', 40], ['Olivenöl', 15]]],
  ['ravioli_salbeibutter', 'Ravioli an Salbeibutter|Raviolis au beurre de sauge|Ravioli al burro e salvia|Ravioli with sage butter', ['ravioli'], [220, 320, 450], [['Ravioli', 250], ['Butter', 25], ['Parmesan', 18]]],
  ['tortellini_rahmsauce', 'Tortellini an Rahmsauce|Tortellinis à la crème|Tortellini alla panna|Tortellini in cream sauce', ['tortellini panna'], [250, 350, 480], [['Tortellini', 220], ['Rahm', 90], ['Parmesan', 18], ['Butter', 10]]],
  ['gnocchi_gorgonzola', 'Gnocchi an Käsesauce|Gnocchis au fromage|Gnocchi al formaggio|Gnocchi in cheese sauce', ['gnocchi'], [250, 360, 500], [['Gnocchi', 250], ['Rahm', 80], ['Käse', 45], ['Butter', 10]]],
  ['risotto_pilze', 'Pilzrisotto|Risotto aux champignons|Risotto ai funghi|Mushroom risotto', ['risotto mit pilzen'], [280, 400, 550], [['Reis', 85], ['Champignons', 90], ['Bouillon', 180], ['Parmesan', 25], ['Butter', 20], ['Olivenöl', 10]]],
  ['risotto_safran', 'Safranrisotto|Risotto au safran|Risotto allo zafferano|Saffron risotto', ['risotto milanese'], [280, 400, 550], [['Reis', 90], ['Bouillon', 200], ['Parmesan', 28], ['Butter', 22], ['Zwiebel', 25]]],
  ['pizza_margherita', 'Pizza Margherita|Pizza margherita|Pizza margherita|Margherita pizza', ['pizza'], [250, 380, 550], [['Mehl', 170], ['Tomatensauce', 90], ['Mozzarella', 90], ['Olivenöl', 15]]],
  ['pizza_prosciutto', 'Pizza Prosciutto|Pizza au jambon|Pizza al prosciutto|Ham pizza', ['pizza schinken'], [280, 400, 570], [['Mehl', 170], ['Tomatensauce', 90], ['Mozzarella', 90], ['Schinken', 45], ['Olivenöl', 15]]],
  ['pizza_salami', 'Pizza Salami|Pizza au salami|Pizza al salame|Salami pizza', [], [280, 400, 570], [['Mehl', 170], ['Tomatensauce', 90], ['Mozzarella', 90], ['Salami', 45], ['Olivenöl', 15]]],
  ['pizza_quattro_stagioni', 'Pizza Quattro Stagioni|Pizza quatre saisons|Pizza quattro stagioni|Four seasons pizza', ['pizza quattro formaggi'], [300, 430, 600], [['Mehl', 170], ['Tomatensauce', 90], ['Mozzarella', 90], ['Champignons', 40], ['Schinken', 35], ['Olivenöl', 15]]],
  ['calzone', 'Calzone|Calzone|Calzone|Calzone', [], [250, 360, 500], [['Mehl', 160], ['Tomatensauce', 70], ['Mozzarella', 80], ['Schinken', 40], ['Olivenöl', 15]]],
  ['melanzane_parmigiana', 'Auberginen-Auflauf|Aubergines au parmesan|Melanzane alla parmigiana|Eggplant parmigiana', ['parmigiana'], [250, 350, 480], [['Aubergine', 220], ['Tomatensauce', 110], ['Mozzarella', 55], ['Parmesan', 20], ['Olivenöl', 25]]],
  ['ossobuco', 'Ossobuco|Osso-buco|Ossobuco|Ossobuco', [], [250, 350, 480], [['Kalbfleisch', 190], ['Tomatensauce', 70], ['Karotte', 40], ['Weisswein', 50], ['Olivenöl', 15], ['Mehl', 10]]],
  ['piccata_milanese', 'Piccata milanese|Piccata milanaise|Piccata milanese|Piccata milanese', [], [280, 400, 550], [['Kalbfleisch', 130], ['Ei', 30], ['Parmesan', 20], ['Teigwaren', 180], ['Butter', 18]]],
  ['vitello_tonnato', 'Vitello tonnato|Vitello tonnato|Vitello tonnato|Vitello tonnato', [], [180, 260, 360], [['Kalbfleisch', 130], ['Thon', 40], ['Mayonnaise', 50], ['Kapern', 8]]],

  // ── Fleisch, Beilagen, Schnelles ───────────────────────────────────────────
  ['poulet_reis_gemuese', 'Poulet mit Reis und Gemüse|Poulet avec riz et légumes|Pollo con riso e verdure|Chicken with rice and vegetables', ['pouletbrust mit reis'], [330, 450, 620], [['Poulet', 140], ['Reis', 180], ['Gemüse', 110], ['Rapsöl', 12]]],
  ['pouletcurry_reis', 'Pouletcurry mit Reis|Curry de poulet au riz|Curry di pollo con riso|Chicken curry with rice', ['hühnercurry', 'poulet curry'], [350, 480, 650], [['Poulet', 130], ['Reis', 180], ['Kokosmilch', 90], ['Currypaste', 15], ['Rapsöl', 12]]],
  ['poulet_fluegel', 'Pouletflügeli|Ailes de poulet|Alette di pollo|Chicken wings', ['chicken wings', 'pouletflügel'], [150, 250, 400], [['Poulet', 220], ['Rapsöl', 18], ['Ketchup', 25]]],
  ['rindsfilet_gratin', 'Rindsfilet mit Kartoffelgratin|Filet de bœuf et gratin de pommes de terre|Filetto di manzo con gratin di patate|Beef fillet with potato gratin', ['rindsfilet'], [320, 450, 620], [['Rindfleisch', 160], ['Kartoffel', 200], ['Rahm', 70], ['Butter', 15], ['Gruyère', 25]]],
  ['kartoffelgratin', 'Kartoffelgratin|Gratin dauphinois|Gratin di patate|Potato gratin', ['gratin dauphinois'], [180, 260, 380], [['Kartoffel', 210], ['Rahm', 70], ['Milch', 40], ['Gruyère', 25], ['Butter', 10]]],
  ['kartoffelstock', 'Kartoffelstock mit Bratwurst|Purée et saucisse|Purè con salsiccia|Mashed potatoes with sausage', ['kartoffelpüree', 'stock mit wurst'], [300, 420, 570], [['Kartoffel', 230], ['Milch', 60], ['Butter', 20], ['Bratwurst', 130]]],
  ['pommes_frites', 'Pommes frites|Frites|Patatine fritte|French fries', ['fritten', 'pommes'], [100, 180, 300], [['Kartoffel', 240], ['Rapsöl', 20], ['Ketchup', 20]]],
  ['hamburger', 'Hamburger|Hamburger|Hamburger|Hamburger', ['burger'], [180, 260, 380], [['Burgerbrötchen', 75], ['Rindshackfleisch', 120], ['Tomate', 25], ['Kopfsalat', 15], ['Mayonnaise', 20], ['Ketchup', 15]]],
  ['cheeseburger', 'Cheeseburger|Cheeseburger|Cheeseburger|Cheeseburger', [], [190, 280, 400], [['Burgerbrötchen', 75], ['Rindshackfleisch', 120], ['Käse', 25], ['Tomate', 25], ['Mayonnaise', 20]]],
  ['hot_dog', 'Hot Dog|Hot-dog|Hot dog|Hot dog', ['hotdog'], [120, 180, 260], [['Brötchen', 70], ['Wienerli', 80], ['Ketchup', 15], ['Senf', 10]]],
  ['doener_kebab', 'Döner Kebab|Kebab|Kebab|Doner kebab', ['kebab', 'döner'], [300, 420, 600], [['Fladenbrot', 130], ['Kalbfleisch', 130], ['Kopfsalat', 50], ['Tomate', 40], ['Joghurtsauce', 50], ['Rapsöl', 10]]],
  ['duerum', 'Dürüm|Dürüm|Dürüm|Durum wrap', ['wrap', 'yufka'], [280, 380, 520], [['Tortilla', 110], ['Poulet', 110], ['Kopfsalat', 45], ['Tomate', 35], ['Joghurtsauce', 45]]],
  ['falafel_teller', 'Falafel-Teller|Assiette de falafels|Piatto di falafel|Falafel plate', ['falafel'], [280, 380, 520], [['Kichererbsen', 150], ['Rapsöl', 25], ['Hummus', 60], ['Tomate', 50], ['Fladenbrot', 70]]],
  ['chicken_nuggets', 'Chicken Nuggets|Nuggets de poulet|Nugget di pollo|Chicken nuggets', ['nuggets'], [100, 170, 280], [['Poulet', 130], ['Paniermehl', 30], ['Rapsöl', 20], ['Ketchup', 20]]],
  ['schweinsbraten', 'Schweinsbraten|Rôti de porc|Arrosto di maiale|Roast pork', ['braten'], [250, 350, 480], [['Schweinefleisch', 180], ['Kartoffel', 150], ['Rapsöl', 12], ['Mehl', 8]]],
  ['lammkoteletts', 'Lammkoteletts|Côtelettes d’agneau|Costolette d’agnello|Lamb chops', ['lammkotelett'], [200, 300, 420], [['Lamm', 190], ['Olivenöl', 15], ['Kartoffel', 120]]],
  ['entrecote_pommes', 'Entrecôte mit Pommes|Entrecôte et frites|Entrecôte con patatine|Steak with fries', ['steak frites', 'entrecôte'], [300, 430, 600], [['Rindfleisch', 180], ['Pommes frites', 180], ['Butter', 20], ['Rapsöl', 10]]],
  ['wiener_schnitzel', 'Wiener Schnitzel|Escalope viennoise|Cotoletta alla milanese|Wiener schnitzel', [], [250, 350, 480], [['Kalbfleisch', 140], ['Paniermehl', 28], ['Ei', 18], ['Butter', 25]]],
  ['gulasch', 'Gulasch|Goulasch|Gulasch|Goulash', ['rindsgulasch'], [280, 400, 550], [['Rindfleisch', 170], ['Zwiebel', 60], ['Tomatensauce', 70], ['Rapsöl', 15], ['Rahm', 30]]],
  ['chili_con_carne', 'Chili con Carne|Chili con carne|Chili con carne|Chili con carne', ['chili'], [300, 420, 570], [['Rindshackfleisch', 130], ['Bohnen', 120], ['Tomatensauce', 120], ['Mais', 50], ['Rapsöl', 12]]],
  ['hacktaetschli', 'Hacktätschli|Boulettes de viande|Polpette|Meat patties', ['fleischküchli', 'frikadellen', 'hackbraten'], [200, 300, 420], [['Rindshackfleisch', 170], ['Ei', 20], ['Paniermehl', 20], ['Zwiebel', 25], ['Rapsöl', 15]]],
  ['spare_ribs', 'Spareribs|Travers de porc|Costine di maiale|Spare ribs', ['rippli', 'ribs'], [250, 380, 550], [['Schweinefleisch', 300], ['Ketchup', 40], ['Honig', 15], ['Rapsöl', 10]]],

  // ── Suppen und Eintöpfe ────────────────────────────────────────────────────
  ['tomatensuppe', 'Tomatensuppe|Soupe de tomates|Zuppa di pomodoro|Tomato soup', [], [250, 330, 450], [['Tomate', 240], ['Bouillon', 120], ['Rahm', 35], ['Olivenöl', 10]]],
  ['kuerbissuppe', 'Kürbissuppe|Soupe de courge|Zuppa di zucca|Pumpkin soup', ['kürbiscremesuppe'], [250, 330, 450], [['Kürbis', 250], ['Bouillon', 110], ['Rahm', 40], ['Butter', 10]]],
  ['gemuesesuppe', 'Gemüsesuppe|Soupe de légumes|Zuppa di verdure|Vegetable soup', [], [250, 350, 470], [['Gemüse', 200], ['Bouillon', 180], ['Kartoffel', 60], ['Olivenöl', 8]]],
  ['kartoffelsuppe', 'Kartoffelsuppe|Soupe de pommes de terre|Zuppa di patate|Potato soup', [], [250, 350, 470], [['Kartoffel', 200], ['Bouillon', 150], ['Rahm', 40], ['Speck', 20]]],
  ['linsensuppe', 'Linsensuppe|Soupe de lentilles|Zuppa di lenticchie|Lentil soup', ['linseneintopf'], [250, 360, 490], [['Linsen', 70], ['Bouillon', 220], ['Karotte', 50], ['Speck', 25], ['Olivenöl', 10]]],
  ['minestrone', 'Minestrone|Minestrone|Minestrone|Minestrone', [], [250, 360, 490], [['Gemüse', 190], ['Bouillon', 170], ['Teigwaren', 40], ['Bohnen', 40], ['Olivenöl', 12], ['Parmesan', 10]]],
  ['gulaschsuppe', 'Gulaschsuppe|Soupe goulasch|Zuppa di gulasch|Goulash soup', [], [250, 360, 490], [['Rindfleisch', 90], ['Bouillon', 200], ['Kartoffel', 70], ['Tomatensauce', 60], ['Rapsöl', 10]]],
  ['ramen', 'Ramen|Ramen|Ramen|Ramen', ['ramen suppe'], [400, 550, 750], [['Teigwaren', 180], ['Bouillon', 300], ['Schweinefleisch', 70], ['Ei', 50], ['Sesamöl', 8]]],
  ['pho', 'Pho|Pho|Pho|Pho', ['pho bo', 'vietnamesische suppe'], [400, 550, 750], [['Reisnudeln', 170], ['Bouillon', 320], ['Rindfleisch', 70], ['Sojasauce', 12]]],
  ['tom_kha_gai', 'Tom Kha Gai|Tom kha gai|Tom kha gai|Tom kha gai', ['kokossuppe'], [250, 360, 490], [['Poulet', 90], ['Kokosmilch', 130], ['Bouillon', 110], ['Champignons', 40]]],

  // ── Frühstück, Brot, Gebäck ────────────────────────────────────────────────
  ['mueesli_joghurt', 'Müesli mit Joghurt|Muesli au yogourt|Muesli con yogurt|Muesli with yogurt', ['müsli mit joghurt', 'müesli'], [200, 300, 420], [['Müesli', 60], ['Joghurt', 150], ['Banane', 70], ['Honig', 10]]],
  ['porridge', 'Porridge|Porridge|Porridge|Porridge', ['haferbrei', 'overnight oats'], [200, 300, 420], [['Haferflocken', 60], ['Milch', 200], ['Banane', 60], ['Honig', 10]]],
  ['butterbrot_konfi', 'Brot mit Butter und Konfitüre|Tartine beurre-confiture|Pane con burro e marmellata|Bread with butter and jam', ['butterbrot', 'tartine'], [60, 100, 170], [['Brot', 60], ['Butter', 12], ['Konfitüre', 20]]],
  ['ruehrei_speck', 'Rührei mit Speck|Œufs brouillés au lard|Uova strapazzate con pancetta|Scrambled eggs with bacon', ['rührei'], [150, 230, 340], [['Ei', 120], ['Speck', 40], ['Butter', 12], ['Milch', 25]]],
  ['spiegelei_speck', 'Spiegelei mit Speck|Œufs au plat et lard|Uova al tegamino con pancetta|Fried eggs with bacon', ['spiegeleier'], [140, 210, 320], [['Ei', 110], ['Speck', 40], ['Butter', 10]]],
  ['omelette_kaese', 'Käseomelette|Omelette au fromage|Frittata al formaggio|Cheese omelette', ['omelette'], [150, 220, 320], [['Ei', 130], ['Käse', 35], ['Butter', 12], ['Milch', 25]]],
  ['french_toast', 'Fotzelschnitten|Pain perdu|Pane dorato|French toast', ['french toast', 'arme ritter'], [150, 230, 340], [['Brot', 90], ['Ei', 55], ['Milch', 60], ['Butter', 15], ['Zucker', 12]]],
  ['pancakes', 'Pancakes|Pancakes|Pancake|Pancakes', ['omeletten', 'eierkuchen'], [150, 230, 340], [['Mehl', 70], ['Milch', 110], ['Ei', 40], ['Butter', 15], ['Zucker', 12]]],
  ['nussgipfel', 'Nussgipfel|Croissant aux noix|Cornetto alle noci|Nut croissant', [], [70, 110, 160], [['Mehl', 45], ['Butter', 18], ['Baumnüsse', 25], ['Zucker', 15]]],
  ['schinkengipfel', 'Schinkengipfel|Croissant au jambon|Cornetto al prosciutto|Ham croissant', ['schinkencroissant'], [70, 110, 160], [['Blätterteig', 60], ['Schinken', 35], ['Käse', 15], ['Butter', 10]]],
  ['sandwich_schinken', 'Sandwich mit Schinken|Sandwich au jambon|Panino al prosciutto|Ham sandwich', ['schinkensandwich', 'schinkenbrot'], [120, 180, 260], [['Brot', 100], ['Schinken', 45], ['Butter', 12], ['Käse', 20]]],
  ['sandwich_thon', 'Thonsandwich|Sandwich au thon|Panino al tonno|Tuna sandwich', ['thunfischsandwich'], [130, 190, 270], [['Brot', 100], ['Thon', 55], ['Mayonnaise', 25], ['Kopfsalat', 15]]],
  ['toast_hawaii', 'Toast Hawaii|Toast hawaïen|Toast hawaii|Hawaii toast', [], [130, 190, 270], [['Toastbrot', 60], ['Schinken', 35], ['Ananas', 40], ['Käse', 35], ['Butter', 8]]],
  ['granola_joghurt', 'Granola mit Joghurt|Granola au yogourt|Granola con yogurt|Granola with yogurt', ['granola'], [180, 270, 380], [['Müesli', 55], ['Joghurt', 160], ['Heidelbeeren', 45], ['Honig', 10]]],
  ['smoothie_bowl', 'Smoothie Bowl|Smoothie bowl|Smoothie bowl|Smoothie bowl', ['acai bowl'], [250, 350, 480], [['Banane', 120], ['Heidelbeeren', 80], ['Joghurt', 90], ['Haferflocken', 25], ['Honig', 10]]],
  ['protein_shake', 'Proteinshake|Shake protéiné|Frullato proteico|Protein shake', ['eiweissshake', 'whey shake'], [250, 350, 500], [['Proteinpulver', 30], ['Milch', 300], ['Banane', 70]]],

  // ── Salate und Bowls ───────────────────────────────────────────────────────
  ['gemischter_salat', 'Gemischter Salat|Salade mêlée|Insalata mista|Mixed salad', ['salatteller', 'blattsalat'], [80, 140, 250], [['Kopfsalat', 70], ['Tomate', 40], ['Karotte', 25], ['Salatsauce', 25]]],
  ['gruener_salat', 'Grüner Salat|Salade verte|Insalata verde|Green salad', ['grüner blattsalat'], [60, 110, 200], [['Kopfsalat', 90], ['Salatsauce', 22]]],
  ['nuesslisalat_ei', 'Nüsslisalat mit Ei|Doucette aux œufs|Valeriana con uovo|Lamb’s lettuce with egg', ['nüsslisalat'], [100, 170, 280], [['Nüsslisalat', 70], ['Ei', 55], ['Speck', 20], ['Salatsauce', 25]]],
  ['caesar_salat', 'Caesar Salat|Salade César|Insalata Caesar|Caesar salad', ['caesar salad'], [200, 300, 420], [['Kopfsalat', 130], ['Poulet', 90], ['Parmesan', 20], ['Croûtons', 25], ['Mayonnaise', 35]]],
  ['griechischer_salat', 'Griechischer Salat|Salade grecque|Insalata greca|Greek salad', ['bauernsalat'], [200, 300, 420], [['Tomate', 120], ['Gurke', 80], ['Feta', 55], ['Oliven', 30], ['Olivenöl', 18]]],
  ['thunfischsalat', 'Thonsalat|Salade au thon|Insalata di tonno|Tuna salad', ['thunfischsalat'], [180, 280, 400], [['Kopfsalat', 110], ['Thon', 80], ['Mais', 40], ['Tomate', 40], ['Salatsauce', 25]]],
  ['pouletsalat', 'Pouletsalat|Salade au poulet|Insalata di pollo|Chicken salad', ['hähnchensalat'], [200, 300, 420], [['Kopfsalat', 120], ['Poulet', 110], ['Tomate', 45], ['Salatsauce', 28]]],
  ['pastasalat', 'Pastasalat|Salade de pâtes|Insalata di pasta|Pasta salad', ['nudelsalat', 'teigwarensalat'], [200, 300, 420], [['Teigwaren', 180], ['Tomate', 50], ['Peperoni', 40], ['Olivenöl', 20], ['Mozzarella', 35]]],
  ['kartoffelsalat', 'Kartoffelsalat|Salade de pommes de terre|Insalata di patate|Potato salad', [], [150, 220, 330], [['Kartoffel', 200], ['Rapsöl', 18], ['Zwiebel', 20], ['Bouillon', 25]]],
  ['rueeblisalat', 'Rüeblisalat|Salade de carottes|Insalata di carote|Carrot salad', ['karottensalat'], [80, 130, 220], [['Karotte', 120], ['Rapsöl', 12], ['Zitrone', 10]]],
  ['caprese', 'Caprese|Salade caprese|Insalata caprese|Caprese salad', ['tomate mozzarella'], [150, 220, 320], [['Tomate', 130], ['Mozzarella', 80], ['Olivenöl', 15], ['Basilikum', 5]]],
  ['quinoa_salat', 'Quinoasalat|Salade de quinoa|Insalata di quinoa|Quinoa salad', [], [200, 300, 420], [['Quinoa', 180], ['Gurke', 50], ['Tomate', 50], ['Feta', 35], ['Olivenöl', 18]]],
  ['couscous_salat', 'Couscoussalat|Taboulé|Insalata di couscous|Couscous salad', ['taboulé'], [200, 300, 420], [['Couscous', 180], ['Tomate', 55], ['Gurke', 45], ['Olivenöl', 18], ['Zitrone', 12]]],
  ['poke_bowl', 'Poke Bowl|Poke bowl|Poke bowl|Poke bowl', ['pokebowl', 'poké bowl'], [300, 420, 570], [['Reis', 180], ['Lachs', 100], ['Avocado', 60], ['Edamame', 40], ['Sojasauce', 15], ['Sesamöl', 8]]],
  ['buddha_bowl', 'Buddha Bowl|Buddha bowl|Buddha bowl|Buddha bowl', ['bowl', 'getreidebowl'], [300, 420, 570], [['Quinoa', 160], ['Kichererbsen', 90], ['Avocado', 55], ['Gemüse', 90], ['Olivenöl', 15]]],

  // ── International ──────────────────────────────────────────────────────────
  ['sushi_platte', 'Sushi-Platte|Assiette de sushis|Piatto di sushi|Sushi platter', ['sushi'], [200, 300, 450], [['Reis', 190], ['Lachs', 80], ['Avocado', 30], ['Sojasauce', 15]]],
  ['maki_rollen', 'Maki|Makis|Maki|Maki rolls', ['makis'], [150, 240, 360], [['Reis', 160], ['Lachs', 55], ['Gurke', 25], ['Sojasauce', 12]]],
  ['california_roll', 'California Roll|California roll|California roll|California roll', [], [150, 240, 360], [['Reis', 160], ['Surimi', 45], ['Avocado', 35], ['Mayonnaise', 15]]],
  ['pad_thai', 'Pad Thai|Pad thaï|Pad thai|Pad thai', [], [300, 430, 600], [['Reisnudeln', 210], ['Poulet', 90], ['Ei', 45], ['Erdnüsse', 20], ['Sesamöl', 15], ['Sojasauce', 15]]],
  ['gebratener_reis', 'Gebratener Reis|Riz sauté|Riso saltato|Fried rice', ['nasi goreng', 'wokreis'], [280, 400, 550], [['Reis', 230], ['Ei', 50], ['Gemüse', 80], ['Sojasauce', 15], ['Sesamöl', 15]]],
  ['fruehlingsrollen', 'Frühlingsrollen|Rouleaux de printemps|Involtini primavera|Spring rolls', ['spring rolls'], [100, 170, 280], [['Teigblätter', 70], ['Gemüse', 60], ['Rapsöl', 20], ['Sojasauce', 12]]],
  ['gruenes_curry', 'Grünes Thai-Curry|Curry vert thaï|Curry verde thailandese|Green Thai curry', ['thai curry', 'grünes curry'], [330, 460, 630], [['Poulet', 120], ['Reis', 180], ['Kokosmilch', 110], ['Gemüse', 70], ['Currypaste', 15]]],
  ['butter_chicken', 'Butter Chicken|Butter chicken|Butter chicken|Butter chicken', ['murgh makhani'], [330, 460, 630], [['Poulet', 130], ['Reis', 170], ['Tomatensauce', 80], ['Rahm', 60], ['Butter', 18]]],
  ['chicken_tikka_masala', 'Chicken Tikka Masala|Poulet tikka masala|Pollo tikka masala|Chicken tikka masala', ['tikka masala'], [330, 460, 630], [['Poulet', 130], ['Reis', 170], ['Tomatensauce', 85], ['Rahm', 55], ['Rapsöl', 12]]],
  ['dal', 'Dal|Dal|Dal|Dal', ['linsendal', 'dhal'], [280, 400, 550], [['Linsen', 80], ['Reis', 150], ['Tomate', 60], ['Kokosmilch', 60], ['Rapsöl', 12]]],
  ['naan', 'Naan|Naan|Naan|Naan bread', ['naanbrot'], [70, 110, 180], [['Mehl', 65], ['Joghurt', 25], ['Butter', 12]]],
  ['tajine', 'Tajine|Tajine|Tajine|Tagine', ['tagine'], [320, 450, 620], [['Lamm', 130], ['Couscous', 170], ['Gemüse', 90], ['Olivenöl', 15], ['Aprikose', 25]]],
  ['hummus_teller', 'Hummusteller|Assiette de houmous|Piatto di hummus|Hummus plate', ['hummus', 'mezze'], [200, 300, 420], [['Kichererbsen', 150], ['Olivenöl', 25], ['Fladenbrot', 80], ['Tomate', 40]]],
  ['shakshuka', 'Shakshuka|Chakchouka|Shakshuka|Shakshuka', [], [250, 350, 480], [['Tomate', 180], ['Ei', 110], ['Peperoni', 50], ['Olivenöl', 18], ['Feta', 25]]],
  ['burrito', 'Burrito|Burrito|Burrito|Burrito', [], [280, 400, 550], [['Tortilla', 110], ['Rindshackfleisch', 100], ['Reis', 80], ['Bohnen', 60], ['Käse', 35], ['Rahm', 25]]],
  ['tacos', 'Tacos|Tacos|Tacos|Tacos', ['taco'], [180, 280, 400], [['Tortilla', 80], ['Rindshackfleisch', 100], ['Tomate', 40], ['Käse', 30], ['Rahm', 25]]],
  ['quesadilla', 'Quesadilla|Quesadilla|Quesadilla|Quesadilla', [], [180, 270, 380], [['Tortilla', 110], ['Käse', 70], ['Poulet', 60], ['Rapsöl', 12]]],
  ['nachos', 'Nachos|Nachos|Nachos|Nachos', ['tortilla chips'], [120, 200, 320], [['Maischips', 110], ['Käse', 55], ['Rahm', 30], ['Tomatensauce', 40]]],
  ['bibimbap', 'Bibimbap|Bibimbap|Bibimbap|Bibimbap', [], [350, 480, 650], [['Reis', 200], ['Rindfleisch', 90], ['Gemüse', 110], ['Ei', 50], ['Sesamöl', 12]]],
  ['gyros_teller', 'Gyrosteller|Assiette de gyros|Piatto di gyros|Gyros plate', ['gyros', 'souvlaki'], [320, 450, 620], [['Schweinefleisch', 150], ['Reis', 150], ['Joghurtsauce', 50], ['Tomate', 50], ['Olivenöl', 15]]],
  ['moussaka', 'Moussaka|Moussaka|Moussaka|Moussaka', [], [280, 400, 550], [['Aubergine', 160], ['Rindshackfleisch', 110], ['Tomatensauce', 70], ['Milch', 60], ['Käse', 35], ['Olivenöl', 20]]],
  ['paella', 'Paella|Paella|Paella|Paella', [], [330, 460, 630], [['Reis', 200], ['Poulet', 90], ['Crevetten', 70], ['Erbsen', 45], ['Olivenöl', 18]]],
  ['tortilla_espanola', 'Spanische Tortilla|Tortilla espagnole|Tortilla spagnola|Spanish omelette', ['kartoffeltortilla'], [180, 270, 380], [['Kartoffel', 170], ['Ei', 100], ['Zwiebel', 35], ['Olivenöl', 25]]],

  // ── Süsses und Kleines ─────────────────────────────────────────────────────
  ['schokoladenkuchen', 'Schokoladenkuchen|Gâteau au chocolat|Torta al cioccolato|Chocolate cake', ['schoggikuchen'], [70, 110, 180], [['Schokolade', 30], ['Butter', 25], ['Zucker', 30], ['Ei', 25], ['Mehl', 25]]],
  ['apfelkuchen', 'Apfelkuchen|Tarte aux pommes|Torta di mele|Apple cake', ['apfeltorte'], [90, 140, 220], [['Apfel', 70], ['Mehl', 40], ['Butter', 22], ['Zucker', 22], ['Ei', 20]]],
  ['cheesecake', 'Cheesecake|Cheesecake|Cheesecake|Cheesecake', ['käsekuchen'], [90, 140, 220], [['Frischkäse', 80], ['Zucker', 25], ['Ei', 20], ['Butter', 15], ['Mehl', 20]]],
  ['brownie', 'Brownie|Brownie|Brownie|Brownie', [], [50, 80, 130], [['Schokolade', 25], ['Butter', 20], ['Zucker', 22], ['Mehl', 15], ['Ei', 15]]],
  ['muffin', 'Muffin|Muffin|Muffin|Muffin', ['cupcake'], [60, 90, 140], [['Mehl', 35], ['Zucker', 22], ['Butter', 18], ['Ei', 15], ['Milch', 20]]],
  ['waffeln', 'Waffeln|Gaufres|Waffel|Waffles', ['waffel'], [90, 150, 240], [['Mehl', 55], ['Milch', 60], ['Butter', 25], ['Ei', 25], ['Zucker', 15]]],
  ['crepes', 'Crêpes|Crêpes|Crêpes|Crepes', ['crêpe', 'pfannkuchen'], [100, 170, 260], [['Mehl', 50], ['Milch', 90], ['Ei', 30], ['Butter', 12], ['Zucker', 12]]],
  ['coupe_glace', 'Coupe Glace|Coupe glacée|Coppa gelato|Ice cream sundae', ['glace', 'eisbecher'], [120, 200, 320], [['Glace', 150], ['Rahm', 35], ['Erdbeeren', 45], ['Schokolade', 15]]],
  ['meringue_rahm', 'Meringue mit Rahm|Meringue à la crème|Meringa con panna|Meringue with cream', ['meringue'], [80, 130, 200], [['Meringue', 50], ['Rahm', 70]]],
  ['tiramisu', 'Tiramisu|Tiramisu|Tiramisù|Tiramisu', [], [90, 150, 230], [['Mascarpone', 70], ['Biscuits', 35], ['Ei', 25], ['Zucker', 20], ['Kaffee', 25]]],
  ['panna_cotta', 'Panna cotta|Panna cotta|Panna cotta|Panna cotta', [], [90, 140, 220], [['Rahm', 100], ['Zucker', 18], ['Erdbeeren', 35]]],
  ['schwarzwaeldertorte', 'Schwarzwäldertorte|Forêt-noire|Torta Foresta Nera|Black forest cake', ['forêt noire'], [90, 140, 220], [['Rahm', 55], ['Schokolade', 20], ['Kirschen', 35], ['Mehl', 20], ['Zucker', 20]]],
];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

const DISHES = ROWS.map(([id, names, synonyms, [min, typ, max], recipe]) => {
  const [de, fr, it, en] = names.split('|');
  const lines = recipe.map(([term, grams]) => ({ term, grams }));
  const total = lines.reduce((sum, line) => sum + line.grams, 0);
  return {
    id,
    names: { de, fr, it, en },
    synonyms,
    portion: { min, typ, max },
    recipe: lines.map((line) => ({
      ...line,
      // Still ist eine Zutat nur, solange sie Beigabe bleibt: der Käse im Fondue
      // ist das Gericht, der Käse in den Älplermagronen sein Geheimnis.
      hidden:
        line.grams <= total * HIDDEN_MAX_SHARE &&
        tokens(line.term).some((word) => HIDDEN_WORDS.includes(word)),
    })),
    recipeGrams: total,
    // Alles, worunter man das Gericht kennt — fuer den Vergleich vorbereitet.
    keys: [de, fr, it, en, ...synonyms].filter(Boolean).map((name) => tokens(name)),
  };
});

/**
 * Wie gut ein Text ein Gericht nennt, 0..1. Alle Woerter des Gerichtsnamens
 * muessen vorkommen; je mehr davon der Text ausmacht, desto sicherer ist es —
 * „Pizza“ in „Pizza Margherita“ zaehlt, in „Salat mit Pizza und Poulet“ nicht.
 */
function scoreDish(dish, words) {
  if (words.length === 0) return 0;
  let best = 0;
  for (const key of dish.keys) {
    if (key.length === 0) continue;
    const hits = key.filter((word) =>
      words.some((own) => own === word || (own.length >= 4 && (own.startsWith(word) || word.startsWith(own)))),
    ).length;
    if (hits < key.length) continue;
    best = Math.max(best, 0.55 + 0.45 * Math.min(1, key.length / words.length));
  }
  return best;
}

/** Das Gericht zu einem Namen, oder null. `extra` sind weitere Kandidaten (z. B. der einzige Posten). */
function matchDish(mealName, extra = []) {
  let best = null;
  for (const text of [mealName, ...extra]) {
    const words = tokens(text);
    for (const dish of DISHES) {
      const score = scoreDish(dish, words);
      if (score >= MIN_DISH_SCORE && (!best || score > best.score)) best = { dish, score };
    }
  }
  return best;
}

/** Nennt ein Datensatzname das Gericht selbst? Dann steht es schon im Katalog. */
const namesDish = (dish, name) => scoreDish(dish, tokens(name)) >= MIN_DISH_SCORE;

/**
 * Teilen zwei Begriffe ein tragendes Wort? „Parmesan“ und „Parmesan, gerieben“
 * ja, „Hackfleisch“ und „Rindshackfleisch“ auch — im Deutschen steht das
 * Hauptwort hinten.
 */
function sameThing(a, b) {
  const right = tokens(b);
  return tokens(a).some((word) =>
    right.some(
      (other) =>
        other === word ||
        (word.length >= 4 && other.length >= 4 && (other.endsWith(word) || word.endsWith(other))),
    ),
  );
}

/**
 * Was die Kamera nicht sieht: die stillen Zutaten des Rezepts, auf die
 * geschaetzte Menge gerechnet. `visibleTerms` sind die erkannten Bestandteile —
 * was dort schon steht, kommt nie ein zweites Mal dazu.
 */
function dishAdditions(dish, visibleTerms, totalGrams) {
  // Unter der ueblichen Mindestportion wird nicht kleiner gerechnet: sonst
  // verschwindet mit der zu tief geschaetzten Menge auch das Fett darin.
  const base = Math.max(Number(totalGrams) || 0, dish.portion.min);
  const scale = clamp(base / dish.recipeGrams, 0.5, 2);
  const budget = base * MAX_ADDED_SHARE;
  const additions = [];
  let used = 0;
  for (const line of dish.recipe) {
    if (!line.hidden) continue;
    if (visibleTerms.some((term) => sameThing(term, line.term))) continue;
    const grams = Math.round(line.grams * scale);
    if (grams < 2 || used + grams > budget) continue;
    used += grams;
    additions.push({ term: line.term, grams });
    if (additions.length >= MAX_ADDITIONS) break;
  }
  return additions;
}

/** Passen die erkannten Bestandteile zum Rezept? Ein einzelner Posten ist immer das Gericht selbst. */
function dishFits(dish, visibleTerms) {
  if (visibleTerms.length <= 1) return true;
  const hits = visibleTerms.filter((term) =>
    dish.recipe.some((line) => sameThing(term, line.term)),
  ).length;
  return hits / visibleTerms.length >= 0.5;
}

module.exports = {
  DISHES,
  HIDDEN_WORDS,
  MAX_ADDITIONS,
  MIN_DISH_SCORE,
  dishAdditions,
  dishFits,
  matchDish,
  namesDish,
  normalizeDishName: normalize,
  scoreDish,
};
