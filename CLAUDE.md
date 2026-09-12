# GetBetter und die Better-Apps

Fünf eigenständige Expo-Apps in einem Arbeitsbereich, die sich einen Kern und
**eine Datenbank** teilen. **GetBetter** ist die Hauptapp und die Schaltzentrale;
die anderen decken je einen Bereich ab. Der ursprüngliche Plan liegt in
[docs/plan-prototyp-hauptapp.md](docs/plan-prototyp-hauptapp.md); er beschreibt
noch die Zeit, als alles eine App war.

## Die Apps

| App              | Ordner              | Schema            | Web  | Was drin ist                                                                                                                                                                           |
| ---------------- | ------------------- | ----------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GetBetter**    | `apps/getbetter`    | `getbetter://`    | 8081 | Privater Kalender, Aufgaben, Notizen, Wecker, Wetter, Dokumente, Gewohnheiten, Reisen, Kontakte, Geburtstage, E-Mail — alles ausgebaut, dazu Assistent, Mitteilungen und App-Übersicht |
| **BetterFamily** | `apps/betterfamily` | `betterfamily://` | 8082 | Familienkalender, Einkaufsliste, Ämtli, Rezepte, Pflanzen, Haustiere, Fahrzeuge — samt Haushalt, alles ausgebaut                                                                       |
| **BetterGym**    | `apps/bettergym`    | `bettergym://`    | 8083 | Training mit Sätzen und Vorlagen, Menüplan, Trinken, Schlaf, Medikamente, Werte, Kopf frei — alles ausgebaut                                                                           |
| **BetterAi**     | `apps/betterai`     | `betterai://`     | 8084 | Die Gespräche mit der KI, gespeichert und als Liste — sonst nichts                                                                                                                     |
| **BetterMoney**  | `apps/bettermoney`  | `bettermoney://`  | 8085 | Budget, Rechnungen, Abos, Sparziele — alle vier ausgebaut                                                                                                                              |

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
`npm test` nimmt ausserdem `services/api/**/*.test.js` mit: MIME, Anbieter,
Tresor, IMAP und SMTP gegen nachgebaute Server (`services/api/test/fakes.js`)
und die Routen gegen einen Dienst im Temp-Ordner — nie gegen echte Postfächer.

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

| Route                                               |                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /v1/db`                                        | Alles, ohne Passwort-Hashes                                      |
| `PUT /v1/db/:collection`                            | Eine Sammlung ersetzen                                           |
| `GET /v1/revision`                                  | Hat sich etwas geändert?                                         |
| `POST /v1/accounts`                                 | Registrieren, mit Wunsch-Benutzernamen                           |
| `POST /v1/sessions`                                 | Anmelden                                                         |
| `GET /v1/accounts/:id`                              | Konto lesen                                                      |
| `GET /v1/accounts/by-username/:name`                | Für Einladungen                                                  |
| `PATCH /v1/accounts/:id`                            | Spitzname, Sprache, Benutzername, Aussehen, Assistent, Hintergrund |
| `POST /v1/notifications`                            | Mitteilung für ein Konto anlegen                                 |
| `POST /v1/notifications/:id/read`                   | als gelesen markieren                                            |
| `DELETE /v1/notifications/:id`                      | löschen                                                          |
| `POST /v1/notifications/remove-by-ref`              | alle zu einer Anfrage löschen                                    |
| `POST /v1/uploads` · `GET`/`DELETE /v1/uploads/:id` | eigenes Hintergrundbild                                          |
| `GET /v1/mail/providers?email=`                     | Anbieter und Server erkennen                                     |
| `POST /v1/mail/accounts` · `DELETE …/:id`           | Postfach verbinden / trennen                                     |
| `POST /v1/mail/sync`                                | Postfächer eines Kontos abgleichen                               |
| `POST /v1/mail/messages/:id/seen`                   | gelesen / ungelesen                                              |
| `POST /v1/mail/messages/:id/delete`                 | in den Papierkorb                                                |
| `POST /v1/mail/send`                                | senden, auch als Antwort                                         |

`db/service.ts` ist der Draht dorthin (`serviceUrl()`, im Bau über
`EXPO_PUBLIC_API_URL` übersteuerbar), `auth/accounts.ts` die Schicht darüber.
Passwörter prüft nur der Dienst, mit scrypt über Salt und Passwort; Salt und
Hash verlassen ihn nie. Konten-Ids sind aus der E-Mail abgeleitet, damit jede
App dasselbe Konto meint.

Die Sammlung `appAccess` merkt sich, in welcher App ein Konto schon einmal war
(`appAccess.markSeen`). Darauf beruht in GetBetter der Unterschied zwischen
„freigeschaltet“ und „Installieren“.

**Drei Sammlungen gehören dem Dienst:** `notifications`, `mailAccounts` und
`mailMessages`. Die Apps lesen sie wie alles andere, schreiben aber nur über die
Routen oben — `PUT` darauf antwortet `403 server_owned`. Sonst überschriebe eine
App, was der Dienst gerade für eine neue E-Mail angelegt hat. Im Kern geht das
über `callService` (`db/service.ts`) und danach `refresh()` aus dem Speicher.

Der Dienst ist in Teile zerlegt: `server.js` (Routen), `store.js`,
`notifications.js`, `uploads.js` und `mail/` (IMAP, SMTP, MIME, Anbieter,
Tresor, Abgleich) — alles nur mit Node-Kernmodulen. Der Datenordner lässt sich
mit `BETTER_DATA_DIR` umlenken (die Tests tun das immer), der Abgleich-Takt mit
`BETTER_MAIL_SYNC_MS`. Nach Änderungen am Dienst muss er neu starten.

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

Noch nicht drin: Wiederholungen, mehrtägige Termine, Erinnerungen. Geburtstage
kommen trotzdem jedes Jahr — sie werden aus den Kontakten gedacht (siehe unten).

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
- **Geburtstage** (`birthdays`, `features/birthdays/`) — oben, wer heute
  feiert, als farbige Karte mit dem Alter gross („Gratulieren“ teilt einen
  Glückwunsch, „Anrufen“ nimmt die Nummer des Kontakts); darunter
  **Demnächst**, gefiltert nach Heute / Woche / Monat / Jahr, mit Suche. Das
  Datum stellt man mit drei Rädern ein (`ui/Wheel.tsx`: Tag und Monat ohne
  Ende, das Jahr ab 1900).
- **Wetter** (`weather`, `features/weather/`) — Open-Meteo ohne Schlüssel,
  Ort am Konto (`weatherPlace`, sonst Zürich); die Temperatur steht auf der
  Startseite neben dem Datum.

### Geburtstage liegen bei den Kontakten

Es gibt keine eigene Sammlung: ein Geburtstag ist `ContactRow.birthday`. Die
Funktion Geburtstage, die Kontakte und der Kalender lesen dieselbe Zeile.

- **Eintragen** geht in den Geburtstagen und im Kalender: beim Anlegen im
  privaten Kalender wählt man oben „Termin“ oder „Geburtstag“
  (`EventEditor` → `BirthdayForm`). Beides legt einen Kontakt an oder setzt
  dessen Datum.
- **Im Kalender** stehen Geburtstage jedes Jahr als ganztägiger Eintrag in
  Rosa („Anna wird 36“) — gedacht, nicht gespeichert (`birthdaysBetween` in
  `features/birthdays/birthdays.ts`, Ids `birthday:<kontakt>:<tag>`). Ein Tipp
  darauf öffnet das Geburtstags-Blatt, nicht den Termin-Editor. BetterFamily
  zeigt sie nicht.
- **Löschen** (`contacts.removeBirthday`): wer nur wegen des Geburtstags
  eingetragen war, geht ganz; wer Telefon, Notiz oder ein Treffen hat, bleibt
  als Kontakt ohne Datum.
- Wer am 29. Februar geboren ist, feiert in anderen Jahren am 1. März.

Die Startseite zeigt je Funktion das Nächste: was bald abläuft, die Haken von
heute (antippbar), die nächste Reise, die nächsten Geburtstage. **Ganztägiges**
— Termine ohne Uhrzeit und wer heute Geburtstag hat — steht als eigene Zeile
ganz oben am Tagesband (`AllDayLane` in `features/today/DayThread.tsx`, Daten
aus `events.listAllDay`), wie die Ganztags-Leiste im Kalender; die drei Plätze
im Band gehören dann den Terminen mit Uhrzeit.

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

In GetBetter: oben Datum (mit Wetter), Gruss und rechts die **Glocke**
(`features/notifications/NotificationBell.tsx`, Zähler der ungelesenen, führt zu
`/notifications`). Darunter **Was gibt's Neues**
(`features/notifications/NewsSection.tsx`), dann der Tagesstrahl und zuunterst
der **Schnellzugriff** — ein 3D-Karussell der Favoriten mit einer „+“-Karte am
Ende (`features/quick/QuickAccess.tsx`).

**Der Tagesstrahl lässt sich wischen**: nach links kommt morgen, nach rechts
gestern; ein Knopf **Heute** führt zurück. Heute zeigt das Band alles, was die
Startseite weiss. An einem anderen Tag steht nur, was wirklich an diesem Tag
ist: ganztägige Termine und Geburtstage oben, Termine mit Uhrzeit, der Wecker,
der dann klingelt (`AlarmRow.days`), Aufgaben mit Frist an dem Tag und
Rechnungen, die dann fällig sind. Was kein Datum hat — Einkauf, Gewohnheiten,
Reisen, Dokumente — bleibt bei heute, und die Jetzt-Marke fällt weg
(`showNow`).

In den anderen Apps: Gruss und Datum, darunter je Funktion ein Abschnitt mit dem,
was sie gerade weiss — und mit dem, was man direkt tun kann:

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

Der zweite Tab zeigt die Funktionen **dieser** App als Zeilen: links Name und
Symbol, rechts, was die Funktion gerade weiss.

Gegliedert wird nach **Thema**, nicht nach Bereich (`ModuleDefinition.topic`,
die Liste `TOPICS` in `mocks/types.ts` ist zugleich die Reihenfolge): Planung,
Kommunikation, Notizen und Ablage, Menschen, Alltag … Vier Bereiche wären ein
langer Block; erst das Thema sagt, warum zwei Funktionen nebeneinander stehen —
der Kalender ist Planung, E-Mail ist Kommunikation. `area` bleibt am Modul für
alles andere.

**Kein Kurztext unter dem Namen** — die zweite Zeile gibt es nur bei einem
Favoriten aus einer anderen App, und dann steht dort deren Name. Auch keine
hervorgehobene Zahl: jeder Wert ist schlichter Text. `BUILT_MODULE_IDS` in
`mocks/modules.ts` ist die eine Stelle, die weiss, was gebaut ist. Nie die
Funktionen anderer Apps.

### Favoriten und Schnellzugriff (`features/quick/`)

**Das sind zwei Listen, nicht eine.** Was man oft braucht, ist nicht dasselbe
wie was man mag:

| Liste             | Am Konto             | Wo man sie sieht                            |
| ----------------- | -------------------- | ------------------------------------------- |
| **Favoriten**     | `account.favorites`  | der Stern in „Bereiche“ und der Tab daneben |
| **Schnellzugriff**| `account.quickAccess`| das Karussell auf der Startseite            |

Beide sind Listen von `appId:moduleId` in der gewählten Reihenfolge, beide
gehen durch dieselben reinen Helfer (`favorites.ts`, getestet) und denselben
Haken (`useFavorites()` bzw. `useQuickAccess()` in `useFavorites.ts`). Eine
Karte ins Karussell zu legen macht daraus **keinen** Favoriten — darum trägt
jede Karte oben rechts ihren eigenen Stern, und im „+“-Blatt steht ein Haken
statt eines Sterns.

Das „+“ im Karussell zeigt auch die Funktionen **anderer** Better-Apps, aber
nur solcher, in denen das Konto schon angemeldet war (`appAccess.appsOf`). Eine
fremde Funktion öffnet ihre App über `appUrl(app) + 'run/<id>'`.

Das Karussell ist ein horizontales `Animated.ScrollView` und steht auf einem
**Ring, den man von aussen sieht**: jede Karte dreht ihre Aussenkante nach
hinten (ein Schritt sind 24 Grad auf Radius 200), rückt zur Mitte und wird
kleiner. `translateZ` kennt React Native nicht — die Tiefe macht darum die
Grösse. Im Browser rastet das Band selbst ein, weil react-native-web
`snapToInterval` nicht kennt.

## Gesten

Die Apps sind fürs Handy gebaut; wischen geht überall dort, wo man es am
iPhone erwarten würde. Alle Gesten laufen über `PanResponder` (kein
Zusatzpaket) und teilen sich die Masse in `ui/gestures.ts`.

| Geste                                  | Wo                                   | Baustein                |
| -------------------------------------- | ------------------------------------ | ----------------------- |
| Zeile nach links wischen → „Löschen“   | jede löschbare Liste                 | `ui/SwipeRow.tsx`       |
| Nach links/rechts → weiter/zurück      | Kalender, Budget, Tagesstrahl        | `ui/useSwipeSteps.ts`   |
| Blatt am Griff/Kopf nach unten wischen | jedes `Sheet`, auch mit `header`     | `ui/Sheet.tsx`          |
| Vom linken Rand nach rechts → zurück   | iOS vom Stapel, im Browser selbst    | `app/EdgeSwipeBack.tsx` |
| Mit der Maus ziehen und werfen         | nur im Browser, alle Rollflächen     | `app/webDragScroll.ts`  |

Ein Blatt lässt sich nur am Griff und an der Kopfzeile herunterziehen, nicht im
Inhalt — dort stecken Felder und das Wecker-Rad. Wer eine eigene Kopfzeile
braucht (X, Titel, Haken), gibt sie als `header` mit. `SwipeRow` meldet das
Löschen auch als Aktion der Bedienungshilfe; bestehende Papierkörbe bleiben.

Der Zustand einer Geste lebt in einer kleinen Klasse, die per
`useState(() => new …)` einmal entsteht — die React-Compiler-Regeln verbieten
`useRef(…).current` im Rendern und Mutationen an Zustandswerten. Die neueste
Rückruffunktion reicht ein Effekt über eine Methode nach (`setOnDelete`).

Das Wecker-Rad (`features/alarm/AlarmEditor.tsx`) hat kein Ende: die Zahlen
stehen mehrmals hintereinander, und in Ruhe springt das Rad unsichtbar in die
mittlere Runde zurück.

## Mitteilungen (`features/notifications/`, `db/notifications.ts`)

Eine Mitteilung ist eine Zeile `NotificationRow` (Art, Titel, Text, `ref`,
`readAt`). `title` und `body` sind Daten (Name, Kalendername, Betreff) — den
Satz baut die Oberfläche je Art mit `t()`. Angelegt werden sie dort, wo etwas
passiert: Kalender-Freigabe angefragt (`shares.requestByUsername`), in einen
Kalender eingeladen (`calendars.invite`), per Benutzername in einen Haushalt
eingeladen (`households.inviteByUsername`) — und vom Dienst für neue E-Mails.
Wird eine Anfrage anderswo beantwortet oder zurückgezogen, räumt
`removeByRef` die Mitteilung weg. Scheitert das Anlegen, bleibt die Einladung
trotzdem bestehen.

| Wo                        | Anfrage             | E-Mail                         | Sonst               |
| ------------------------- | ------------------- | ------------------------------ | ------------------- |
| Was gibt's Neues          | Annehmen / Ablehnen | Gesehen / Löschen (Papierkorb) | Gelesen / Weg damit |
| Glocke (`/notifications`) | Annehmen / Ablehnen | Gesehen / Löschen              | Gelesen = weg       |

„Gelesen“ in Was gibt's Neues setzt `readAt`: die Mitteilung bleibt in der
Glocke. „Weg damit“ löscht sie ganz. In der Glocke heisst gelesen weg. Nach
links wischen löscht, bei E-Mails die E-Mail selbst. Leer: „Keine Neuigkeiten“.

## E-Mail (`features/mail/`, `db/mail.ts`, `services/api/mail/`)

Beliebig viele Postfächer, ein Posteingang. Verbunden wird mit Adresse und
Passwort über IMAP/SMTP; der Dienst erkennt den Anbieter
(`mail/providers.js`), prüft die Anmeldung live und legt das Passwort
**verschlüsselt** ab (AES-256-GCM, Schlüssel `<datenordner>/mail.key`, Tresor
`mail-vault.json` — nie in `db.json`, nie in einer Antwort). Er gleicht alle
2 Minuten ab: beim ersten Mal die letzten 50, danach Neues; höchstens 100 je
Postfach, Text ohne HTML und ohne Anhänge. Neue ungelesene Nachrichten nach dem
Verbinden werden zu Mitteilungen.

- **Posteingang:** Chips je Postfach (ab zwei), ungelesen fett mit Punkt, nach
  links wischen löscht (in den Papierkorb des Postfachs).
- **Nachricht:** öffnen markiert gelesen; Antworten (mit „Re:“ und Zitat),
  Als ungelesen, Löschen.
- **Schreiben:** Von (Postfach), An, Cc, Betreff, Text; nach dem Senden eine
  Kopie in „Gesendet“ (ausser Gmail, das tut es selbst).
- **Grenzen:** Outlook/Hotmail/Live/Microsoft 365 nur mit OAuth — geht nicht
  (`oauth_required`). Gmail, Yahoo und iCloud brauchen ein App-Passwort, GMX und
  web.de eingeschaltetes IMAP. Ohne Zugriffstoken liest jeder, der Port 8090
  erreicht, die abgeholten Mails — nur für die Entwicklung.

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

**Hintergründe** erzeugt `node scripts/backdrops.js` prozedural (ohne Download,
wiederholbar byte-gleich): `assets/backgrounds/<key>.jpg` (1080 × 1920) und
`<key>-thumb.jpg` für die Auswahl — hell `mist`, `lake`, `forest`, `dunes`,
`snow`, `bloom`, `paper`, dunkel `dusk`, `moon`, `aurora`, `night`, `ink`.
`paper` und `ink` sind schlicht Weiss und Schwarz, für alle, die hinter der App
gar kein Motiv wollen. Die Tabelle steht in `theme/backdrops.ts`. Metro sieht
neue Bilddateien manchmal erst, wenn man sie einmal neu schreibt.

## Intro, Anmelden und Einrichten (`features/intro/`, `features/onboarding/`)

Ein Avatar führt durch alles (`ClubAvatar.tsx`): 44 Stücke fliegen aus
berechneten Startpunkten zusammen, er dreht sich, schwebt und blinzelt; bei
reduzierter Bewegung wird er nur eingeblendet. Farben aus dem Theme.

- **Erstes Öffnen (alle Apps, `StartScreen`):** „Bist du schon Mitglied im
  Better-Club?“ — darunter die Pille zum Einloggen, der zweite Weg zum
  Registrieren, eine „oder“-Linie und zwei runde Anbieter-Knöpfe (Apple und
  Google sagen ehrlich, dass sie mit den Store-Apps kommen). Anmelden und
  Registrieren teilen sich `features/auth/AuthShell.tsx` und zeigen den kleinen
  Avatar mit eigener Sprechblase.
- **Registrieren (`features/auth/SignUpForm.tsx`):** E-Mail, **Benutzername**,
  Passwort, Passwort wiederholen. Der Benutzername steht also schon hier fest;
  die Form prüft `^[a-z0-9][a-z0-9._-]{2,23}$` (dieselbe Regel in
  `auth/accounts.ts` und im Dienst), und ob er frei ist, sagt beim Tippen
  `fetchByUsername`. Das letzte Wort hat der Dienst: `username_taken` → 409,
  `username_invalid` → 400, beim Anlegen **und** beim späteren Ändern.
- **Nach dem Einloggen:** `IntroLayer` in `RootShell` — der Avatar dreht sich
  weg, die App fliegt an, dann „Kennst du dich mit der App schon aus?“ (Ja /
  Tutorial). Nur wenn nach dem Laden ein Konto dazukommt, nie beim Neustart.
- **Nach dem Registrieren (GetBetter):** ein Gespräch in Schritten
  (`SetupScreen.tsx`): der **Spitzname** (`firstName` — nur, wie die App dich
  anspricht, nicht der Benutzername), „Hey {Name}, mein Name ist …“ (Name des
  Assistenten, `assistantName`), Personalisieren (Modus, Akzent, Voreinstellung,
  Hintergrund), „Kennst du dich schon aus?“ — dann `completeOnboarding`. Die
  anderen Apps laufen beim Registrieren wie beim Einloggen. Beides ändert man
  später in den Einstellungen.
- **Tutorial (`Tutorial.tsx`):** wischbare Karten — in GetBetter Heute,
  Schnellzugriff, Bereiche & Favoriten, Mitteilungen, E-Mail, Wischen und der
  Assistent mit seinem Namen.

## Einstellungen und Aussehen

`/settings` (`screens/SettingsScreen.tsx`, aus dem Profil, in jeder App) ist die
**eine** Stelle, an der sich alles ändern lässt. `/appearance` gibt es nur noch
als Weiterleitung dorthin — zwei Oberflächen fürs selbe wären zwei Wahrheiten.

| Bereich      | Was darin steht                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| Konto        | Spitzname, Benutzername, E-Mail (fest), Sprache, Mitglied seit                   |
| Darstellung  | Modus, Voreinstellung, Akzentfarbe, Hintergrund                                   |
| Assistent    | sein Name (`assistantName`), in BetterAi ausgeblendet                            |
| Haushalt     | nur in BetterFamily: der aktive Haushalt und Beitreten                            |
| App          | Version und Abmelden                                                              |

Der Aufbau: oben eine **Profilkarte** (Bild, Spitzname, `@name` und E-Mail, dazu
„Profil bearbeiten“), darunter je Thema eine Karte mit Zeilen — jede mit ihrem
Zeichen links und ihrem Wert rechts, ganz unten **Abmelden** in Rot. Ein Tipp
auf eine Zeile öffnet das Blatt dazu: ein Feld
(`features/personalize/AccountFieldSheet.tsx`), eine Auswahl, der `StylePicker`
oder der `BackdropPicker`. Die Bausteine stehen in `SettingsList.tsx`
(`SettingsProfile`, `SettingsGroup`, `SettingsList`, `SettingsRow`) und werden
auch vom Profil genutzt.

**Spitzname und Benutzername sind zwei Dinge.** Der Spitzname (`firstName`) ist
nur, wie die App dich anspricht. Der Benutzername (`username`) ist die Kennung,
unter der andere dich finden — er muss einmalig sein, und darüber entscheidet
der Dienst: `changeUsername` (`auth/accounts.ts`) schreibt **erst** dorthin und
nur bei einem Ja in die Abschrift. Sonst stünde in der App ein Name, den es beim
Dienst nicht gibt. `checkUsername` fragt vorher, damit die Maske früh etwas sagt.

Die drei Regler des Aussehens liegen am Konto und gelten damit in allen Apps:

|                |                                                                      |
| -------------- | -------------------------------------------------------------------- |
| Modus          | Hell, Dunkel oder dem Gerät folgen                                   |
| Voreinstellung | `clean` ruhig, `colorful` jede App in ihrer Farbe, `mono` ohne Farbe |
| Akzentfarbe    | Die Töne aus `ACCENTS`, in Schwarzweiss ohne Wirkung                 |
| Hintergrund    | App-Bild, eines aus `BACKDROPS` oder ein eigenes (`upload:<id>`)     |

`ui/Screen.tsx` nimmt den Hintergrund vom Konto — in allen Apps gleich —, mit
einem Verlauf in der Papierfarbe darüber, damit Text lesbar bleibt. Ein eigenes
Bild wird im Browser per Canvas auf 1280 px verkleinert und an `/v1/uploads`
geschickt; am Handy fehlt dafür noch `expo-image-picker`
(`features/personalize/pickImage.ts` sagt das ehrlich).

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
  Grosse Funktionen führen ihre Texte in eigenen Dateien (`i18n/de-mail.ts`,
  `de-news.ts`, `de-quick.ts`, `de-intro.ts`, `de-personalize.ts`), die `de.ts`
  per Spread einsammelt.
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
