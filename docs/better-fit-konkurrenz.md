# Better Fit gegen den Rest (23.09.2026)

Drei Recherchen an einem Tag: Foto-Kalorienzähler, Ernährungs-Apps, Trainings-Apps
und der Schweizer Markt. Was hier steht, ist belegt oder als Vermutung markiert —
und wo wir hinten liegen, steht es auch.

## Zuerst die Warnung: die Messlandschaft ist vergiftet

Fast jede „Vergleichsseite für KI-Kalorienzähler" gehört selbst einer App und
setzt sich auf Platz 1. Belegt für über ein Dutzend Seiten (platelens.app,
nutriscan.app, macaron.im, nutrola.app, calzy-app.com, welling.ai …). PlateLens
behauptet **±1.1 % Fehler** für sich selbst — das ist physikalisch unmöglich,
denn schon die Nährwertdatenbank allein streut stärker.

Es gibt genau **vier** unabhängige, methodisch saubere Quellen im ganzen Feld:

| Quelle | Was | Status |
| --- | --- | --- |
| [Thames et al., Nutrition5k, CVPR 2021](https://openaccess.thecvf.com/content/CVPR2021/html/Thames_Nutrition5k_Towards_Automatic_Nutritional_Understanding_of_Generic_Food_CVPR_2021_paper.html) | 5000 Gerichte, jede Zutat gewogen, RGB-D | peer-reviewed, Datensatz offen |
| [Chen et al., Nutrients 2024;16(15):2573](https://www.mdpi.com/2072-6643/16/15/2573) | 18 Apps, 22 Testgerichte, West gegen Asien | peer-reviewed |
| [Hengist & Charles, NIDDK, NUTRITION 2026](https://www.sciencedaily.com/releases/2026/07/260726015237.htm) | 102 Mahlzeiten aus einer metabolischen Küche, 0.1 g genau | Abstract, **nicht** peer-reviewed |
| [PMC7752530 (2020)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7752530/) | 7 Erkennungs-Plattformen, 185 Bilder | peer-reviewed, Vor-LLM-Ära |

**Das ist eine Chance, kein Ärgernis.** Wer eine nachprüfbare Zahl auf einem
öffentlichen Datensatz hat, ist in diesem Feld allein. Wir haben sie.

## Unsere Architektur ist nicht Geschmackssache, sie ist gemessen

Nutrition5k hat drei Ansätze verglichen:

| Ansatz | kcal-Fehler |
| --- | ---: |
| Kalorien direkt vorhersagen (nur RGB) | 26.1 % |
| RGB-D, Tiefe als vierter Kanal | 18.8 % |
| **Masse schätzen, dann Nährwerte je Gramm rechnen** | **16.5 %** |

Die letzte Zeile ist genau unser Weg: die KI nennt nur Lebensmittel und Gramm,
der Dienst rechnet. Wir haben unabhängig die Architektur gewählt, die das
Google-Paper als beste misst — und das ist zitierbar.

Daraus folgt auch, warum Cal AI beim zweiten Scan desselben Gerichts bis zu
400 kcal abweicht und wir nicht: bei uns ist **nur** die Gramm-Schätzung
stochastisch, die Nährwerte sind deterministisch. **Reproduzierbarkeit hat
kein Konkurrent.**

## Wo wir ehrlich hinten liegen

| Feld | Wer | Wie schlimm |
| --- | --- | --- |
| **Portions-/Volumenschätzung** | SnapCalorie | Hoffnungslos. LiDAR auf iPhone Pro, Roboter-Rig für gewogene Trainingsdaten, Mitgründer von Google Lens. Sie nennen unter 20 % Gesamtfehler und stützen es auf Nutrition5k |
| **Datenbankbreite** | MyFitnessPal / Cal AI | Hoffnungslos. 20 Mio. Lebensmittel, 68'500 Marken, 380+ Restaurantketten. MyFitnessPal hat Cal AI im Dezember 2025 gekauft — deren Rechen-Schwäche ist damit weg |
| **Verteilung und Kapital** | Cal AI | 15 Mio. Downloads, 40–50 Mio. USD Umsatz. Kein Kampf, den wir gewinnen |
| **Geschwindigkeit** | Cal AI | „Foto, fertig, 5 Sekunden" ist deren ganze Identität. Unser Bestätigen-Schritt ist richtig, aber langsamer |
| **Barcode auf Schweizer Marken** | FatSecret (gratis!), Yazio | **Unser Blocker Nummer eins.** 1200 generische BLV-Einträge können keinen Migros-Fertigsalat scannen |
| **Health-Sync, Übungsvideos, CSV-Import, Watch** | Hevy, Fitbod, JEFIT | Tabelleneinstand, den wir nicht haben |

**Und eine Zahl, die wir selbst richtig lesen müssen:** Unsere 13.3 % Median
sind die **Rechen-Hälfte bei gegebenen Gramm** — nicht vergleichbar mit
Nutrition5ks 16.5 %, die die Portionsschätzung einschliesst. Der Mittelwert
liegt bei 25.9 %, nicht bei 13.3 %. **Beide Zahlen immer zusammen nennen**,
sonst machen wir genau, was wir der Konkurrenz vorwerfen.

Die Lücke zwischen 13.3 % (perfekte Gramm) und ~23 % (ganze Kette) **ist** der
Gramm-Fehler. Dort liegt die ganze verbleibende Arbeit, nicht in der Datenbank.

## Wo wir sie schlagen — und warum das hält

1. **Schweizer Lebensmittel.** Niemand hat die BLV-Datenbank. Und die
   Sydney-Studie belegt, dass gemischte, saucenlastige Gerichte die grössten
   Fehler produzieren (+49 % bei Pho, −76 % bei Bubble Tea). Älplermagronen,
   Raclette, Zürcher Geschnetzeltes mit Rösti, Bündner Gerstensuppe sind genau
   das. **Heimvorteil, gemessen statt behauptet.**
2. **Anstand.** Apple hat Cal AI im April 2026 wegen täuschender Abrechnung aus
   dem Store entfernt. Noom hat 62 Mio. USD an die FTC und 56 Mio. an eine
   Sammelklage gezahlt. MyFitnessPal hat seit 2022 viermal Gratis-Funktionen
   weggenommen (Barcode 2022, Foto und Rezeptimport 2026), Lose It! den Preis
   verdoppelt. Lifesums Kündigen-Knopf öffnet „Pausieren". **Wer jetzt „wir
   nehmen nichts weg" glaubhaft sagt, hat ein Argument, das kein Feature
   schlägt.**
3. **Einrichten unter einer Minute.** Nooms Trichter hat **bis 113 Bildschirme**
   und zeigt den Preis zuletzt — mit Absicht, weil zwölf Minuten Investition
   konvertieren. Unser Leitsatz ist die entgegengesetzte Haltung, und er ist
   belegbar.
4. **Der geschlossene Kreis.** Rezept → Wochenplan → **Vorrat** → Einkaufsliste
   → Tagebuch → Training → Coach. Yazio und Fitia schaffen drei Glieder, gegen
   Premium. Samsung Food hat den Vorrat, aber kein Training. MyFitnessPal musste
   den Plan zukaufen und legte ihn hinter 99.99 USD/Jahr. **Niemand hat alle
   sieben.**
5. **Ein ehrlicher Coach.** Googles Health Coach erfand im Test einen
   5-Meilen-Lauf und schob die Schuld auf den Nutzer — in einem **bezahlten**
   Produkt. Ein systematisches Review (Biology of Sport, 04.03.2026, 24 Studien)
   fand in **58 % der Studien** sicherheitsrelevante Mängel bei
   LLM-Trainingsempfehlungen. Unser „schlägt vor, du bestätigst, dann wird
   gespeichert" ist kein Kompromiss, sondern die Position, die sich als richtig
   erweist.
6. **Vier Sprachen, schon fertig.** Hevy, Fitbod, Strong, Boostcamp sind
   englisch-zentriert. In einem Land, in dem Lausanne und Chur dasselbe Produkt
   brauchen, ist das eine getätigte Investition.

## Die Studio-Idee: was daran wirklich neu ist

Nicht das Filtern nach Geräten — das haben Fitbod („Gym Profiles"), Vicifit,
Hevy Trainer und Alpha Progression. Nicht das Tauschen bei besetztem Gerät —
das haben SmartGym und GymVision. Nicht der Kamera-Scan — GymLens, Gymeo.

**Neu ist: „Ich trainiere bei Activ Fitness Wallisellen" → fertig.** Keine
Checkliste mit 60 Geräten. Es wurde **keine App gefunden, die eine gepflegte
Datenbank benannter Studioketten mit ihrem echten Gerätepark führt** — auch die
Ketten selbst nicht.

Der Präzedenzfall, der zeigt, dass das trägt: [KraftApp](https://getkraft.app/en)
ist eine App **nur für Kieser Training**, mit den Geräteeinstellungen dieser
Kette — gebaut von einer Privatperson, gratis, nicht offiziell. Dass das
freiwillig entsteht und überlebt, belegt den Bedarf.

Drei Risiken, ehrlich: der Gerätepark variiert pro Filiale (Handarbeit, die
gepflegt werden muss); die Idee ist kopierbar, der Burggraben ist die Pflege;
und **EGYM** sitzt schon in Fitnesspark und Activ Fitness — wenn die ihren
Gerätepark öffnen, ist der Vorsprung weg. EGYM deckt aber nur die motorisierten
Zirkelgeräte ab, nicht Rack, Freihantel und die Studios ohne EGYM.

## Der Schweizer Hebel, den keiner der Grossen hat

**Krankenkassen.** Helsana+ zahlt bis ~300 CHF/Jahr, SWICA Benevita bis 15 %
Prämienrabatt, CSS active365 bis 146 CHF/Jahr — und der technische Weg dorthin
ist **Apple Health / Google Fit**, nicht eine Partner-Schnittstelle. Wer dorthin
schreibt, landet automatisch in den Bonusprogrammen, ohne mit einer Kasse zu
verhandeln. Betty Bossi, Oviva und WeightWatchers haben das alle angezapft.
Bei 50 CHF/Jahr wäre eine Kassenanerkennung kein Rabatt, sondern **der
Vertriebskanal**.

Dazu die Gegenposition, die schon im Markt formuliert ist: Die Stiftung für
Konsumentenschutz forderte 2021 wörtlich „Löschen Sie umgehend die Sanitas
Active App!", weil Gesundheitsdaten direkt an die Kasse gehen; der EDÖB prüfte.
Seit 01.09.2023 stuft das revDSG Gesundheitsdaten als besonders schützenswert
ein. **„Deine Trainingsdaten gehen nicht an eine Versicherung"** ist ein Satz,
den im Fitnessbereich niemand sagt.

⚠️ **Nur mit Safe Swiss Cloud sagen.** Solange der Gratis-Tarif über Groq läuft
und die Nachrichten in die USA gehen, wäre „die KI rechnet in der Schweiz" eine
Übertreibung — und bei einem Schweizer Publikum der teuerste mögliche Fehler.

## Was daraus gebaut wurde (23.09.2026)

**Adaptives Ziel aus dem eigenen Verlauf** (`fit/energy.js`, getestet, dazu
`test/fit-energy.test.js` von aussen). Das ist MacroFactors Kernfunktion, für
die sie 71.99 USD/Jahr ohne Gratis-Tier verlangen — und die einzige Stelle, an
der wir einer fachlich ernsthaft besseren App ebenbürtig werden.

Statt Mifflin-St Jeor mal geratenem Aktivitätsfaktor gilt der
Energieerhaltungssatz: `Verbrauch = Zufuhr − Gewichtsänderung × 7700`. Wer
2100 kcal isst und 0.4 kg je Woche verliert, verbraucht rund 2540 — egal was
eine Formel sagt. Steht in `GET /v1/fit/weights` als `expenditure`, mit
Sicherheitsstufe, Abdeckung und dem Ziel, das daraus folgt. Grenzen, die das
Modul selbst kennt: unter 14 Tagen nichts, unter 60 % Tagebuch-Abdeckung nichts
(sonst zählt man nur die braven Tage), über 1.5 kg/Woche nichts (das ist Wasser
oder ein Tippfehler). Ein Ziel bewegt sich höchstens 300 kcal je Schritt, sagt
aber ehrlich, wo es landet. Und es bleibt ein **Vorschlag** — gesetzt wird
nichts.

**Der Grund für das Trainingsziel** (`ExerciseBlock.tsx`, `fit8.why.*` in vier
Sprachen). `nextTarget` rechnete die Progression längst (+2.5 kg, bei Kniebeuge
und Kreuzheben +5, Deload nach zwei Einheiten unter dem Bereich) — der Grund
kam nur nie an. Jetzt steht unter dem Ziel, warum es dort steht: „Letztes Mal
alle Sätze am oberen Ende — darum heute mehr." Das ist die direkte Antwort auf
den häufigsten Vorwurf gegen Fitbod: eine Zahl aus einer Blackbox, die man
jedes Mal nachbessert.

## Die Arbeitsliste, nach Wirkung geordnet

1. **Barcode auf Schweizer Markenprodukte.** Open Food Facts CH hat Migros 4317
   und Coop 4295 Produkte. Beim Import deduplizieren, pro Barcode **einen**
   Eintrag, Herkunft kennzeichnen („BLV-geprüft" / „Open Food Facts" / „von dir
   erfasst") — nie mischen. Ohne das ist jeder Einkauf ein Handeintrag.
2. **Apple Health / Health Connect schreiben und lesen.** Doppelter Nutzen:
   Tabelleneinstand *und* der Weg in die Kassenbonusprogramme. Braucht ein
   natives Modul.
3. **Die Portionsschätzung**, das ganze Restproblem. Kalibrierung auf den
   Gramm-Ausgaben (Bildmodelle unterschätzen systematisch, stärker bei grossen
   Portionen), Median aus mehreren Aufrufen, Referenzobjekt-UX, und als grosser
   Hebel ein Portions-Kopf auf gefrorenem DINOv2 (in einer Studie −41 %, auf
   Colab gratis trainierbar).
4. **Korrekturen als Trainingsdaten behandeln, ab heute.** Jede Bestätigung ist
   ein gelabeltes Paar (Foto → korrigierte Gramm). `correctionsOf` und
   `personalFactors` sammeln schon; das ist der Weg zu einem eigenen gewogenen
   Datensatz ohne Roboter-Rig. Kein Konkurrent tut das nachweislich.
5. **Wiederholungs-Logging ausbauen** — „wie gestern", ganzen Tag kopieren,
   Mahlzeit aus dem Wochenplan mit einem Tipp. Das ist „ein Plus für das
   Häufigste" in der Ernährung.
6. **Rezept-Import per URL und Foto**, sonst bleibt die Rezeptsammlung leer und
   die ganze Kette läuft nicht an.
7. **Übungsvideos, Watch-Pausentimer, CSV-Import aus Hevy/Strong.** Ohne Import
   bekommen wir keine Umsteiger, nur Anfänger.

**Nicht tun:** auf Datenbankbreite konkurrieren (verloren, seit MyFitnessPal Cal
AI besitzt), Mikronährstoffe komplett nachbauen (Cronometer hat 84 gratis — die
zehn wichtigsten reichen), gegen Cal AIs Verteilung antreten.

## Preise der Konkurrenz, zum Vergleich

| App | 2026 | Gratis |
| --- | --- | --- |
| **Wir (geplant)** | **CHF 5/Mt · 50/Jahr** | die ganze App im Standard-Aussehen |
| Hevy | 2.99/Mt · 23.99/Jahr | 4 Routinen, Logger unbegrenzt |
| Cal AI | ~9.99/Mt · 29.99/Jahr, dynamisch | praktisch keins |
| Cronometer | 10.99/Mt · 59.99/Jahr | sehr grosszügig, 84 Nährstoffe |
| Fitia | 59.99/Jahr | ja, max. 4 Mahlzeiten/Tag |
| MacroFactor | 71.99/Jahr | keins, 7 Tage Test |
| Yazio | 83.90 €/Jahr, Dauerrabatt | Tagebuch, Barcode |
| MyFitnessPal | 79.99 · Premium+ 99.99/Jahr | kein Barcode, keine Foto-Scans |
| Lose It! | 79.99/Jahr (2026 verdoppelt) | 5 Foto-Scans/Woche |
| SnapCalorie | **19.99/Mt · 149/Jahr** | 3 Analysen/Tag |
| Noom | ~209/Jahr im Voraus | nur Quiz |
| Gymshark Training | **gratis für immer** | alles (wird nicht mehr weiterentwickelt) |

Der Boden bei Trainings-Apps ist 0 (Gymshark, Boostcamp), die Decke für reines
Protokollieren ~3 CHF. **Unsere 5 CHF sind nur zu halten, wenn wir auf der
Programmierungs-Seite stehen, nicht auf der Logger-Seite** — also Progression,
adaptives Ziel, Studio-Modus, der geschlossene Kreis.
