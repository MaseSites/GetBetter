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
| **BetterGym**    | `apps/bettergym`    | `bettergym://`    | 8083 | Training, Menüplan, Schlaf, Trinken, Medikamente, Werte, Kopf frei                                                                   |
| **BetterAi**     | `apps/betterai`     | `betterai://`     | 8084 | Das KI-Gespräch, sonst nichts                                                                                                        |
| **BetterMoney**  | `apps/bettermoney`  | `bettermoney://`  | 8085 | Budget, Rechnungen, Abos, Sparziele                                                                                                  |

`APP_MODULES` in `packages/core/src/app/identity.ts` ist die Wahrheit darüber,
welche App welche Module führt — jedes Modul gehört genau einer App.

## Starten

```bash
npm install        # einmal, für alle Arbeitsbereiche
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

Auf der Startseite von GetBetter steht deshalb eine Karte je App mit Logo und
den Modulen darin — was in ihnen los ist, kann sie ehrlicherweise nicht zeigen.
Sobald es einen Server gibt, ist das die Stelle, an der echte Zahlen erscheinen.

## Konten

Jede App hat ihre eigene Anmeldung, weil jede ihren eigenen Speicher hat. Das
ist die unmittelbare Folge davon, dass es fünf Programme und keinen Server gibt.
Mit einem Server wird daraus ein Konto für alle — die Naht dafür sind zwei
Dateien: `db/repositories.ts` und `auth/accounts.ts`.

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

## Module und Favoriten

Alle Module einer App sind von Anfang an da; es gibt keinen Installationszustand
innerhalb einer App. Zwei Stellen leiten sich aus den im Onboarding gewählten
Bereichen ab: der Apps-Tab (`groupedModules`) und die Startseite
(`highlightedModuleIds`). Beide sehen nur die Module der laufenden App.

Favorisiert wird **in der Übersicht**: der Stern sitzt auf der Kachel. In der
geöffneten App gibt es keinen Stern; nur die Detailseite hat ihn noch. Der
Apps-Tab startet auf **Favoriten**.

## Onboarding (GetBetter)

Vier Schritte: Name, Bereiche, **Fragen**, Haushalt. Der Fragenschritt stellt
fünf Fragen mit Mehrfachauswahl; `favouritesFromAnswers()` macht daraus die
Startfavoriten (höchstens `MAX_START_FAVOURITES`). Die anderen Apps haben kein
Onboarding — sie legen gleich los.

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
