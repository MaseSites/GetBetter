# GetBetter und die Better-Apps

Fünf eigenständige Expo-Apps in einem Arbeitsbereich, die sich einen Kern und
**eine Datenbank** teilen. **GetBetter** ist die Hauptapp und die Schaltzentrale;
die anderen decken je einen Bereich ab. Der ursprüngliche Plan liegt in
[docs/plan-prototyp-hauptapp.md](docs/plan-prototyp-hauptapp.md); er beschreibt
noch die Zeit, als alles eine App war.

## Die Apps

| App              | Ordner              | Schema            | Web  | Was drin ist                                                                                                                                |
| ---------------- | ------------------- | ----------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **GetBetter**    | `apps/getbetter`    | `getbetter://`    | 8081 | Privater Kalender, Aufgaben, Notizen, Wecker, Dokumente, Gewohnheiten, Reisen, Kontakte — alles ausgebaut, dazu Assistent und App-Übersicht |
| **BetterFamily** | `apps/betterfamily` | `betterfamily://` | 8082 | Familienkalender, Einkaufsliste, Ämtli, Rezepte, Pflanzen, Haustiere, Fahrzeuge — samt Haushalt, alles ausgebaut                            |
| **BetterGym**    | `apps/bettergym`    | `bettergym://`    | 8083 | Training mit Sätzen und Vorlagen, Menüplan, Trinken, Schlaf, Medikamente, Werte, Kopf frei — alles ausgebaut                                |
| **BetterAi**     | `apps/betterai`     | `betterai://`     | 8084 | Die Gespräche mit der KI, gespeichert und als Liste — sonst nichts                                                                          |
| **BetterMoney**  | `apps/bettermoney`  | `bettermoney://`  | 8085 | Budget, Rechnungen, Abos, Sparziele — alle vier ausgebaut                                                                                   |

`APP_MODULES` in `packages/core/src/app/identity.ts` ist die Wahrheit darüber,
welche App welche Module führt. `calendar` steht in zwei Apps: GetBetter führt
den privaten, BetterFamily den Familienkalender — `hasHouseholds()` entscheidet,
welcher gemeint ist.

## Starten

```bash
npm install        # einmal, für alle Arbeitsbereiche
npm run all        # Datenbank und alle fünf Apps auf einmal
npm run server     # nur die Datenbank (8090)
npm run web        # GetBetter im Browser (8081)
npm run family     # BetterFamily (8082)
npm run gym        # BetterGym (8083)
npm run ai         # BetterAi (8084)
npm run money      # BetterMoney (8085)
npm run typecheck  # tsc über alles, danach über die Tests
npm run lint
npm test           # die reinen Rechenteile, unter Node
node scripts/icons.js   # alle Bilder neu erzeugen
```

## Tests

`npm test` lässt Node die `*.test.ts` neben dem Code laufen — ohne Jest, ohne
Bundler: Node streift die Typen selbst ab, `scripts/test-hooks.mjs` löst
`@/…` und Importe ohne Endung auf. Getestet wird, was ohne App und Datenbank
rechnet: Beträge (`features/money/amount.ts`), Abteilungen und Mengen
(`features/shopping/categories.ts`), Tage und Geburtstage
(`features/shared/days.ts`), die Datumsrechnung des Kalenders
(`features/calendar/dates.ts`) und `db/pure.ts` — dort liegen `dayKey`,
`monthKey`, `sleepMinutes` und `chatTitleOf`, bewusst ohne Speicher dahinter.
Eine Datei, die getestet werden soll, importiert deshalb relativ, nicht über
den Speicher-Index. `tsconfig.test.json` prüft die Tests mit den Node-Typen.

Wirft ein Bildschirm, fängt `app/ErrorBoundary.tsx` das ab und zeigt statt
eines weissen Blatts „Da ist etwas schiefgegangen“ mit „Nochmal versuchen“.

`/ui-kit` (nur in GetBetter) zeigt jeden UI-Baustein in allen Zuständen.

## Aufbau

```
packages/core/src/     Der gemeinsame Kern — jede App zieht ihn über `@/…`
  app/                 identity.ts (welche App bin ich), RootShell, tabs, bridge
  screens/             Bildschirme, die alle Apps gleich brauchen
  theme/ ui/ i18n/     Aussehen, Bausteine, Sprache
  db/ auth/ state/     Speicher, Konten, Sitzung
  features/            Kalender, Aufgaben, Notizen, Einkauf, Ämtli, Wecker, Gym,
                       KI, Assistent, Haushalt, Onboarding, Apps
  assets/              Erzeugte Logos (nicht von Hand anfassen)
apps/<name>/
  app/                 Nur die Routen — meist einzeilige Verweise auf den Kern
  app.json             Name, Schema, Store-Kennung, Splash, Icons
  eas.json             Bauprofile
  assets/              Erzeugte Store-Bilder
  metro.config.js      Beobachtet auch den Kern ausserhalb des App-Ordners
services/api/          Die Datenbank: ein Node-Dienst ohne Abhängigkeiten
scripts/               dev.js (alles starten), icons.js (alle Bilder)
```

Die Routen sind absichtlich dünn: `export { WorkspaceScreen as default } from '@/screens';`.
Was an einer App wirklich anders ist, steht in ihrer `app.json` und in ihrem
`(tabs)/_layout.tsx`.

## Eine Datenbank für alle Apps

`services/api/server.js` hält alles in einer JSON-Datei
(`services/api/data/db.json`, nicht im Git): Konten, Termine, Listen,
Haushalte, Training. Jede App lädt beim Start den ganzen Stand (`GET /v1/db`),
hält ihn im Speicher (`db/store.ts`) und schreibt geänderte Sammlungen zurück
(`PUT /v1/db/:collection`). Alle vier Sekunden fragt sie nach der Revision und
lädt neu, wenn eine andere App etwas geändert hat — so landen die Zahlen aus
BetterGym ohne Neuladen auf der GetBetter-Karte.

Antwortet der Dienst nicht, zeigt `RootShell` einen Bildschirm mit „Nochmal
versuchen“. Ohne erfolgreiches Laden wird nie geschrieben, damit ein leerer
Stand nichts überschreibt.

| Route                                |                                          |
| ------------------------------------ | ---------------------------------------- |
| `GET /v1/db`                         | Alles, ohne Passwort-Hashes              |
| `PUT /v1/db/:collection`             | Eine Sammlung ersetzen                   |
| `GET /v1/revision`                   | Hat sich etwas geändert?                 |
| `POST /v1/accounts`                  | Registrieren                             |
| `POST /v1/sessions`                  | Anmelden                                 |
| `GET /v1/accounts/:id`               | Konto lesen                              |
| `GET /v1/accounts/by-username/:name` | Für Einladungen                          |
| `PATCH /v1/accounts/:id`             | Vorname, Sprache, Benutzername, Aussehen |

`db/service.ts` ist der Draht dorthin (`serviceUrl()`, im Bau über
`EXPO_PUBLIC_API_URL` übersteuerbar), `auth/accounts.ts` die Schicht darüber.
Passwörter prüft nur der Dienst, mit scrypt über Salt und Passwort; Salt und
Hash verlassen ihn nie. Konten-Ids sind aus der E-Mail abgeleitet, damit jede
App dasselbe Konto meint.

Die Sammlung `appAccess` merkt sich, in welcher App ein Konto schon einmal war
(`appAccess.markSeen`). Darauf beruht in GetBetter der Unterschied zwischen
„freigeschaltet“ und „Installieren“.

Der Dienst ist für die Entwicklung gedacht: kein HTTPS, keine Zugriffstoken,
keine Ratenbegrenzung (siehe `services/api/README.md`). Vor einer echten
Veröffentlichung gehört die Datenbank hinter einen richtigen Server.

## Aufträge zwischen den Apps

Neben der gemeinsamen Datenbank gibt es **Aufträge per Tiefenlink**
(`packages/core/src/app/bridge.ts`):

```
getbetter        →  betterfamily://befehl/einkauf?text=2%20Bananen
```

Der Assistent in GetBetter erkennt ein paar Muster
(`features/assistant/route.ts`) und schickt sie los; die andere App fängt sie
auf ihrer Route `befehl/[command]` auf, trägt sie ein und sagt, was daraus
wurde. Es wirkt nur, wenn die andere App auf demselben Gerät installiert ist;
im Browser gibt es keine Schemata, dort nimmt die Brücke `localhost:<port>`.

## Die zwei KI-Oberflächen

|       | Assistent (Tab in GetBetter)                                      | BetterAi                                  |
| ----- | ----------------------------------------------------------------- | ----------------------------------------- |
| Was   | Verwaltet quer über die Apps, schickt Aufträge los                | Ein ganz normales KI-Gespräch             |
| Wo    | `features/assistant/AssistantView.tsx`                            | `features/ai/ChatsView.tsx`, `/chat/[id]` |
| Daten | Liest deine GetBetter-Daten, schickt Aufträge an die anderen Apps | Sieht deine Daten nicht                   |

Der Assistent hat keinen Kopfbereich: in der Mitte steht „Wie kann ich dich
unterstützen?“, unten das Feld. Hinter beiden steckt noch kein Modell — was
nicht als Auftrag erkannt wird, beantwortet er einmal ehrlich.

BetterAi führt die Gespräche in der Datenbank (`chats`, `chatMessages`,
`db/chats.ts`): die Startseite ist die Liste, das Neueste zuerst, mit der
letzten Nachricht als Vorschau; ein Anfang-Chip legt ein Gespräch mit dieser
Frage an, der Titel ist die erste Frage. `AiChatView` ohne `chatId` (die
Funktion in GetBetter) lebt nur bis zum Schliessen.

## Haushalte (BetterFamily)

`db/households.ts` — Haushalt, Mitgliedschaften, Rollen. Ein Haushalt hat einen
sechsstelligen Einladungscode (ohne I, O, 0, 1). Wer anlegt, wird Verwalter; wer
beitritt, wird Mitglied. Verwalter können umbenennen und Rollen wechseln — der
letzte Verwalter kann sich nicht selbst herabstufen, und beim Austritt erbt das
älteste Mitglied die Rolle.

Ein Konto kann in bis zu **3** Haushalten sein (`MAX_HOUSEHOLDS`). Eingeladen
wird auf drei Wegen (`HouseholdInvite`): Link, Benutzername, Code.
`HouseholdMemberRow.status` unterscheidet `pending` von `accepted`; Zeilen ohne
Status gelten als angenommen. Eine Zusage stellt den aktiven Haushalt bewusst
**nicht** um — nur wer in keinem ist, landet gleich im neuen.

Haushalte gibt es **nur in BetterFamily** (`APPS_WITH_HOUSEHOLD`). Dort ist der
Haushalt eine Funktion wie jede andere: eine Kachel unter Funktionen, ein
Abschnitt auf der Startseite, die Route `/household`. Beim Beitritt werden
Einkaufsliste und Ämtli in den Haushalt übernommen — Termine nicht, die
bleiben privat.

## BetterFamily: der Haushalt

Vorbild sind Cozi und FamilyWall — eine Liste, die alle sehen, und die Dinge,
die man sonst vergisst. Alles gehört dem Haushalt (`householdId`); wer in
keinem ist, sieht nur Eigenes (`familyVisible` in `db/family.ts`).

- **Einkaufsliste** (`shoppingItems`) — sortiert wie im Laden: Früchte &
  Gemüse, Brot, Milch & Käse, Fleisch & Fisch, Vorrat, Getränke, Haushalt,
  Anderes. Die Abteilung rät `guessCategory`
  (`features/shopping/categories.ts`) aus dem Namen, ein Chip über dem Feld
  setzt sie fest; „2 Bananen“ wird zu Menge 2 (`splitQuantity`). Erledigtes
  steht unten unter „im Korb“.
- **Rezepte** (`recipes`) — Personen, Zutaten (eine pro Zeile), Zubereitung,
  Chips Schnell/Vegi/Kinder/Gäste. **Zutaten auf die Einkaufsliste** legt jede
  Zeile als Posten an, mit Menge und geratener Abteilung.
- **Pflanzen** (`plants`) — Ort und Giessrhythmus; `plantDueDay` sagt, wer dran
  ist. Oben **Heute giessen**, ein Tipp auf „Gegossen“ setzt den Rhythmus neu.
- **Haustiere** (`pets`, `petEvents`) — Art, Alter, Termine (Tierarzt, Impfung,
  Entwurmung, Pflege); oben **Demnächst** über alle Tiere.
- **Fahrzeuge** (`vehicles`) — Kennzeichen, nächster Service, Reifenwechsel,
  Vignette (Jahr), Kilometerstand. Was in 30 Tagen fällig ist oder fehlt, rot.

Die Startseite zeigt die Liste, die letzten Rezepte, was heute zu giessen ist
(antippen heisst gegossen), die nächsten Tiertermine und was am Auto ansteht.

## Kalender

`features/calendar/` — drei Ansichten über denselben Datenbestand, in GetBetter
über den privaten Kalender, in BetterFamily über den der Haushalte:

- `MonthView` — Raster mit Kästchen: jeder Tag zeigt seine Termine als farbige
  Streifen, `+N` wenn mehr da sind. Ein Tag antippen führt in seine Tagesansicht.
- `TimeGrid` — Zeitraster für Tag und Woche, mit Überlappung nebeneinander
  und einer Linie für die aktuelle Uhrzeit
- `EventEditor` — Titel, ganztägig, Datum, Von/Bis, Kalender, Farbe, Ort, Notiz.
  Die Zielkalender werden angehakt, **mehrere sind erlaubt**. Der Knopf zum
  Anlegen ist der kleine `FloatingButton` unten rechts.
- `CalendarPicker` — das aufklappbare Menü in der Kopfzeile: oben die Ansicht,
  darunter je ein Häkchen pro Kalender, unten unter **Kalender anzeigen** die
  Personen. „Kalender verwalten“ sitzt als Zahnrad oben rechts.

### Eigene Kalender

`db/calendars.ts` — bis zu **5** eigene Kalender (`MAX_CALENDARS`). Geteilt wird
über `calendarMembers`: Haushaltsmitglieder kommen direkt dazu, Externe werden
per **Benutzername** eingeladen und müssen zustimmen.

### Fremde Kalender ansehen

Unter **Kalender anzeigen** stehen die Haushaltsmitglieder — je Haushalt eine
Gruppe, mit Überschrift erst, wenn mehrere welche beisteuern. Darunter
**Andere**: Konten ausserhalb, die zugestimmt haben. „Andere Person anzeigen“
fragt per Benutzername an (`db/shares.ts`, Sammlung `calendarShares`).
Private Termine bleiben auch danach verborgen.

### Sichtbarkeit (`matchesSource` / `isVisible` in `repositories.ts`)

Jede angehakte Quelle wird einzeln geprüft, gezeigt wird die Vereinigung.

- **Privat** — persönliche Termine, nur der eigene Kalender
- **Haushalt** — je Haushalt eine Quelle (`house:<id>`), benannt nach dem Haushalt
- **Eigener Kalender** — was darin steht, für alle, die dabei sind
- **Mitglied** — der persönliche Kalender einer anderen Person, ohne deren
  private Termine; wer das darf, steht in `access.canSee`
- Die Startseite (`listUpcoming`) zeigt nur Eigenes

### Ein Termin in mehreren Kalendern

Mehrere Zeilen in `events` mit gemeinsamer `groupId` (`groupOf(row)`).
`listBetween` und `listUpcoming` entdoppeln danach; `events.save(groupId, …)`
legt an, aktualisiert und löscht die abgewählten Kopien.

`dates.ts` hält die Datumsrechnung ohne Fremdbibliothek; die Woche beginnt am
Montag. `colors.ts` hat die sieben Terminfarben.

Noch nicht drin: Wiederholungen, mehrtägige Termine, Erinnerungen.

## GetBetter: die Organisation

Vorbild sind Things 3 und Apple Erinnerungen — wenig Text, klare Abschnitte,
ein Tipp fürs Wichtigste. Alles je Konto, Tage als `YYYY-MM-DD`
(`features/shared/days.ts`: `daysUntil`, `shiftDay`, `relativeDay`,
`nextBirthday`). Ein Datum wählt man mit `DayPicker`
(`features/shared/DayPicker.tsx`): Chips für heute, morgen, in einer Woche, in
einem Monat, dahinter ein Feld für alles andere.

- **Aufgaben** (`tasks`, `features/tasks/`) — Abschnitte Überfällig / Heute /
  Demnächst / Irgendwann, rot nur, was wirklich überfällig ist. Schnell
  eintragen unten; ein Tipp auf den Titel öffnet das Blatt mit Frist, Fahne
  (`priority`) und Notiz. Der Kreis links hakt ab.
- **Notizen** (`notes`) — Suche über Titel und Text, Anheften (`pinned`) hält
  eine Notiz oben.
- **Dokumente** (`documents`, `db/organizer.ts`) — Art (Vertrag, Versicherung,
  Garantie, Ausweis, Anderes), Ablaufdatum, Notiz. Was in 60 Tagen abläuft,
  steht oben unter **Läuft bald ab**, Abgelaufenes rot.
- **Gewohnheiten** (`habits`, `habitTicks`) — je Vorsatz eine Karte mit der
  Woche als sieben Punkten; ein Tipp hakt den Tag ab, die Zukunft bleibt
  stumm. Serie (`streakOf`) und Wochenziel (`targetPerWeek`) stehen daneben.
- **Reisen** (`trips`, `packingItems`) — Countdown, Zeitraum, Packliste mit
  Fortschritt und Vorschlägen (Pass, Ladegerät, …), Vergangene blass darunter.
- **Kontakte** (`contacts`) — Geburtstage der nächsten 30 Tage oben („wird
  36“), darunter alle; im Blatt „Heute gesehen“ (`lastSeenOn`).

Die Startseite zeigt je Funktion das Nächste: was bald abläuft, die Haken von
heute (antippbar), die nächste Reise, die nächsten Geburtstage.

## BetterGym

`db/gym.ts`, `db/health.ts` und `features/gym/` — sieben Module, Vorbild sind
Hevy und Streaks:

- **Training** (`workouts`, `workoutSets`, `routines`) — **Vorlagen** als Chips
  starten ein Training mit ihren Übungen; im Blatt je Übung die Sätze
  („Satz 1 · 60 kg × 8“), daneben die **Bestleistung** über alle Trainings,
  nach jedem Satz ein **Pausentimer** (90 s). Übungen aus der Liste oder frei.
  Ohne Vorlage: Art (Kraft, Laufen, …) und Dauer.
- **Menüplan** (`meals`) — Mahlzeit, Kalorien, Tagesabschnitt; oben die
  Tagessumme gegen 2000 kcal
- **Trinken** (`drinks`) — zwei Knöpfe (2.5 dl, 5 dl), ein Balken, das letzte
  lässt sich zurücknehmen
- **Schlaf** (`sleeps`) — ins Bett, aufgestanden, wie gut; `sleepMinutes`
  rechnet über Mitternacht. Oben der Schnitt der letzten 7 Nächte, dazu der
  **Tipp aus dem Kalender**: erster Termin morgen minus 9 Stunden.
- **Medikamente** (`meds`, `medTakes`) — je Einnahmezeit ein Chip, ein Tipp
  heisst genommen; der Vorrat zählt mit, unter 5 steht „Nachschub“.
- **Werte** (`vitals`) — Gewicht, Blutdruck, Puls: der letzte Wert gross, der
  Unterschied zum vorletzten, die letzten zehn als Balken.
- **Kopf frei** (`moods`) — ein Wort zur Laune (1–5), ein Satz zum Tag, dazu
  die Atemübung 4-7-8 in vier Runden.

`dayKey(date)` ist der Tagesschlüssel `YYYY-MM-DD`, nach dem gruppiert wird.
Die Startseite zeigt die Zahl des Tages, die letzte Nacht, die nächste offene
Einnahme (antippbar), das letzte Gewicht und die Laune von heute.

## BetterMoney

`db/money.ts` und `features/money/` — vier Module, alle in CHF und je Konto:

- **Budget** (`expenses`, `budgets`) — Ausgaben mit Kategorie und Notiz, oben
  die Monatssumme; wer ein Monatsbudget festlegt, sieht einen Balken und was
  übrig ist (rot, wenn drüber)
- **Rechnungen** (`bills`) — offen nach Fälligkeit, überfällig rot; antippen
  heisst bezahlt. Fälligkeit per Chip: heute, in 7, 14, 30 Tagen
- **Abos** (`subscriptions`) — monatlich oder jährlich; oben, was das im Monat
  und im Jahr macht (Jahresabos anteilig)
- **Sparziele** (`savingsGoals`) — Ziel, Balken, Chips zum Einzahlen; über das
  Ziel hinaus geht es nicht

`monthKey(date)` ist der Monatsschlüssel `YYYY-MM`. Beträge gehen durch
`parseAmount` (`features/money/amount.ts`: Komma oder Punkt, Rappen gerundet)
und werden mit `formatMoney` gezeigt. Löschen nur über den Papierkorb
(`RemoveButton`) in Zeilen, die selbst nicht drückbar sind.

## Navigation

Jede App hat dieselben drei Tabs — **Start**, **Funktionen**, **Profil** —,
GetBetter dazu den **Assistenten**, BetterAi nur **Chat** und **Profil**. Alles
andere (Haushalt, Aussehen, die volle Ansicht einer Funktion) liegt dahinter
als Route. Keine der beiden Übersichten ist ein Kachelbrett.

### Die Startseite (`screens/WorkspaceScreen.tsx`)

Gruss und Datum, darunter je Funktion ein Abschnitt mit dem, was sie gerade
weiss — und mit dem, was man direkt tun kann:

| Funktion                      | Was dort steht und geht                             |
| ----------------------------- | --------------------------------------------------- |
| Haushalt (BetterFamily)       | der aktive Haushalt                                 |
| Kalender                      | die nächsten Termine                                |
| Aufgaben                      | offene Aufgaben, antippen hakt ab, Feld zum Anlegen |
| Notizen                       | die letzten drei                                    |
| Wecker                        | der nächste                                         |
| Einkauf                       | offene Posten, antippen erledigt                    |
| Ämtli                         | was ansteht                                         |
| Training / Menüplan / Trinken | die Zahl des Tages                                  |
| Budget / Abos                 | die Summe des Monats                                |
| Rechnungen                    | die nächsten drei, antippen heisst bezahlt          |
| Sparziele                     | die ersten drei mit Stand                           |

Welche Abschnitte erscheinen, sagt `modulesOfApp()`. In GetBetter folgen die
Karten der anderen Better-Apps (`features/apps/AppFamily.tsx`): wo man schon
einmal drin war, stehen feste Felder mit Wert oder „—“; wo nicht, das Logo
blass, ein Satz und ein farbiger **Installieren**-Knopf (`storeUrl`, sonst die
laufende App). Ganz unten steht **Kommt noch** — was diese App führt, aber noch
nicht kann. Nur die Kopfzeile eines Abschnitts führt in die volle Ansicht; die
Zeilen darunter gehören der Funktion. Kein Knopf im Knopf: eine `Card` ist nur
dann drückbar, wenn sie keinen eigenen Knopf enthält — im Browser wäre das
ungültiges HTML und fällt beim Rendern auf.

### Funktionen (`screens/FunctionsScreen.tsx`)

Der zweite Tab zeigt die Funktionen **dieser** App als Logos, drei
nebeneinander: oben, was wirklich etwas tut, darunter unter **Kommt noch**
blass der Rest. `BUILT_MODULE_IDS` in `mocks/modules.ts` ist die eine Stelle,
die weiss, was gebaut ist. Nie die Funktionen anderer Apps.

**Favoriten gibt es nicht.** Kein Stern, keine Auswahl, kein Fragenschritt beim
Einrichten — alle Funktionen sind immer da.

## Die Bilder (`scripts/icons.js`)

Alle Logos sind **echte PNGs**, erzeugt aus dem, was im Code steht: Farbe aus
`theme/modules.ts`, Symbol aus `mocks/modules.ts` und `ui/Icon.tsx` (Ionicons,
MIT), die Apps aus `app/identity.ts`. Ein Logo ist ein abgerundetes Quadrat
mit Farbverlauf, einem Lichtbogen und weissem Symbol.

```
packages/core/src/assets/modules/<id>.png, <id>-mono.png   je Funktion, 256 px
packages/core/src/assets/apps/<app>.png, <app>-mono.png     je App, 256 px
packages/core/src/assets/index.ts                           die require()-Tabelle
apps/<app>/assets/                                          Store-Icon 1024 px,
                                                            Android-Ebenen, Splash, Favicon
```

`ui/ModuleIcon.tsx` und `ui/AppIcon.tsx` zeigen diese Bilder (in
„schwarzweiss“ die graue Fassung) und zeichnen die Form nur dann selbst, wenn es
zu einer Id kein Bild gibt. Grössen: `sm` 28 in Listen, `md` 44 auf Karten,
`lg` 64 im Raster, `xl` 88 auf der Startseite.

Farbe oder Symbol ändern heisst: im Code ändern, `node scripts/icons.js`
laufen lassen, die Bilder mit einchecken. Nie ein Bild von Hand in `assets/`
legen.

## Onboarding (GetBetter)

Ein Schritt: der Vorname, dann geht es los. Den Schritt „Bereiche“ gibt es
nicht mehr — er diente den Favoriten. Die anderen Apps haben kein Onboarding.

## Aussehen

`/appearance` (aus dem Profil, in jeder App) stellt drei Regler, am Konto
gespeichert und damit in allen Apps gleich:

|                |                                                                      |
| -------------- | -------------------------------------------------------------------- |
| Modus          | Hell, Dunkel oder dem Gerät folgen                                   |
| Voreinstellung | `clean` ruhig, `colorful` jede App in ihrer Farbe, `mono` ohne Farbe |
| Akzentfarbe    | Acht Töne aus `ACCENTS`, in Schwarzweiss ohne Wirkung                |

Jedes Modul hat eine eigene Farbe (`theme/modules.ts`); `moduleTint(theme, id)`
und `hueTint(theme, hue)` machen daraus die gezeichnete Fassung eines Logos.

## Veröffentlichen

Jede App ist für den Store vorbereitet:

- `app.json` — Name, `version` 1.0.0, `ios.bundleIdentifier` und
  `android.package` `ch.better.<slug>`, Splash in der App-Farbe, adaptive
  Android-Icons, Favicon. `buildNumber` / `versionCode` je Release erhöhen.
- `eas.json` — Profile `development`, `preview`, `production`.
- `EXPO_PUBLIC_API_URL` beim Bauen setzen: das ist die eine Stelle, an der aus
  dem Entwicklungsdienst der echte wird.
- Sobald eine App im Store ist, ihren `packageName` in `APPS` eintragen — dann
  führt der Installieren-Knopf in GetBetter dorthin.

```bash
cd apps/getbetter
EXPO_PUBLIC_API_URL=https://api.example.ch eas build --profile production
```

## Regeln

- **Keine rohen Zahlen.** Abstand, Schriftgrösse, Farbe und Radius kommen aus
  `useTheme()`.
- **Kein Text im Code.** Jeder sichtbare String geht durch `t('key')`.
  Neue Schlüssel in `i18n/de.ts`, die anderen Sprachen fallen darauf zurück.
  Umlaute ausschreiben — „Ämtli“, nicht „Aemtli“.
- **Datum und Zahlen über `Intl`.** Helfer in `i18n/format.ts`, Schweizer Locale.
- **Daten kommen aus `db/repositories.ts`** (und `db/gym.ts`, `db/households.ts`,
  …), gelesen über `useLiveQuery`.
- **Kein Bildschirm greift direkt auf den Speicher zu** — immer über ein
  Repository.
- **Was alle Apps teilen, gehört in den Kern.** In `apps/<name>/app` steht nur,
  was an dieser App wirklich anders ist.
- **Blätter rollen.** `Sheet` legt seinen Inhalt in eine `ScrollView` und im
  Browser in den Telefonrahmen. Dort nie `flex: 0` schreiben, wo eine Höhe
  gelten soll — daraus wird `flex-basis: 0%`, und das Blatt fällt zusammen.
- **Kein leerer Bildschirm.** Wo nichts ist, steht ein `EmptyState`.
- **Kein Knopf im Knopf.** Eine drückbare `Card` enthält keinen `Button`.
- **Im Web ohne Warnungen.** `boxShadow` statt `shadow*`, `pointerEvents` im
  Stil statt als Prop.
- **Unveränderlich.** Zustand wird kopiert, nie mutiert.
- **TypeScript strict**, inklusive `noUncheckedIndexedAccess`. `npm run typecheck`
  und `npm run lint` müssen sauber sein, bevor etwas als fertig gilt.
- **`services/api/data/` bleibt draussen.** Die Datei enthält Passwort-Hashes
  und gehört nie ins Git.
