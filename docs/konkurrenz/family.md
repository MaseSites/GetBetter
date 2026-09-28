# BetterFamily gegen die Konkurrenz

Stand: 25.09.2026. Recherche zu Familienkalender, Einkaufsliste, Ämtli,
Rezepte, Pflanzen, Haustiere, Fahrzeuge und Haushalt/Einladungen. Code
gelesen, nichts geändert.

Leitlinie (Severin): Einrichten ≤ 1 Minute, ein Plus für das Häufigste, alle
Funktionen schauen aufeinander. Nichts, was es schon gibt.

## 1. Was es bei uns wirklich gibt

| Bereich | Stand im Code | Datei |
| --- | --- | --- |
| Haushalt | bis 3 Haushalte, Rollen Verwalter/Mitglied, Code (6 Zeichen), Link, Benutzername, Beitritt prüft der Dienst | `packages/core/src/db/households.ts`, `features/household/` |
| Familienkalender | Tag/Woche/Monat, eine Quelle je Haushalt, mehrere Zielkalender je Termin, Personen ansehen | `features/calendar/` |
| Einkaufsliste | eine Liste je Haushalt, Abteilungen geraten (`guessCategory`), Menge aus „2 Bananen“ (`splitQuantity`), abhaken, „im Korb“, Erledigtes leeren. **Kein Bearbeiten**, keine Vorschläge, keine zweite Liste | `db/repositories.ts` (`shopping`), `features/shopping/` |
| Ämtli | Titel, zuständig (oder offen), Wiederholung einmal/täglich/wöchentlich/monatlich, „Meine“, zuletzt erledigt von. **Kein Wechsel reihum**, keine Punkte, nicht im Kalender | `db/repositories.ts` (`chores`), `features/chores/ChoresView.tsx` |
| Rezepte | Personen, Zutaten je Zeile, Schritte, Tags, „Zutaten auf die Einkaufsliste“. **Ohne Umrechnen der Personen, ohne Entdoppeln**, kein Import | `features/family/RecipesView.tsx` |
| Pflanzen | Ort, Rhythmus, „Heute giessen“, gegossen setzt neu | `db/family.ts` (`plantDueDay`) |
| Haustiere | Art, Geburtstag, Termine (Tierarzt, Impfung, Entwurmung, Pflege), Demnächst. Kein Gewicht, keine Wiederholung | `features/family/PetsView.tsx` |
| Fahrzeuge | Kennzeichen, Service, Reifen, Vignettenjahr, km; rot in 30 Tagen | `features/family/VehiclesView.tsx` |
| Startseite | Liste, Rezepte, giessen, Tiertermine, Auto, Familientermine | `features/family/FamilySections.tsx`, `screens/HouseholdHomeScreen.tsx` |
| Quer | Assistent kennt Einkauf/Ämtli (`features/assistant/`), Better Fit schickt Einkauf **entdoppelt** (`features/fit/familyPlan.ts`, getestet), GetBetter → BetterFamily per Tiefenlink (`app/bridge.ts`) |

## 2. Die Konkurrenz kurz

| App | Stärke | Was nervt / neu |
| --- | --- | --- |
| **Bring!** (Zürich) | Kachel- oder Listenansicht, Echtzeit-Teilen, Rezepte mit einem Tipp auf die Liste, eigene Rezeptvorlagen, mehrere Listen (je Laden/Anlass), Migros-Cumulus- und Coop-Supercard hinterlegen, Angebote/Prospekte, Watch, Siri/Alexa | überladen: „Inspiration“ und „Angebote“ mit roten Punkten, Werbung, Push „Kauf doch mal wieder ein“; Premium (~14 €/Jahr) nimmt nur Werbung weg |
| **Cozi** | Klassiker: Kalender, Listen, Rezepte, Essensplan | seit 2024 Gratis nur 30 Tage Kalender, Werbung, Trustpilot 2.1, altes Design, keine KI |
| **FamilyWall** | breit (iOS/Android/Web/Windows), Kalender, Listen, Chat, Fotos | Essensplan, Sync, Ortung nur Premium (~45 $/Jahr); Berichte über ausfallende Mitteilungen und Datenverlust; keine KI |
| **Maple** | KI macht aus Schul-E-Mails Termine und Aufgaben, Ämtli, Essensplan, Einkauf | Sync und Mail-Import nur Maple+ (40 $/Jahr) |
| **TimeTree** | geteilte Kalender, Kommentare am Termin, Redesign Jan. 2026 | Werbung, Premium teuer; Kalender-Chat 2025 abgeschafft |
| **OurHome** | Punkte → Belohnungen für Kinder, wiederkehrende Ämtli, 2025 bessere Erinnerungen | Auszahlung von Hand |
| **Sweepy / Tody** | Zimmer mit „Schmutz-Balken“: fällig nach Zustand, nicht nach festem Tag; Sweepy verteilt täglich automatisch, Rangliste, Punkte 1–3 je Aufgabe | eher Putzen als Familie |
| **AnyList** | beste geteilte Liste, nach Gang sortiert, Rezepte entdoppeln auf die Liste | Gratis-Import nur 5 Rezepte |
| **Paprika** | Rezept-Import aus dem Web, Zutaten zusammenfassen, Skalieren | einmal zahlen je Plattform |
| **Mealime** | Wochenplan in < 3 Min., Einkauf nach Gang, Vorrat-Abgleich | **schliesst am 21.10.2026** — Nutzer suchen Ersatz; Liste nicht bearbeitbar (2 → 3 Äpfel geht nicht) |
| **Skylight / Hearth** | Wand-Bildschirm: Kalender, Ämtli-Tabelle je Kind, Essensplan, „Magic Import“ | Hardware + Abo (Plus 79 $/Jahr) |
| **Planta / Greg** | Giessen nach Art, Licht, Topf, Wetter (Greg: Penman-Monteith), Lichtmesser, Tagebuch | Premium 30 $/Jahr, viel Einrichten |
| **11pets** | Impfpass, Medikamente, **Gewicht**, Dokumente, mit Tierarzt teilen | eigene App nur fürs Tier |
| **Apple Erinnerungen** | Familienliste automatisch, Einkaufsliste sortiert selbst, Mitteilung, wenn jemand etwas hinzufügt | nur Apple |
| **Gemeinde-Apps** (ERZ Zürich, Bern, St. Gallen, Winterthur, Sammelkalender ZKRI/REAL, Trennio) | Kehricht, Papier/Karton, Grüngut mit Push am Vorabend, ICS-Import | je Gemeinde eine App, nichts verbunden |

## 3. Wo wir schon besser sind

1. **Ohne Werbung, ohne Kalender-Sperre.** Cozi (30 Tage), FamilyWall, TimeTree und Bring! leben von Werbung oder Sperren — bei uns ist die ganze App gratis, nur KI/Aussehen im Abo.
2. **Alles in einem Haushalt, eine Datenbank.** Liste, Ämtli, Rezepte, Pflanzen, Tiere, Auto und Kalender teilen denselben Haushalt — bei der Konkurrenz sind das 4–6 Apps (Bring! + Cozi + Planta + 11pets + Gemeinde-App).
3. **Better Fit → Einkauf entdoppelt** (`familyPlan.ts`): gleiche Posten werden eins, Mengen nur angehoben. Das kann Mealime/AnyList, Bring! nicht.
4. **Assistent, der die Liste bedient**, in vier Sprachen inkl. Französisch/Italienisch — Maple hat KI, aber nur Englisch und nur im Abo.
5. **Einladen dreifach** (Code, Link, Benutzername) mit Beitritt über den Dienst; kein Konto bei einem US-Anbieter nötig, Daten in der Schweiz (Safe Swiss Cloud).
6. **Schweizer Kleinigkeiten schon drin:** Rüebli, Zopf, Weggli, Bürli in `guessCategory`; Vignette am Fahrzeug; „Ämtli“ als Wort.
7. **Fahrzeuge** (Service, Reifen, Vignette) hat keiner der Familien-Organizer.

## 4. Die 10 wichtigsten Lücken (Wirkung ÷ Aufwand)

Reihenfolge nach Wirkung geteilt durch Aufwand. W = Wirkung, A = Aufwand (1–5).

| # | Lücke | Vorbild | W/A | Warum | Wo bei uns |
| --- | --- | --- | --- | --- | --- |
| 1 | **Rezept → Einkauf entdoppeln und nach Personen umrechnen** | AnyList, Paprika, Mealime | 5/1 | Heute legt `toShopping` jede Zeile neu an — zweimal tippen = doppelt kaufen; „4 Personen“ wird nie umgerechnet. `planFamilyUpdate` gibt es schon | `features/family/RecipesView.tsx` (`toShopping`), `features/fit/familyPlan.ts` |
| 2 | **Häufige Posten als Vorschläge** (tippen statt tippen) | Bring! Kacheln, Apple, AnyList | 5/1 | Das Häufigste ist Wiederkaufen. Aus erledigten Zeilen die Top 12 rechnen, als Chips über dem Feld | `features/shopping/` (neu `frequent.ts`), `ShoppingView.tsx` |
| 3 | **Posten bearbeiten** (Menge, Name, Abteilung) und gleiche Namen zusammenführen beim Anlegen | Mealime-Kritik, AnyList | 4/1 | Einzige Korrektur heute: löschen und neu. `shopping.add` prüft nicht auf „Milch“ offen | `db/repositories.ts` (`shopping` hat kein `update`) |
| 4 | **Ämtli reihum** (Rotation) | Ämtliplan-Tradition CH, Sweepy, Skylight | 5/2 | Der Schweizer Ämtliplan wechselt wöchentlich (oft sonntags). `complete()` setzt nur neue Frist, nicht die nächste Person | `db/repositories.ts` (`chores.complete`), `ChoreRow` in `db/types.ts` |
| 5 | **Ämtli, Tiertermine, Service/Vignette im Familienkalender** | Cozi, Skylight, Maple | 4/2 | „Alle Funktionen schauen aufeinander“: heute sieht der Kalender nichts davon. Gedacht wie Geburtstage (`birthdaysBetween`), nicht gespeichert | `features/calendar/`, `db/family.ts` |
| 6 | **Entsorgungskalender** (Kehricht, Papier, Karton, Grüngut) | ERZ-App, Bern, Sammelkalender | 5/3 | Rein schweizerisch, jede Familie braucht es, keine Familien-App hat es. Einfach: Wochentag + Rhythmus je Sammlung (wie Pflanzen), später ICS-Import der Gemeinde | neu `features/family/waste*`, Muster `plantDueDay` |
| 7 | **Punkte/Sackgeld für Kinder-Ämtli** | OurHome, Sweepy | 3/2 | Motivation für Kinder; `lastDoneBy` gibt es schon, Summe je Woche ist reine Rechnung | `features/chores/`, `ChoreRow` |
| 8 | **Mehrere Listen** (Migros/Coop/Landi, Party) | Bring!, AnyList | 3/3 | Häufiger Wunsch, braucht aber Feld `listId` und Auswahl — erst nach 1–3 | `ShoppingItemRow` |
| 9 | **Tier: Gewicht und wiederkehrende Termine** (Impfung jährlich, Entwurmung alle 3 Monate) | 11pets | 3/2 | Heute muss jede Impfung neu erfasst werden; „Nächste“ aus „letzte + Rhythmus“ rechnen | `PetEventRow`, `features/family/PetsView.tsx` |
| 10 | **Wochen-Essensplan in BetterFamily** (Rezept auf Tag → Liste) | Mealime (schliesst!), Cozi, Skylight | 4/4 | Better Fit hat einen Wochenplan, aber in BetterGym und pro Person. Mealime-Nutzer suchen ab Oktober Ersatz. Zuerst prüfen, ob `fitKitchen` wiederverwendbar ist | `db/fitKitchen.ts`, `features/family/RecipesView.tsx` |

Bewusst **nicht** vorgeschlagen: Angebote/Prospekte (genau das, was an Bring!
nervt), Kundenkarten (Migros- und Coop-App können das selbst), Ortung
(FamilyWall; Datenschutz), Wand-Bildschirm-Hardware, Pflanzen-Bilderkennung
(nativ, teuer). E-Mail → Termin (Maple) ist stark, gehört aber zu GetBetter/E-Mail.

## 5. Schnelle Gewinne (je wenige Stunden, keine nativen Pakete)

1. **Rezept → Liste über `planFamilyUpdate`, mit Personen umrechnen.**
   Reine Funktion `scaleIngredient(line, from, to)` (Zahl vor der Zutat mal
   Faktor, gerundet auf sinnvolle Stufen: ½, 1, 1½ … bzw. 50 g), getestet.
   Im Blatt ein Zähler „für 2 · 4 · 6 Personen“, dann dieselbe Entdoppelung
   wie Better Fit. Satz danach: „5 neu, 2 schon auf der Liste“.
   Dateien: `features/family/scale.ts` (+ `.test.ts`), `RecipesView.tsx`,
   `features/fit/familyShopping.ts` wiederverwenden.
2. **Oft gekauft als Chips.** `frequentItems(rows, now)` zählt Namen über
   alle (auch erledigten) Zeilen, gewichtet nach Alter, ohne was schon offen
   steht, max. 12 — getestet. Chips unter dem Feld, ein Tipp legt an. Braucht:
   `clearDone` löscht heute die Geschichte → vorher je Name einen Zähler
   merken oder Erledigtes erst nach 30 Tagen wegräumen.
   Dateien: `features/shopping/frequent.ts`, `ShoppingView.tsx`.
3. **Ämtli reihum.** Feld `rotation?: string[]` (Konto-Ids) am `ChoreRow`;
   reine Funktion `nextAssignee(chore)` → nach dem Erledigen ist die nächste
   Person dran, getestet. Im Editor ein Schalter „Reihum“ mit den
   Mitgliedern angehakt. Dateien: `db/types.ts`, `db/repositories.ts`
   (`chores.complete`), `features/chores/rotation.ts`, `ChoresView.tsx`.
4. **Gleiche Posten zusammenführen beim Anlegen.** `shopping.add` sucht einen
   offenen Posten gleichen Namens (`de-CH`, klein) und hebt die Menge an
   (Logik aus `familyPlan.ts`: gleiche Einheit addieren, sonst „+1“) statt
   eine zweite Zeile. Dazu `shopping.update(id, patch)` für Menge/Abteilung,
   im Kontextmenü „Menge ändern“. Dateien: `db/repositories.ts`,
   `features/shopping/merge.ts` (+ Test).
5. **Fälliges aus der Familie im Kalender.** `familyDatesBetween(from, to,
   { chores, petEvents, vehicles })` liefert gedachte Ganztags-Einträge
   („Rex · Impfung“, „Auto · Service“, „Ämtli: Altpapier“) wie
   `birthdaysBetween`, Ids `family:<art>:<id>:<tag>`, ein Tipp öffnet die
   Funktion. Getestet, nur im Familienkalender. Dateien:
   `features/family/familyDates.ts`, `features/calendar/CalendarView.tsx`.

Danach der grösste Schritt mit Schweizer Alleinstellung: **Entsorgung** (#6)
als eigene kleine Funktion — Sammlung, Wochentag, Rhythmus („jeden 2.
Donnerstag“), Erinnerung am Vorabend auf dem Handy (über die bestehende
`expo-notifications`-Planung), auf der Startseite „Morgen: Karton“.

## Quellen

- Bring!: [getbring.com](https://www.getbring.com/en/home) ·
  [Rezepte mit Einkaufsliste](https://www.getbring.com/en/features/inspired) ·
  [App Store CH](https://apps.apple.com/ch/app/bring-einkaufsliste-rezepte/id580669177) ·
  [Migros- und Coop-Karten in Bring! (PCtipp)](https://www.pctipp.ch/praxis/apps/migros-coop-karten-in-bring-hinterlegen-so-gehts-2607474.html) ·
  [Kritik, Premium (iphone-ticker)](https://www.iphone-ticker.de/einkaufsliste-bring-jetzt-mit-premium-abo-155218/) ·
  [Premium 14 € (mobiflip)](https://www.mobiflip.de/shortnews/bring-einkaufsliste-premium/) ·
  [Vergleich Einkaufslisten 2026 (lexicanum)](https://lexicanum.de/online/die-besten-einkaufslisten-apps-2026-im-vergleich/)
- Cozi: [Review 2026 nach der Paywall](https://www.usecalendara.com/blog/cozi-review-2026) ·
  [Cozi Gold Preise 2026](https://www.usecalendara.com/blog/cozi-pricing-2026) ·
  [Cozi-Review (OurCal)](https://ourcal.com/blog/cozi-app-review-2025)
- FamilyWall: [Review 2026](https://www.usecalendara.com/blog/familywall-review-2026) ·
  [Ist es gratis? (RemindHer)](https://remindher.app/familywall-review/)
- Maple: [Maple Email](https://www.growmaple.com/email) ·
  [2025 in Review](https://www.growmaple.com/blog-posts/2025-maple-in-review) ·
  [App Store](https://apps.apple.com/us/app/maple-family-organizer/id1551070188)
- TimeTree: [Google Play](https://play.google.com/store/apps/details?id=works.jubilee.timetree&hl=en_US) ·
  [Review (OurCal)](https://ourcal.com/blog/timetree-app-review)
- OurHome: [Alternativen 2026 (Sense)](https://getsense.ai/blog/posts/best-ourhome-alternatives-2025) ·
  [Review (Tidied)](https://www.tidied.app/blog/ourhome-app-review)
- Sweepy/Tody: [sweepy.com](https://sweepy.com/) ·
  [Sweepy Review 2025 (Tidied)](https://www.tidied.app/blog/sweepy-app-review) ·
  [Tody vs Sweepy (Plastnofy)](https://plastnofy.com/articles/tody-vs-sweepy)
- AnyList/Paprika/Mealime: [Grocery-List-Apps 2026 (Fond)](https://fond.kitchen/guides/best-grocery-list-apps/) ·
  [AnyList Review 2026 (Pann)](https://www.pann-app.com/blog/anylist-review) ·
  [Mealime Review 2026, Schliessung](https://thesunrisedigest.com/eat/mealime-review-2026/) ·
  [mealime.com](https://www.mealime.com/)
- Skylight/Hearth: [Hearth vs Skylight 2026 (Quality Edit)](https://www.thequalityedit.com/articles/hearth-vs-skylight-review) ·
  [Skylight Review 2026 (Taste of Home)](https://www.tasteofhome.com/article/skylight-calendar-review/)
- Planta/Greg: [getplanta.com](https://getplanta.com/) ·
  [Greg vs Planta 2026](https://plantidentifierfree.app/blog/greg-vs-planta) ·
  [Greg App Store](https://apps.apple.com/us/app/greg-plant-identifier-care/id1512912236)
- 11pets: [App Store](https://apps.apple.com/us/app/11pets-pet-care/id1232470530) ·
  [Pet-Care-Apps 2026 (Petio)](https://www.petiogo.com/blog/best-pet-care-apps-2026)
- Apple: [Listen teilen in Erinnerungen](https://support.apple.com/guide/iphone/share-and-collaborate-iph2a8f9121e/ios) ·
  [Einkaufsliste in Erinnerungen](https://support.apple.com/en-my/guide/iphone/iph80ba26e1f/ios)
- Entsorgung CH: [ERZ-App Zürich](https://www.stadt-zuerich.ch/de/umwelt-und-energie/entsorgung/entsorgungskalender/erz-app.html) ·
  [Entsorgungs-App Bern](https://www.bern.ch/themen/abfall/abfuhr/abfuhrdaten/app) ·
  [Kalender-Import Bern](https://www.bern.ch/themen/abfall/abfuhr/abfuhrdaten/entsorgungskalender) ·
  [Winterthur](https://stadt.winterthur.ch/gemeinde/verwaltung/stadtkanzlei/kommunikation-stadt-winterthur/medienmitteilungen-stadt-winterthur/digitaler-abfallkalender-fuer-smartphones) ·
  [Sammelkalender-App](https://info.sammelkalender.ch/produkte1/app) ·
  [Trennio](http://trennio.app/)
- Ämtliplan: [Famigros](https://famigros.migros.ch/de/kinder-und-jugendliche/schule-und-ausbildung/schulanfang/aemtliplan-fuer-zuhause) ·
  [familienleben.ch](https://www.familienleben.ch/kind/kleinkind/der-aemtliplan-so-lernen-kinder-im-haushalt-mitzuhelfen-5928) ·
  [Vorlagen (muster-vorlage.ch)](https://muster-vorlage.ch/aemtliplan-vorlage/)
