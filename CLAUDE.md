# GetBetter und die Better-Apps

Fünf eigenständige Expo-Apps in einem Arbeitsbereich. **GetBetter** ist die
Hauptapp und die Schaltzentrale; die anderen decken je einen Bereich ab.
Der ursprüngliche Plan liegt in
[docs/plan-prototyp-hauptapp.md](docs/plan-prototyp-hauptapp.md); er beschreibt
noch die Zeit, als alles eine App war.

## Die Apps

| App              | Ordner              | Schema            | Web  | Was drin ist                                                                                                                         |
| ---------------- | ------------------- | ----------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **GetBetter**    | `apps/getbetter`    | `getbetter://`    | 8081 | Kalender, Aufgaben, Notizen, Wecker, Dokumente, Gewohnheiten, Reisen, Kontakte — dazu der Assistent und die Übersicht über alle Apps |
| **BetterFamily** | `apps/betterfamily` | `betterfamily://` | 8082 | Einkaufsliste, Ämtli, Rezepte, Pflanzen, Haustiere, Fahrzeuge — samt Haushalt                                                        |
| **BetterGym**    | `apps/bettergym`    | `bettergym://`    | 8083 | Training, Menüplan und Trinken sind ausgebaut; Schlaf, Medikamente, Werte, Kopf frei sind Platzhalter                                |
| **BetterAi**     | `apps/betterai`     | `betterai://`     | 8084 | Das KI-Gespräch, sonst nichts                                                                                                        |
| **BetterMoney**  | `apps/bettermoney`  | `bettermoney://`  | 8085 | Budget, Rechnungen, Abos, Sparziele                                                                                                  |

`APP_MODULES` in `packages/core/src/app/identity.ts` ist die Wahrheit darüber,
welche App welche Module führt — jedes Modul gehört genau einer App.

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
npm run typecheck  # tsc über alles
npm run lint
```

`/ui-kit` (nur in GetBetter) zeigt jeden UI-Baustein in allen Zuständen.

## Aufbau

```
packages/core/src/     Der gemeinsame Kern — jede App zieht ihn über `@/…`
  app/                 identity.ts (welche App bin ich), RootShell, tabs, bridge
  screens/             Bildschirme, die alle Apps gleich brauchen
  theme/ ui/ i18n/     Aussehen, Bausteine, Sprache
  db/ auth/ state/     Speicher, Konten, Sitzung
  features/            Kalender, Aufgaben, Notizen, Einkauf, Ämtli, Wecker, KI,
                       Assistent, Haushalt, Onboarding
apps/<name>/
  app/                 Nur die Routen — meist einzeilige Verweise auf den Kern
  app.json             Name, Schema, Farbe
  metro.config.js      Beobachtet auch den Kern ausserhalb des App-Ordners
```

Die Routen sind absichtlich dünn: `export { AppsScreen as default } from '@/screens';`.
Was an einer App wirklich anders ist, steht in ihrer `app.json` und in ihrem
`(tabs)/_layout.tsx`.

## Wie die Apps zusammenspielen

Jede App ist ein eigenes Programm mit **eigenem Speicher**. Es gibt keinen
Server, also auch keine gemeinsame Datenbank: BetterFamily kennt die Termine
aus GetBetter nicht, und GetBetter sieht nicht in die Einkaufsliste.

Was trotzdem geht, sind **Aufträge per Tiefenlink** (`packages/core/src/app/bridge.ts`):

```
getbetter        →  betterfamily://befehl/einkauf?text=2%20Bananen
```

Der Assistent in GetBetter erkennt ein paar Muster
(`features/assistant/route.ts`) und schickt sie los; die andere App fängt sie
auf ihrer Route `befehl/[command]` auf, trägt sie ein und sagt, was daraus
wurde. Drei Grenzen gehören zur Wahrheit dazu:

- Es wirkt nur, wenn die andere App auf demselben Gerät installiert ist.
- Es geht nur in eine Richtung — GetBetter erfährt das Ergebnis nicht.
- Im Browser gibt es keine Schemata; dort nimmt die Brücke `localhost:<port>`.

## Ein Konto für alle Apps

Die Konten liegen im **Kontodienst** (`services/accounts`), nicht mehr in jeder
App einzeln. Dieselbe Anmeldung gilt damit überall — man meldet sich in
BetterFamily mit denselben Daten an wie in GetBetter.

```bash
npm run server     # Port 8090, muss zum Anmelden laufen
```

| Route                                |                                          |
| ------------------------------------ | ---------------------------------------- |
| `POST /v1/accounts`                  | Registrieren                             |
| `POST /v1/sessions`                  | Anmelden                                 |
| `GET /v1/accounts/:id`               | Konto lesen                              |
| `GET /v1/accounts/by-username/:name` | Für Einladungen                          |
| `PATCH /v1/accounts/:id`             | Vorname, Sprache, Benutzername, Aussehen |

`auth/service.ts` ist der Draht dorthin, `auth/accounts.ts` die Schicht
darüber. Jede App hält zusätzlich eine **Abschrift** des Kontos: sie trägt,
was nur diese App angeht (Favoriten, aktiver Haushalt), und hält die App am
Laufen, wenn der Dienst gerade nicht antwortet. Beim Start fragt sie nach und
gleicht ab.

Passwörter prüft nur der Dienst, mit scrypt über Salt und Passwort; Salt und
Hash verlassen ihn nie. Konten aus der Zeit davor prüfen ihr Passwort beim
ersten Mal noch lokal und wandern dann von selbst in den Dienst
(`adoptLegacy`).

**Was der Dienst nicht führt, sind die Daten der Apps.** Termine, Listen und
Haushalte liegen weiter je App auf dem Gerät: verbunden ist die Person, nicht
der Inhalt. Der nächste Schritt wäre, die Repositories genauso umzustellen —
die Naht dafür ist `db/repositories.ts`.

## Die zwei KI-Oberflächen

|       | Assistent (Tab in GetBetter)                                      | BetterAi                      |
| ----- | ----------------------------------------------------------------- | ----------------------------- |
| Was   | Verwaltet quer über die Apps, schickt Aufträge los                | Ein ganz normales KI-Gespräch |
| Wo    | `features/assistant/AssistantView.tsx`                            | `screens/AiHomeScreen.tsx`    |
| Daten | Liest deine GetBetter-Daten, schickt Aufträge an die anderen Apps | Sieht deine Daten nicht       |

Der Assistent hat keinen Kopfbereich: in der Mitte steht "Wie kann ich dich
unterstützen?", unten das Feld. Hinter beiden steckt noch kein Modell — was
nicht als Auftrag erkannt wird, beantwortet er einmal ehrlich.

## Haushalte

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

Haushalte gibt es in **GetBetter** (für die Familienkalender) und in
**BetterFamily** (für Einkaufsliste und Ämtli) — `APPS_WITH_HOUSEHOLD` sagt es.
Beide führen ihren eigenen, solange es keinen Server gibt.

## Kalender (GetBetter)

`features/calendar/` — drei Ansichten über denselben Datenbestand:

- `MonthView` — Raster mit Kästchen: jeder Tag zeigt seine Termine als farbige
  Streifen, `+N` wenn mehr da sind. Ein Tag antippen führt in seine Tagesansicht.
- `TimeGrid` — Zeitraster für Tag und Woche, mit Überlappung nebeneinander
  und einer Linie für die aktuelle Uhrzeit
- `EventEditor` — Titel, ganztägig, Datum, Von/Bis, Kalender, Farbe, Ort, Notiz.
  Die Zielkalender werden angehakt, **mehrere sind erlaubt**. Der Knopf zum
  Anlegen ist der kleine `FloatingButton` unten rechts.
- `CalendarPicker` — das aufklappbare Menü in der Kopfzeile: oben die Ansicht,
  darunter je ein Häkchen pro Kalender, unten unter **Kalender anzeigen** die
  Personen. "Kalender verwalten" sitzt als Zahnrad oben rechts.

### Eigene Kalender

`db/calendars.ts` — bis zu **5** eigene Kalender (`MAX_CALENDARS`). Geteilt wird
über `calendarMembers`: Haushaltsmitglieder kommen direkt dazu, Externe werden
per **Benutzername** eingeladen und müssen zustimmen.

### Fremde Kalender ansehen

Unter **Kalender anzeigen** stehen die Haushaltsmitglieder — je Haushalt eine
Gruppe, mit Überschrift erst, wenn mehrere welche beisteuern. Darunter
**Andere**: Konten ausserhalb, die zugestimmt haben. "Andere Person anzeigen"
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

## BetterGym

`db/gym.ts` und `features/gym/` — drei ausgebaute Module:

- **Training** (`workouts`) — Art, Dauer, Notiz; oben die Minuten dieser Woche
- **Menüplan** (`meals`) — Mahlzeit, Kalorien, Tagesabschnitt; oben die
  Tagessumme gegen 2000 kcal
- **Trinken** (`drinks`) — zwei Knöpfe (2.5 dl, 5 dl), ein Balken, das letzte
  lässt sich zurücknehmen

`dayKey(date)` ist der Tagesschlüssel `YYYY-MM-DD`, nach dem gruppiert wird.
Die Zahlen landen über die gemeinsame Datenbank auch auf der BetterGym-Karte
in GetBetter.

## Startseite und Finder

Jede App hat zwei Uebersichten, und keine davon ist ein Kachelbrett.

### Die Startseite (`screens/WorkspaceScreen.tsx`)

Gruss und Datum, darunter je Funktion ein Abschnitt mit dem, was sie gerade
weiss — und mit dem, was man direkt tun kann:

| Funktion                       | Was dort steht und geht                             |
| ------------------------------ | --------------------------------------------------- |
| Kalender                       | die naechsten Termine                               |
| Aufgaben                       | offene Aufgaben, antippen hakt ab, Feld zum Anlegen |
| Notizen                        | die letzten drei                                    |
| Wecker                         | der naechste                                        |
| Einkauf                        | offene Posten, antippen erledigt                    |
| Aemtli                         | was ansteht                                         |
| Training / Menueplan / Trinken | die Zahl des Tages                                  |

Welche Abschnitte erscheinen, sagt `modulesOfApp()`. In GetBetter folgen die
Karten der anderen Better-Apps, ganz unten steht **Kommt noch** — was diese
App fuehrt, aber noch nicht kann, blass und ohne etwas vorzugeben. Nur die
Kopfzeile eines Abschnitts fuehrt in die volle Ansicht; die Zeilen darunter
gehoeren der Funktion.

### Organisation (`screens/FinderScreen.tsx`)

Der zweite Tab zeigt die Funktionen **dieser** App an einer Stelle — in
GetBetter also Kalender, Wecker, Aufgaben, Notizen und den Rest. Was andere
Better-Apps koennen, gehoert nicht hierher; die stehen auf der Startseite.

- oben die haeufigsten Handgriffe als farbige Felder (Termin, Aufgabe, Notiz,
  Wecker)
- darunter alles als Pille mit Logo
- ein Suchfeld, das ueber Name und Beschreibung filtert

**Favoriten gibt es nicht mehr.** Kein Stern, keine Auswahl, kein
Fragenschritt beim Einrichten — alle Funktionen sind immer da.

## Onboarding (GetBetter)

Zwei Schritte: Name und Bereiche. Die anderen Apps haben kein Onboarding —
sie legen gleich los.

## Aussehen

`/appearance` (aus dem Profil, in jeder App) stellt drei Regler, am Konto
gespeichert:

|                |                                                                      |
| -------------- | -------------------------------------------------------------------- |
| Modus          | Hell, Dunkel oder dem Gerät folgen                                   |
| Voreinstellung | `clean` ruhig, `colorful` jede App in ihrer Farbe, `mono` ohne Farbe |
| Akzentfarbe    | Acht Töne aus `ACCENTS`, in Schwarzweiss ohne Wirkung                |

Jedes Modul hat eine eigene Farbe (`theme/modules.ts`); `moduleTint(theme, id)`
macht daraus das Logo.

## Regeln

- **Keine rohen Zahlen.** Abstand, Schriftgrösse, Farbe und Radius kommen aus
  `useTheme()`.
- **Kein Text im Code.** Jeder sichtbare String geht durch `t('key')`.
  Neue Schlüssel in `i18n/de.ts`, die anderen Sprachen fallen darauf zurück.
- **Datum und Zahlen über `Intl`.** Helfer in `i18n/format.ts`, Schweizer Locale.
- **Daten kommen aus `db/repositories.ts`**, gelesen über `useLiveQuery`.
- **Kein Bildschirm greift direkt auf den Speicher zu** — immer über ein
  Repository.
- **Was alle Apps teilen, gehört in den Kern.** In `apps/<name>/app` steht nur,
  was an dieser App wirklich anders ist.
- **Blätter rollen.** `Sheet` legt seinen Inhalt in eine `ScrollView` und im
  Browser in den Telefonrahmen. Dort nie `flex: 0` schreiben, wo eine Höhe
  gelten soll — daraus wird `flex-basis: 0%`, und das Blatt fällt zusammen.
- **Kein leerer Bildschirm.** Wo nichts ist, steht ein `EmptyState`.
- **Unveränderlich.** Zustand wird kopiert, nie mutiert.
- **TypeScript strict**, inklusive `noUncheckedIndexedAccess`. `npm run typecheck`
  und `npm run lint` müssen sauber sein, bevor etwas als fertig gilt.

## Wo die Naht zum Server liegt

Zwei Dateien im Kern, sonst nichts:

- `db/repositories.ts` — die Abfragen. Gleiche Signaturen, andere Quelle.
- `auth/accounts.ts` — Registrieren und Anmelden.

Passwörter liegen lokal als SHA-256 über Salt + Passwort. Für einen Speicher auf
dem Gerät vertretbar, ersetzt aber keine Server-Anmeldung. Mit einem Server
wachsen die fünf Apps zu einem Konto und einer Datenlage zusammen — dann kann
GetBetter auch echte Zahlen der anderen Apps zeigen, statt nur Aufträge zu
schicken.
