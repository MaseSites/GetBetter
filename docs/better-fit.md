# Better Fit — Umsetzung

Fachlicher Hauptplan: [apps/bettergym/BETTER_FIT_FINALER_MASTERPLAN_FUER_CLAUDE_CODE.md](../apps/bettergym/BETTER_FIT_FINALER_MASTERPLAN_FUER_CLAUDE_CODE.md).
Diese Datei sagt, **wie** er in diesem Repository umgesetzt ist, was steht, was
offen ist und was der Eigentümer selbst tun muss. Stand: 21. September 2026.

## Grundentscheide

| Frage | Entscheid | Warum |
| --- | --- | --- |
| Wo läuft Better Fit? | In **BetterGym** (`apps/bettergym`, Id `bettergym`) als fünf neue Funktionen: **Ernährung** (`nutrition`), **Küche** (`kitchen`), **Coach** (`coach`), **Trainingsplan** (`trainingplan`), **Fortschritt** (`progress`). Ids, Schema und Abo bleiben; der Anzeigename bleibt vorerst „BetterGym“. | Der Plan liegt dort; nichts Bestehendes bricht. |
| Backend | Teil des bestehenden Dienstes: `services/api/fit/`, Routen `/v1/fit/…` (Plan: `/api/…`). Node ohne Fremdbibliotheken. | Eine Datenbank für alle Apps bleibt die Regel des Projekts. |
| Ablage | `data/fit.json`, **nie** in `GET /v1/db`. Fotos nur kurz in `data/fit-tmp/`. | `/v1/db` gibt jeder App alles; Körper- und Ernährungsdaten gehören nicht dorthin. |
| Anmeldung | **Sitzungs-Tokens** (`services/api/sessions.js`): Anmelden/Registrieren geben ein Token (32 Byte, im Dienst nur SHA-256, 30 Tage). Fit-Routen verlangen `Authorization: Bearer …`, das Konto kommt **nur** aus dem Token. Gesperrt oder gelöscht gilt sofort. Abmelden widerruft das Token. „App ansehen“ im Admin bekommt ein Nur-Lesen-Token. | Plan §22. |
| Row Level Security | Lokal: `fit/store.js` gibt Routen nur `forOwner(id)` — jede Abfrage und Änderung ist darauf beschränkt (Tests beweisen es). Produktion: `supabase/migrations/20260921120000_better_fit.sql` mit echten RLS-Policies, geprüft mit PGlite (`supabase/tests/rls-check.mjs`). | Supabase braucht ein Konto des Eigentümers. |
| Schema der KI | JSON Schema an Gemini (`responseSchema`), danach eigener strenger Prüfer (`fit/vision/schema.js`) statt Zod. | Der Dienst hat keine Abhängigkeiten. |
| Nährwerte | Nur der Dienst rechnet: Gramm × Wert je 100 g aus dem Katalog. Die KI liefert Lebensmittel und Gramm, nie Kalorien. Client-Summen zählen nie. Gegessenes speichert eine Abschrift der Werte. | Plan §7, §10. |
| Änderungen | **Bestätigte Aktionen** (`fit/tools/`): vorschlagen → Auswirkung zeigen → bestätigen → atomar speichern (ganz oder gar nicht) → gespeichertes Ergebnis melden. Weicht die Vorschau beim Bestätigen ab, wird nichts gespeichert (`stale`). App und Coach nutzen dieselben Werkzeuge. | Plan §16, §17. |
| Coach, freie Fragen | Über den **bestehenden KI-Dienst** (Safe Swiss Cloud, Abo-Kontingent je Konto/App) statt Gemini Flash-Lite. Er darf nichts ändern; Absichten erkennt der Dienst regelbasiert in vier Sprachen. | Vorhandene Kostenkontrolle nutzen; kein zweiter Kostenpfad. |
| Mock-Modus | `MEAL_ANALYSIS_MODE=mock` (Standard): Bildanalyse, OCR, Barcode, USDA aus Fixtures, **kein** Aufruf nach aussen. Katalog = gerundete Beispielwerte, klar als „Beispielwerte“ markiert. | Plan §23. |

## Aufbau im Dienst (`services/api/fit/`)

```
config.js        Umgebungsvariablen (Plan §24), publicConfig ohne Schlüssel
store.js         fit.json, forOwner (RLS), Transaktionen, Änderungsprotokoll
service.js       setzt alles zusammen, Idempotenz (Idempotency-Key, 24 h)
goals.js         Mifflin-St Jeor, Trainings-/Ruhetag, Sicherheitsregeln, Gewichtstrend
nutrition.js     Rechnen und Plausibilität (§10)
recipes.js       Einheiten → Gramm, Rezept-Nährwerte je Portion und 100 g
dayKind.js       Trainings- oder Ruhetag — eine Regel für Tagebuch und Plan
catalog/         Mock-Katalog, Suche/Matching (roh/gekocht, Verlauf), Allergene aus Namen,
                 XLSX-Leser und Import der Schweizer Nährwertdatenbank
sources/         USDA FoodData Central, Open Food Facts (je mit Zwischenspeicher)
vision/          Gemini-Client, Schema, Fixtures, Nährwerttabelle (OCR)
images.js        Typ an den Bytes, Grösse, EXIF/XMP/Text weg (JPEG, PNG, WebP)
tempImages.js    Fotos nur bis zum zweiten Bild, höchstens 1 h; behalten nur mit Zustimmung
analysis.js      Zuordnung, Ampel grün/orange/rot, höchstens 2 Rückfragen mit fester Wirkung
usage.js         Tageslimit, Monatsbudget (80 % Warnung, 100 % Stopp), Kill-Switch
kitchen/         Rezeptbibliothek, Vorrats-Text, Vorschläge, Wochenplan, Einkaufsliste
training/        Vorlagen, Termine, Verschieben mit Konfliktprüfung, Rekorde, Steigerung
tools/           Aktions-Maschine und Werkzeuge (lesen / vorschlagen / bestätigen)
coach/           Absichten in vier Sprachen
routes/          diary, analysis, packaged, kitchen, training, coach
stats.js         Zahlen für den Admin (§25)
```

## Routen (alle mit Token)

| Route | |
| --- | --- |
| `GET/PUT /v1/fit/profile` | Profil, Ziele |
| `GET /v1/fit/day?day=` | Tagesübersicht: Ziel des Tages, Mahlzeiten, Summe, Rest |
| `GET /v1/fit/foods/search?q=` · `GET /v1/fit/foods/:id` · `POST /v1/fit/foods/custom` | Katalog |
| `POST/PATCH/DELETE /v1/fit/meals…` | Tagebuch (Idempotency-Key) |
| `GET/POST/DELETE /v1/fit/weights…` · `POST /v1/fit/goals/adjustment` | Gewicht, Trend, bestätigte Anpassung |
| `GET /v1/fit/changes` · `POST /v1/fit/changes/:id/undo` | Protokoll, Rückgängig |
| `POST /v1/fit/meal-analysis/start` · `/:id/add-image` · `/:id/answer` · `/:id/confirm` · `/:id/cancel` | Foto-Analyse |
| `GET /v1/fit/foods/barcode/:code` · `POST /v1/fit/nutrition-label/scan` · `POST /v1/fit/foods/label` | Verpackung |
| `GET /v1/fit/pantry` · `POST /v1/fit/pantry/parse` · `POST /v1/fit/pantry/items` | Vorrat (Vorschlag) |
| `GET /v1/fit/recipes[/library|/:id]` · `POST /v1/fit/recipes/suggest` · `POST /v1/fit/recipes` · `POST /v1/fit/recipes/:id/log` | Rezepte |
| `GET /v1/fit/meal-plans/current` · `POST /v1/fit/meal-plans/generate` · `PATCH …/entries/:entryId` · `POST …/entries/:entryId/log` | Wochenplan |
| `POST /v1/fit/shopping-lists/from-meal-plan` · `GET …/current` · `POST/PATCH/DELETE …/:id/items` | Einkaufsliste |
| `GET /v1/fit/workout-templates` · `POST /v1/fit/workout-plans` · `GET /v1/fit/workouts[/:id]` · `POST …/sets` · `…/complete|skip|reopen` · `GET /v1/fit/progress` | Training |
| `GET/POST /v1/fit/actions` · `POST /v1/fit/actions/:id/confirm|reject` · `POST /v1/fit/coach/actions/:id/confirm` | Bestätigte Aktionen |
| `POST /v1/fit/coach/message` · `GET /v1/fit/coach/messages` | Coach |
| `DELETE /v1/fit/data` | Alle Better-Fit-Daten löschen (`{ confirm: 'DELETE' }`) |
| `GET /api/fit` (Admin, 127.0.0.1:8091) | Analysen, Ampel, Fehler, Korrekturen, Kosten, Budget — nur Zahlen |

Werkzeuge: schreiben `add_to_pantry`, `update_pantry`, `reduce_pantry`, `save_recipe`,
`delete_recipe`, `create_weekly_meal_plan`, `swap_meal_plan_entry`,
`generate_shopping_list` (auch Aktualisieren mit Unterschied), `create_workout_plan`,
`reschedule_workout`, `log_weight`; lesen `get_today_summary`, `get_remaining_macros`,
`get_workout_schedule`, `get_pantry_items`, `suggest_recipes_from_pantry`,
`find_meals_for_remaining_macros`, `explain_progress`.

## Stand der Phasen

- [x] **Phase 1** — Tokens, Fit-Ablage mit Besitzer-Regel, Profil/Onboarding, Ziele, Tagebuch mit Tagesübersicht, Mock-Katalog, Supabase-Migration mit RLS.
- [x] **Phase 2** — Foto-Analyse (Mock + Gemini), Schema und Prüfung, Import der Schweizer Datenbank (Skript), USDA, Matching, Plausibilität, Bestätigen.
- [x] **Live** (21.09.2026) — Gemini-Schlüssel eingerichtet, Schweizer Datenbank V7.1 importiert (1200 Lebensmittel), echtes Foto geprüft: alle Zutaten aus der Schweizer Datenbank, ohne „unsicher“.
- [x] **Phase 3** — Barcode (Prüfziffer, Cache, Open Food Facts), OCR der Nährwerttabelle, Duplikate, Rezeptmodus beim Foto, zweites Bild, Ampel.
- [x] **Phase 4** — Vorrat (Text, Sprache, Barcode), Rezeptvorschläge, gespeicherte/bearbeitbare Rezepte, Wochenplan, Einkaufsliste mit Vorratsabzug, Planänderungen, Gewicht/Trend, Trainingspläne, Satz-Logger, Coach mit bestätigten Aktionen, Verschieben.
- [x] **Phase 5 (lokal)** — Ende-zu-Ende-Test, Kostenlimits, Kill-Switch, Rate-Limits, Admin-Auswertung, Kontolöschung inkl. Fit-Daten.
- [ ] **Phase 5 (Eigentümer)** — 500-Mahlzeiten-Benchmark, kommerzielle Anbieter, Datenschutz- und Store-Vorbereitung.

## Tests

`npm test` (Node ≥ 22 nötig — auf diesem Rechner lief es mit `npx node@24`):

- Einheiten: `fit/goals`, `nutrition`, `catalog`, `images`, `analysis`, `swiss`, `kitchen` (Abnahme §26), `training`, `coach/intents`, App `features/fit/setupForm`.
- Gegen den echten Dienst: `test/fit-diary` (Token, RLS, Idempotenz, Rückgängig), `fit-analysis` (Mock und live gegen nachgebaute Gemini/USDA), `fit-packaged` (Barcode, OFF live nachgebaut, OCR, Duplikate), **`fit-e2e`** (Vorrat → Rezept → speichern → Wochenplan → Einkaufsliste → Mahlzeit → Tagesmakros, Coach „Training verschieben“), `fit-admin` (Auswertung, Sperre, Löschen).
- Stand 22.09.2026: 981 Tests, alle grün. Der frühere Wackeltest in `speech/service.test.js` wartet jetzt auf die geschriebene Datei.
- Browser (BetterGym, 8083): Einrichtung, Tagebuch, Foto-Analyse (Lasagne rot → zweites Foto → Rückfrage → bestätigt), Vorrat per Text, Rezeptvorschläge, Rezept speichern, Wochenplan, Einkaufsliste, Plan-Mahlzeit gegessen mit Vorratsabzug als Vorschlag, Trainingsplan, Satz mit Pausentimer, Coach verschiebt Training nach Bestätigung; Oberfläche auf Französisch geprüft.

## Einfacher und verbunden (22.09.2026)

- **Einrichten in einer Minute** (`FitOnboarding.tsx`, Logik `onboardingPlan.ts`, getestet): eine Frage je
  Bildschirm — Ziel (Abnehmen / Fit bleiben / Muskeln), Jahrgang/Grösse/Gewicht, Alltag, wie oft trainieren,
  **wo** (Studio), Essen, „Trifft etwas zu?“ — dann **Dein Plan**: kcal, Makros, Trainings-/Ruhetag, Trinkziel,
  Wochentage als Chips und der Trainingsplan mit allen Übungen. Erst „Los geht's“ bestätigt den Plan. Öffnet sich
  beim ersten Besuch der Ernährung von selbst und bleibt offen, bis man es schliesst; beim ersten Mal ist nichts
  vorgewählt. Kochzeit, Budget usw. bleiben unter „Alle Angaben“ (`FitSetup`).
- **Ernährung** (`NutritionView.tsx`): gross „Heute noch … kcal“, das **Tagesband** (`DayBand.tsx`, Rechnung
  `bandPieces.ts`: je Mahlzeit ein Abschnitt, über dem Ziel rot, der Trainingsaufschlag sichtbar),
  Eiweiss/Kohlenhydrate/Fett, eine Karte zum Training des Tages und Trinken mit +2.5/+5 dl. Unten das **Plus**
  (ausserhalb von `Screen`, sonst rollt es mit): Frühstück/Mittag/Abend/Snack → `AddMealSheet` mit
  Wochenplan-Mahlzeit, Foto (Kamera), Suche, Verpackung, eigenen Rezepten.
- **Kamera am Telefon**: `expo-image-picker` + `expo-image-manipulator` (1280 px, JPEG, ohne EXIF), Rechte in
  `app.json`. Browser: Dateiwahl.
- **Training nach Studio** (`training/templates.js`): Geräte-Marken (Langhantel, Kurzhanteln, Maschinen, Kabelzug,
  Klimmzugstange, Kettlebells), Studios mit **typischer** Ausstattung (Activ Fitness, Migros Fitnesspark, Update,
  Basefit, Well come FiT, Kieser nur Maschinen, Zuhause, Draussen) — in der App als Vorauswahl gekennzeichnet und
  abwählbar. Über 40 Übungen mit Anleitung, sieben Vorlagen (2–6 Tage, PPL, Geräte-Zirkel). Im Training „Gerät
  besetzt? Tauschen“ (`POST /v1/fit/workouts/:id/swap`, nur gleiche Muskeln und vorhandene Geräte, nur solange
  noch kein Satz steht). `GET /v1/fit/gyms`.
- **Verbunden**: `GET /v1/fit/day` liefert `workout`, `trainingBonusKcal` und `waterTargetMl`; Ernährung zeigt das
  Training, der Trainingsplan zeigt „heute X kcal mehr · noch Y g Eiweiss“, Trinken (Startseite und Funktion) nimmt
  das persönliche Ziel. Ein abgeschlossenes Training geht mit Minuten in `workouts` (Woche, Profil, GetBetter).
- **Küche**: unter dem Vorrat sofort „Daraus kannst du kochen“; im Rezept „Fehlendes auf die Einkaufsliste“ und in
  der Fit-Einkaufsliste „Auf die BetterFamily-Einkaufsliste“ (`familyShopping.ts`, gemeinsame `shoppingItems` des
  Haushalts, ohne Doppelte).
- **Wie immer** (22.09.): `GET /v1/fit/meals/usual?slot=` fasst gleiche Zusammenstellungen der letzten 60 Tage
  zusammen (Gramm auf 10 g), die zur Mahlzeit passenden zuerst; `POST /v1/fit/meals/:id/repeat` trägt sie neu
  gerechnet wieder ein. Im Plus ganz oben, ein Tipp mit Rückgängig.
- **Plus auf der BetterGym-Startseite** und in der Ernährung; die Mahlzeit, die gerade dran ist, steht zuoberst
  (`slotForNow`).
- **Strichcode live** am Telefon (`BarcodeScanner.native.tsx`, `expo-camera`, EAN-13/8, UPC; im Browser
  `BarcodeScanner.tsx` ohne Kamera). Nährwerttabelle direkt mit der Kamera.
- **Nach dem Training**: kleine Feier und eine Karte „Stark! … Sätze in etwa … Minuten · heute noch X g Eiweiss“
  mit „Essen eintragen“.
- **Katalog**: Stückgewichte für übliche Lebensmittel („6 Eier“ = 330 g), zusammengesetzte Wörter über das
  Wortende („Weissmehl“ → Mehl), Farben zählen nicht („rote Linsen“), ohne Zubereitung gewinnt bei Gleichstand roh.
- **BetterGym** führt „Training“ und „Menüplan“ nicht mehr als eigene Funktionen.

## 100 Verbesserungen (22.09.2026)

Die vollständige Liste mit Status steht in [better-fit-100.md](better-fit-100.md). Das Wichtigste:

- **Aufbau der App-Schnittstelle:** `db/fit.ts` (Kern) setzt sich aus `fitDiary.ts`, `fitKitchen.ts` und
  `fitTraining.ts` zusammen; `fitEvents.ts` meldet Änderungen **nach Bereich** (`diary`, `kitchen`,
  `training`, `profile`, `all`) — `useFit(run, deps, topics)` lädt nur neu, was betroffen ist — und schickt
  `Accept-Language` mit. Der Server reicht `language` an jeden Handler; `fit/lang.js` (`pick`, `nameIn`).
  Rezeptbibliothek (`kitchen/libraryText.js`), Übungen, Vorlagen und Einheiten (`training/texts.js`) kommen in
  DE/FR/IT/EN; gespeichert bleibt Deutsch mit Ids.
- **Sicherheit und Kosten:** Tageslimit nach Erstellungstag (Zürich), zweites Foto zählt; Limit und Budget
  werden vor Gemini reserviert (`FIT_AI_RESERVE_CHF`); Idempotenz atomar (`409 in_progress`); kaputte
  `fit.json` wird gesichert und gesperrt (`503 store_unavailable`); `sessions.json` atomar; Passwort-Reset im
  Admin widerruft Tokens; Aktions-Argumente ≤ 64 KB; Obergrenzen je Konto (`fit/retention.js`); Wertebereiche
  (`fit/limits.js`); abgelaufene Analyse `409 analysis_expired`; Token am Telefon im Schlüsselbund
  (`db/tokenStore.native.ts`, `expo-secure-store`).
- **Ernährung:** Mahlzeit bearbeiten (`MealEditSheet`), mehrere Lebensmittel je Mahlzeit (`FoodBasket`),
  „Zuletzt gegessen“ (`GET /v1/fit/foods/recent`), „Wie gestern“ (`POST /v1/fit/days/:day/copy`), „Was passt
  noch?“ (`GET /v1/fit/fits`), Serie, Ballaststoffe/Zucker/Salz, Foto-Zutaten entfernen/ersetzen/hinzufügen,
  Trinken nachtragen, neues Gewicht passt die Ziele an.
- **Küche:** Ablaufdatum und „Bald ablaufen“, Mengen in ihrer Einheit, „500g“/EL/TL/Dose/½, gesammelt in den
  Vorrat, „im Korb“, Wochen wechseln, erlaubte Ersatzrezepte (`GET …/entries/:id/options`), Portionen
  skalieren, Favoriten (`POST /v1/fit/recipes/:id/favorite`), Kochmodus mit Timer, BetterFamily-Übergabe nur
  mit dem, was fehlt.
- **Training:** strenge Statuswechsel (`no_sets`, `workout_started`, `status_invalid`), „Heute machen“,
  Verpasst, Verlauf mit Monatsstreifen, Pausentimer unten mit +30 s und Vibration, „Wie letztes Mal“,
  Aufwärmsätze, Zeitübungen in Sekunden, Körpergewicht ohne „0 kg“, Rekorde mit Feier, Steigerung mit
  Rückschritt und Deload, Plan verlängert sich selbst, Volumen je Muskelgruppe und Woche, Scheibenrechner,
  geschätztes Maximum, Gewicht an einer Stelle. `GET /v1/fit/progress` liefert `volume` jetzt als
  `{ gruppe: { sets, volumeKg } }` und dazu `week`.
- **Coach:** Körpergewicht nur mit Wiege-Wörtern, „von Freitag auf Samstag“, Training auslassen, Rekorde,
  Tageskarten (`GET /v1/fit/coach/today`), ehrlicher Grund mit „Abo ansehen“, der Text bleibt bei Fehlern.

## Design: „das Trainingsheft“ (22.09.2026)

Vision mit Entscheidungsblatt und fünf Bildschirmen im Design-Canvas „Better Fit — Vision“
(https://claude.ai/artifact/NUkpUXufrzYWQ4Du1AbTi6). Better Fit spricht die Sprache der
BetterGym-Startseite (Canvas «GetBetter App-Design», Artboard Gesundheit): weisse Blöcke (`Panel`),
eine grosse Zahl je Bildschirm (`BigFigure`), geteilte Balken (`SegmentBar`), Signal nur für jetzt und
erledigt, Gesundheit-Rot nur für Marke, Rekord und Fälliges. Eigenes Zeichen: die Satz-Tabelle
SATZ · ZULETZT · KG · WDH · ✓ — und dieselbe Heft-Logik überall (Haken statt Ringe, Zeilen statt Kacheln).

- **Kopf**: `Header` hat `crumb.hue` — das rote Quadrat vor „GESUNDHEIT“ wie im Entwurf.
- **Ernährung**: „Heute noch“ (Zahl, Band je Mahlzeit, Eiweiss/KH/Fett), „Was passt noch“ mit Bild,
  „Getrunken“ mit den zehn Gläsern (`ui/GlassTiles.tsx`, auch auf der Startseite), „Der Tag“ als eine
  Liste mit Uhrzeit, dunkle Karte „Heute vom Coach“.
- **Training**: das Heft (`SetTable.tsx`), Pause als dunkle Leiste mit Signal-Kante, Scheiben gezeichnet,
  leise Karte „Neue Bestleistung“; Trainingsplan mit Wochenstreifen und Rhythmus-Raster (8 Wochen).
- **Fortschritt**: Veränderung gross mit echtem Minus, Waage als blasse Punkte, Trend als Linie
  (`WeightChart.tsx`, ohne SVG-Paket), Sätze je Muskelgruppe gegen letzte Woche, geschätztes Maximum.
- **Küche**: Pillen-Reiter, „Bald brauchen“, grosse Rezeptkarten mit Bild, Kochmodus mit Timer-Leiste,
  Wochenplan je Tag, Einkauf nach Abteilung mit „im Korb“ (`KitchenKit.tsx`, `KitchenMedia.tsx`,
  `RecipeCards.tsx`).
- **Rezeptbilder**: `packages/core/src/assets/recipes/<slug>.jpg`, erzeugt mit
  `python scripts/recipe-photos.py` (pollinations.ai, alle im selben Stil, Wasserzeichen weggeschnitten,
  480 px); `features/fit/recipeImages.ts` ordnet sie zu (eigene Rezepte über `basedOn`). Für den Store
  besser durch eigene oder lizenzierte Fotos ersetzen.
- **Namen**: `shortFoodName` (`features/fit/foodLabel.ts`, getestet) macht aus „Hühnerei, ganz, roh“
  „Hühnerei“ — in Listen, nie in der Suche. `portionText` sagt „1 Portion“ / „1.5 Portionen“.

## Abgleich mit der Schweizer Datenbank

Gemini liefert je Zutat drei Begriffe: `displayName` (Anzeige, Sprache der Person), `swissSearchTerm`
(deutsch, wie in der Schweizer Datenbank, freiwillig) und `canonicalSearchTerm` (englisch, für USDA). Gesucht
wird in dieser Reihenfolge, bis ein sicherer Treffer da ist. Die Anweisung verlangt eine Zutat je Eintrag
(Bolognese → Gehacktes und Tomatensauce), ohne Schrägstrich und ohne Zubereitung in Klammern.

Der Katalog (`fit/catalog/index.js`) sucht trotzdem tolerant: „A / B“ und Klammern werden zu Varianten,
Alltagswörter übersetzt (`EVERYDAY`: Spaghetti → Teigwaren ohne Ei, Hackfleisch → Gehacktes, Parmesan →
Hartkäse …). Bei amtlichen Namen zählt nur der Kopf vor dem ersten Komma für die Länge, Klammern sind
Nebensache, und jedes zusätzliche Wort, das weder gesucht, Zustand noch neutral ist, kostet ein wenig — so
gewinnt „Banane, roh“ vor „Banane, gedörrt“. Die Anzeige bleibt beim Wort der Person.

## Kosten und Grenzen

| | Wo | Standard |
| --- | --- | --- |
| Tageslimit Analysen je Person | `MAX_MEAL_ANALYSES_PER_USER_PER_DAY` | 10 |
| Monatsbudget über alle | `MONTHLY_AI_BUDGET_CHF` | 250; ab 80 % Warnung im Admin, ab 100 % keine bezahlte Analyse (von Hand eintragen geht weiter) |
| Kill-Switch | `FIT_AI_DISABLED=1` | aus |
| Rate-Limit je Konto / je IP | `FIT_RATE_LIMIT_PER_MINUTE` | 120 / 360 |
| Bilder je Analyse | `MAX_IMAGES_PER_ANALYSIS` | 2 |
| Modelle | `GEMINI_VISION_MODEL` · `GEMINI_CHEAP_MODEL` · `GEMINI_FALLBACK_MODEL` | `gemini-3.8-flash` (Fotos) · `gemini-3.5-flash-lite` (Nährwerttabelle) · `gemini-3.5-flash` (Ersatz bei Überlastung). Die 2.5er gibt es für neue Konten nicht mehr. |
| Preise (USD je Mio. Tokens, Stand 21.09.2026) | `FIT_GEMINI_PRICE_IN/_OUT`, `FIT_GEMINI_LITE_PRICE_IN/_OUT` | 1.50/7.50 und 0.30/2.50 — für 3.8 Flash bewusst der Preis ab 2027 (bis Ende 2026 die Hälfte). Denk-Tokens zählen als Ausgabe. Ein Foto kostet so gerechnet etwa 0.6 Rappen. |
| Zeitlimit / Wiederholung Gemini | fest | 30 s je Versuch, höchstens 55 s; bei 429/5xx zweimal nach 1 s und 2.5 s, dann einmal das Ersatzmodell |
| Coach, freie Fragen | bestehendes Abo-Kontingent BetterGym | 2.95 CHF/Monat mit Abo |

Je Analyse gespeichert: Modell, Bilder, Tokens, Laufzeit, Kosten, Status, Ampel,
Korrekturen, Gramm-Abweichung — nie Bild oder Text. Übersicht im Admin unter **Better Fit**.

## Offen / bewusst noch nicht

- **Auf echten Telefonen testen**: Kamera, Scanner und Fotos brauchen einen Dev-Build oder Expo Go auf iPhone/Android; im Browser geprüft ist nur der Web-Weg.
- **Studios**: Die Ausstattung ist eine typische Vorauswahl je Kette, keine Liste der einzelnen Filiale.
- **Sprache der Inhalte**: Oberfläche, Rezeptbibliothek, Übungen und Vorlagen in DE/EN/FR/IT. Lebensmittelnamen folgen der Sprache, sobald die Schweizer Datenbank mit `--fr/--it/--en` neu importiert ist — die eingelesene Fassung hat nur Deutsch.
- **Gewicht**: Mit Fit-Profil liest die BetterGym-Startseite das Gewicht aus Better Fit, und „Werte → Gewicht“ schreibt auch dorthin; die alten Einträge in `vitals` bleiben (keine Migration).
- **Menüplan / Training (alt)**: Die bisherigen Funktionen „Menüplan“ und „Training“ bleiben unverändert; die Startseite zeigt beim Essen jetzt Better Fit.
- **Icons** für die fünf neuen Funktionen: noch keine 3D-Bilder (`scripts/icons.js` würde alle Icons neu erzeugen); `ModuleIcon` zeichnet solange die Form.
- **Portionsgrössen im Wochenplan**: bei hohen Zielen teils 2.5–3 Portionen eines Rezepts; mehr kalorienreiche Rezepte würden das glätten.
- Schlaf- und Aktivitätsdaten aus Apple Health / Health Connect: braucht native Module und Store-Builds (Plan: „später“).

## Was der Eigentümer tun muss

| Schritt | Wo (offiziell) | Konto | Variable | Kosten |
| --- | --- | --- | --- | --- |
| ✅ erledigt 21.09.2026 — Schweizer Nährwertdatenbank (XLSX, V7.1) importiert; bei einer neuen Version: `node scripts/import-swiss-foods.js <datei.xlsx> --version <x>` | https://naehrwertdaten.ch/de/downloads/ | keins | – (Datei landet in `services/api/data/fit-catalog-swiss.json`) | gratis, kommerziell mit Quellenangabe erlaubt |
| ✅ erledigt 21.09.2026 — Gemini-Schlüssel mit Rechnungskonto; Ausgabenobergrenze setzen | https://aistudio.google.com/api-keys · https://aistudio.google.com/spend | Google-Konto einer volljährigen Person | `GEMINI_API_KEY` und `MEAL_ANALYSIS_MODE=live` in `services/api/.env.local` | In der Schweiz nur bezahlt (Prepay, mind. 5 USD); je Foto ca. 0.3–0.6 Rappen |
| USDA-Schlüssel beantragen | https://fdc.nal.usda.gov/api-key-signup | E-Mail genügt | `USDA_FDC_API_KEY` | gratis |
| Open Food Facts | https://openfoodfacts.github.io/openfoodfacts-server/api/ | keins | `ENABLE_OPEN_FOOD_FACTS=true` (Standard) | gratis, ODbL-Hinweis wird angezeigt |
| Supabase-Projekt (Produktion) und Migration einspielen | https://supabase.com/dashboard | Supabase-Konto | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (nur Backend) | Free-Plan möglich, Pro ab 25 USD/Monat |
| Testzugänge FatSecret / LogMeal (optional, Benchmark) | https://platform.fatsecret.com/platform-api · https://logmeal.com/api/ | Firmenkonto | später eigene Variablen | Angebot bzw. Credits |
| Datenschutzerklärung und Nutzungsbedingungen prüfen lassen | — | — | — | Fachperson |
| Apple- und Google-Entwicklerkonto, Veröffentlichung | https://developer.apple.com/programs/ · https://play.google.com/console | Firmen-/Privatkonto | — | 99 USD/Jahr bzw. 25 USD einmalig |

Nach jeder Änderung an `.env.local` den Dienst neu starten.

## Spruch des Tages (22.09.2026)

Jeden Tag ein anderer, für alle derselbe (Zürcher Tag): 40 selbst geschriebene Sätze in DE/FR/IT/EN (`i18n/*-fit8.ts`), Auswahl in `features/fit/quoteOfDay.ts` (getestet: in 40 Tagen jeder genau einmal). `DailyQuote.tsx` zeigt ihn ohne Karte unter dem Titel — in der Ernährung (nur heute) und auf der BetterGym-Startseite. Neue Sprüche: Schlüssel `fit.quote.<n>` in allen vier Sprachen ergänzen und `QUOTE_COUNT` erhöhen.

## 1 zu 1 nach der Vision (22.09.2026)

Alle fünf Bildschirme (Ernährung, Training, Trainingsplan, Küche, Fortschritt) sind Element für Element
gegen die Artboards im Canvas „Better Fit — Vision“ gebaut und Bild neben Bild verglichen (Chrome ohne
Fenster, Testkonto mit den Daten der Vision). Gemeinsame Kopfzeile `AreaHeader`
(`features/fit/KitchenKit.tsx`): Rubrik „GESUNDHEIT · …“ mit rotem Quadrat, Untertitel auf Wunsch
drückbar; das Plus als `FloatingButton compact`. Was der Entwurf nicht zeigt, liegt unter dem ersten
Bildschirm: Tag wählen per Tipp aufs Datum, „Ziele ändern“ und „Alle Angaben“ ganz unten, Gewicht
eintragen unter den drei Karten, Rezeptsuche unter den Rezeptkarten, Verpasst/Verlauf/Plan ändern im
Trainingsplan. Das Training ist ein eigener Bildschirm (kein Blatt); Reserve, Aufwärmsätze und Anleitung
stehen nicht mehr in der Standardansicht. Bewusst anders: im Browser sitzt alles 40 px höher, weil das
Artboard die Statusleiste (56 px) mitrechnet — am Telefon gleicht der Sicherheitsabstand das aus.

## Referenzwissen für die Foto-Analyse (22.09.2026)

Drei offene Datensätze sagen, wie viel üblicherweise auf dem Teller liegt —
damit die KI nur noch *was* erkennen muss und das *wie viel* auf Zahlen beruht.
Gebaut wird ein einziger Stand, `services/api/data/fit-reference/reference.json`
(3.1 MB, wie alles unter `data/` ausserhalb des Git).

| Quelle | Lizenz | Was daraus wird |
| --- | --- | --- |
| **Nutrition5k** (Google Research, Thames et al., CVPR 2021) | CC BY 4.0 | 5000 Cafeteria-Gerichte mit Gramm je Zutat → Zutaten-Priors und ähnliche Gerichte |
| **USDA FNDDS 2021–2023** (Agricultural Research Service) | Public Domain (U.S. Government Work) | 5377 Lebensmittel mit 16 404 Standardportionen („1 piece Lasagne 206 g“) |
| **menuCH 2014–15** (BLV, Nationale Ernährungserhebung) | Freie Nutzung, **Quellenangabe Pflicht** | 101 Lebensmittelkategorien mit der Schweizer Portion je Mahlzeit |

Der volle Wortlaut jeder Quellenangabe steht in
`services/api/fit/reference/sources.js` und wandert mit in `reference.json`
(`referenceStats().sources`). **Vor der Veröffentlichung gehören alle drei ins
Impressum der App** — bei menuCH ist die Nennung Lizenzbedingung, bei
Nutrition5k verlangt CC BY 4.0 Namensnennung.

### Was das Modul kann (`services/api/fit/reference/`)

`createReference({ dataDir })` gibt fünf Funktionen. Geladen wird erst beim
ersten Aufruf und nur einmal; fehlt die Datei oder ist sie kaputt, gibt es
leere Antworten (`null` bzw. `[]`), nie einen Fehler.

| Funktion | Antwort |
| --- | --- |
| `priorFor(term)` | Gramm-Verteilung einer Zutat (englischer Begriff): `{ key, match, n, p10, p25, median, p75, p90 }` oder `null` |
| `similarDishes(foods, k = 3)` | die `k` ähnlichsten **train**-Gerichte zu `[{ term, grams? }]`: `{ id, score, mass, kcal, ingredients }` |
| `portionHint(slot, germanTerm)` | Schweizer Median-Gramm einer Kategorie zur Mahlzeit: `{ category, nameEn, slot, requestedSlot, median, mean, n }` |
| `fnddsPortions(term, limit = 1)` | Standardportionen des passendsten Gerichts: `{ code, description, category, portions }` |
| `referenceStats()` | Zahlen und Quellen für den Admin |

Gesucht wird über Wörter, nie mit Zufall: dieselbe Anfrage gibt immer dieselbe
Antwort (`normalize.js` Einzahl und Schlüssel, `match.js` Priors und Gerichte,
`portions.js` menuCH und FNDDS). **Die Priors entstehen ausschliesslich aus den
train-Gerichten**, damit der Test-Split für den Benchmark sauber bleibt;
Gerichte ohne Masse, über 3000 kcal oder über 9 kcal je Gramm fallen vorher
weg (aktuell 6 von 5006).

### Neu bauen

```bash
node scripts/import-fit-reference.js          # liest services/api/data/fit-reference/, schreibt reference.json
node scripts/import-fit-reference.js <ordner> --out <datei>
```

Erwartet werden die heruntergeladenen Quellen unter
`services/api/data/fit-reference/`: `nutrition5k/dish_metadata_cafe1.csv` und
`…cafe2.csv`, `nutrition5k/dish_ids/splits/rgb_train_ids.txt` und
`rgb_test_ids.txt`, `fndds/Portions_and_Weights.xlsx`,
`menuch/portion_sizes_per_meal.xlsx`. Das Skript schreibt die Zahlen in die
Konsole (Gerichte, Splits, verworfene, Priors, Portionen, Kategorien) und ist
wiederholbar: zwei Läufe geben dieselbe Datei, bis aufs `builtAt`.

Tests liegen neben dem Code und kommen ohne die 3 MB aus:

```bash
npx -y node@24 --import ./scripts/test-setup.mjs --test "services/api/fit/reference/*.test.js"
```

## Foto-Benchmark gegen Nutrition5k (22.09.2026)

Wie genau schätzt die Foto-Analyse? Gemessen wird über die **echte Pipeline**:
ein eigener Dienst im Temp-Ordner (`services/api/test/fitHarness.js`,
`MEAL_ANALYSIS_MODE=live`, Schweizer Katalog, Referenzdaten), ein Konto, ein
Profil, dann je Gericht `POST /v1/fit/meal-analysis/start` — genau wie die App.
Wahrheit sind die Nutrition5k-Gerichte (Google Research, CC BY 4.0) aus
`services/api/data/fit-reference/nutrition5k/`; keine Rückfrage wird
beantwortet, es zählt die erste Antwort.

```bash
npx -y node@24 scripts/fit-benchmark.js --n 40 --split test --seed 1 \
  --label baseline2 --max-chf 1.0 --concurrency 1
npx -y node@24 scripts/fit-benchmark.js --compare a.json b.json
```

Ergebnis je Lauf: `services/api/data/fit-reference/benchmarks/<datum>-<label>.json`
und `.md` daneben. `scripts/benchmark/` hält die Teile: `nutrition5k.js` (lesen),
`metrics.js` (Kennzahlen), `report.js` (Markdown), `compare.js` (zwei Läufe
nebeneinander), `preflight.js` (Kontingent vorab fragen).

| Option | |
| --- | --- |
| `--n` `--split` `--seed` | Stichprobe; der Seed mischt den Split deterministisch |
| `--label` | Name der Ausgabedatei — **derselbe Name setzt einen Lauf fort** |
| `--variant <text>` | Freitext in die JSON, um Läufe später zu unterscheiden |
| `--concurrency` | Standard **1**; mehr heisst 429 und falsch gemessenes Modell |
| `--pause-ms` `--retries` | Pause zwischen Gerichten (2000), Wiederholungen (3) |
| `--vision-model` | ein anderes Modell messen, statt dem aus `fit/config.js` |
| `--allow-fallback` | das Ersatzmodell des Dienstes wieder zulassen |
| `--max-chf` | Kostendeckel; auch Fehlversuche zählen mit |

**Sequenziell und ohne Ersatzmodell, mit Absicht.** Parallele Anfragen laufen
bei Gemini reihenweise in 429; der Dienst weicht dann still auf
`GEMINI_FALLBACK_MODEL` aus, und gemessen wäre das falsche Modell. Darum setzt
der Benchmark `GEMINI_FALLBACK_MODEL=''`, wiederholt selbst mit 5 s / 15 s / 40 s
und schreibt **je Gericht, welches Modell geantwortet hat**; die Zusammenfassung
zählt, wie oft ausgewichen wurde (mit `--allow-fallback` auch wirklich mehr als 0).

**Fortsetzbar:** derselbe `--label` schreibt dieselbe Datei weiter. Fertige
Gerichte bleiben stehen, nur die offenen und die gescheiterten werden neu geholt.

### Das Tageskontingent ist die Grenze, nicht der Code

Der Gratis-Zugang von Gemini erlaubt **20 Anfragen je Modell und Tag**
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Ein Lauf über 40 Gerichte
geht damit **nicht** — und weil der Dienst nur `provider_busy` meldet, sah das
vorher nach Überlastung aus. Darum fragt `preflight.js` vor dem Lauf einmal beim
Modell nach und bricht sofort ab, statt eine halbe Stunde ins Leere zu laufen;
scheitern mitten im Lauf drei Gerichte hintereinander, wird nochmal nachgefragt
und Schluss gemacht. Für einen vollen Lauf braucht es die Abrechnung bei Google
— sonst geht es nur in Tagesportionen über `--label`.

### Stand (22.09.2026)

`2026-09-22-baseline.json` (n=40, `gemini-3.5-flash`, parallel) taugt nur als
Warnung: 12 von 40 Gerichten, der Rest 429, und gemessen wurde das Ersatzmodell.
`2026-09-22-baseline2-36flash.json` (n=12, `gemini-3.6-flash`, sequenziell) ist
der erste saubere Lauf: 10 von 12, kcal-Fehler Median 23 %, innerhalb ±15 % erst
30 %, Zutaten-Recall 74 %, CHF 0.006 je Gericht, 5 s je Gericht.

Was durchgehend auffällt und die Priors angehen sollen:

- **Dichte schlägt Volumen.** Was klein und fett ist, wird unterschätzt
  (118 g Mandeln → 80 g geschätzt, −72 % kcal), was gross und luftig ist,
  überschätzt. Das Modell schätzt Fläche, nicht Masse.
- **Erfundene Beilagen.** Öl, Dressing und Butter werden dazugedichtet, wo die
  Wahrheit nichts davon kennt (Wurst 60 g → „Wurst 120 g + Öl 8 g“, +55 %).
- **Verdeckte Zutaten fehlen.** Was unter anderem liegt, fällt weg
  (67 g Oliven übersehen) — der Recall hängt an der Sicht von oben.
- **Runde Zahlen.** Geschätzt wird in 10-g-Schritten; bei kleinen Gerichten ist
  das allein schon zweistellig Prozent.
