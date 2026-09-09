# Better Life

Expo-App mit echter Anmeldung und echtem Datenspeicher auf dem Geraet.
Der urspruengliche Plan liegt in
[docs/plan-prototyp-hauptapp.md](docs/plan-prototyp-hauptapp.md); der Prototyp
daraus ist inzwischen ueberholt.

## Stand

|                   |                                                               |
| ----------------- | ------------------------------------------------------------- |
| Konten            | Echt: Registrieren, Anmelden, Sitzung ueberlebt Neustart      |
| Datenspeicher     | Echt, lokal (`src/db/`) — Schema, Repositories, Live-Abfragen |
| Server            | Noch keiner. Nichts verlaesst das Geraet.                     |
| Ausgebaute Module | Kalender, Aufgaben, Notizen, Einkaufsliste, Wecker            |
| Rest der Module   | Platzhalter, der das ehrlich sagt                             |

> Hinweis: Im Repo lag beim Aufsetzen keine `CLAUDE.md`. Diese Datei beschreibt
> die Konventionen, nach denen tatsaechlich gebaut wurde.
>
> Abweichungen vom Plan, alle nach Ruecksprache:
>
> - Der Assistent hat einen eigenen Tab statt eines Knopfs im Kopfbereich
>   (Plan Kapitel 8 stellt genau diese Frage).
> - Der Tab "Entdecken" ist weg. Alle Module sind von Anfang an da, damit
>   gibt es kein Installieren und kein Deinstallieren mehr.
> - Vier Tabs: Startseite, Module, Assistent, Profil. Alle gleich behandelt —
>   gruen ist nur der Tab, auf dem man gerade steht.
> - Dazu die Module "KI-Chat" und "Wecker"; der Bereich "Geld" heisst Finanzen.

## Starten

```bash
npm run web        # Browser, mit Telefon-Rahmen
npm start          # Expo Go auf einem echten Geraet
npm run typecheck  # tsc --noEmit
npm run lint
```

`/ui-kit` zeigt jeden UI-Baustein in allen Zustaenden.

## Ordnerstruktur

```
app/                 Routen (Expo Router, dateibasiert)
  (auth)/            Start, Anmelden, Registrieren
  (onboarding)/      Willkommen, Bereiche, Haushalt
  (tabs)/            Startseite, Apps, Assistent, Haushalt, Profil
  manage-household.tsx  Der aktive Haushalt im Detail
  module/[id].tsx    Modul-Detailseite
  run/[id].tsx       Modul oeffnen (Kalender, Wecker und KI-Chat ausgebaut,
                     Rest Platzhalter)
  ui-kit.tsx         Baustein-Katalog
src/
  theme/             Abstaende, Schriften, Farben, Radien
  ui/                Bausteine: Screen, Header, Card, ListItem, Button, ...
  i18n/              de vollstaendig, fr/it/en fallen auf de zurueck
  db/                Datenspeicher: store.ts, repositories.ts, types.ts, live.ts
  auth/              Konten, Passwortpruefung
  mocks/             modules.ts (Registry) und die Assistenten-Dialoge
  state/             AppContext — Sitzung und Konto
  features/          Zusammengesetzte Teile (Auth-Maske, Onboarding, Deinstallieren)
  lib/               permissions.ts — Berechtigungssaetze aus Daten
```

## Die zwei KI-Oberflaechen

Sie werden leicht verwechselt, sind aber verschiedene Dinge:

|               | Assistent (Tab in der Mitte)                                            | Modul "KI-Chat"                                       |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| Was           | Verwaltet quer ueber die Apps                                           | Ein ganz normales KI-Gespraech                        |
| Wo            | `app/(tabs)/assistant.tsx` → `src/features/assistant/AssistantView.tsx` | `app/run/[id].tsx` → `src/features/ai/AiChatView.tsx` |
| Installierbar | Nein, eingebaut                                                         | Entfaellt — alle Module sind da (im Abo enthalten)    |
| Daten         | Liest und schreibt deine Apps, fragt vor dem Eintragen                  | Sieht deine Daten nicht                               |

Der Assistent hat **keinen Kopfbereich**: kein Titel, kein Hinweis, kein
Beispieldialog, keine Vorschlagsleiste. In der Mitte steht nur "Wie kann ich
dich unterstuetzen?", unten das Feld. Hinter ihm steckt noch kein Modell — auf
Getipptes antwortet er einmal ehrlich, dass er das noch nicht kann.

## Haushalte

`src/db/households.ts` — Haushalt, Mitgliedschaften, Rollen. Ein Haushalt hat
einen sechsstelligen Einladungscode (ohne I, O, 0, 1). Wer anlegt, wird
Verwalter; wer beitritt, wird Mitglied. Verwalter koennen umbenennen und Rollen
wechseln — der letzte Verwalter kann sich nicht selbst herabstufen, und beim
Austritt erbt das aelteste Mitglied die Rolle.

Ein Konto kann in bis zu **3** Haushalten sein (`MAX_HOUSEHOLDS`); der Tab
"Haushalt" listet sie, schaltet zwischen ihnen um und hat zwei Knoepfe:
`/new-household` legt an und zeigt danach gleich die Einladewege,
`/join-household` nimmt einen Code entgegen — auch aus dem Link.

Eingeladen wird auf drei Wegen (`HouseholdInvite`):

|              |                                                                        |
| ------------ | ---------------------------------------------------------------------- |
| Link         | `Linking.createURL('/join-household', { code })`, kopieren oder teilen |
| Benutzername | Legt eine offene Einladung an; die Person muss zustimmen               |
| Code         | Sechs Zeichen zum Vorlesen                                             |

`HouseholdMemberRow.status` unterscheidet `pending` von `accepted`; Zeilen ohne
Status gelten als angenommen. Eine Zusage stellt den aktiven Haushalt bewusst
**nicht** um — nur wer in keinem ist, landet gleich im neuen. Der im Konto vermerkte
`householdId` ist der aktive — Einkaufsliste, Aemtli und Familienkalender
folgen ihm.

Was der Haushalt teilt:

|               |                                                          |
| ------------- | -------------------------------------------------------- |
| Einkaufsliste | Alle sehen und aendern dieselbe Liste                    |
| Kalender      | Familientermine, plus was Mitglieder nicht privat halten |
| Aemtli        | Mit Zuteilung an ein Mitglied                            |
| Aufgaben      | Nur die, die als geteilt markiert sind                   |

Beim Eintritt wandert mit, was ohnehin geteilt gedacht war (Einkaufsliste,
geteilte Aufgaben). Beim Austritt bleibt Geteiltes beim Haushalt, Privates
geht mit. Verlaesst die letzte Person den Haushalt, wird er aufgeloest.

> **Kein Server.** Zwei Konten auf demselben Geraet teilen sich einen Haushalt
> wirklich. Ueber Geraete hinweg braucht es den Server — die Sichtbarkeitslogik
> in `repositories.ts` ist aber schon die richtige.

## Kalender

`src/features/calendar/` — drei Ansichten ueber denselben Datenbestand:

- `MonthView` — Raster mit Kaestchen: jeder Tag zeigt seine Termine als farbige
  Streifen, `+N` wenn mehr da sind. Ein Tag antippen fuehrt in seine Tagesansicht.
- `TimeGrid` — Zeitraster fuer Tag und Woche, mit Ueberlappung nebeneinander
  und einer Linie fuer die aktuelle Uhrzeit
- `EventEditor` — Titel, ganztaegig, Datum, Von/Bis, Kalender, Farbe, Ort, Notiz.
  Die Zielkalender werden hier angehakt, **mehrere sind erlaubt**: Privat,
  die Haushalte (unter ihrem Namen) und die eigenen Kalender. Ein
  Familientermin landet genau im gewaehlten Haushalt, nicht im aktiven.
  Der Knopf zum Anlegen ist der kleine `FloatingButton` unten rechts.
- `CalendarPicker` — das aufklappbare Menue in der Kopfzeile. Oben die Ansicht
  (Tag/Woche/Monat), darunter je ein Haekchen pro eigenem Kalender mit
  "Alle anzeigen", ganz unten unter **Kalender anzeigen** die Personen.
  Angezeigt wird die Vereinigung der angehakten Quellen; der Knopf in der
  Leiste sagt, wie viele es sind. "Kalender verwalten" sitzt als Zahnrad
  oben rechts, nicht mehr im Menue.

### Eigene Kalender

`src/db/calendars.ts` — jeder kann bis zu **5** eigene Kalender fuehren
(`MAX_CALENDARS`). Geteilt wird ueber `calendarMembers`: Haushaltsmitglieder
kommen direkt dazu, Externe werden per **Benutzername** eingeladen und muessen
zustimmen. Offene Einladungen erscheinen als Karte oben im Kalender.

Jedes Konto hat einen eindeutigen `username`, aus der E-Mail abgeleitet.
`backfillUsernames()` traegt ihn bei aelteren Konten beim Start nach.

### Fremde Kalender ansehen

Im Menue stehen unter **Kalender anzeigen** die Haushaltsmitglieder — je
Haushalt eine Gruppe, mit Ueberschrift erst, wenn mehrere Haushalte Leute
beisteuern; wer in zweien ist, erscheint nur einmal. Darunter **Andere**:
Konten ausserhalb der Haushalte, die zugestimmt haben.

"Andere Person anzeigen" fragt per Benutzername an (`src/db/shares.ts`,
Sammlung `calendarShares`). Bis zur Zustimmung steht dort "wartet auf
Zustimmung"; die angefragte Person sieht oben im Kalender eine Karte und
entscheidet. Private Termine bleiben auch danach verborgen.

Keiner dieser Haken ist voreingestellt: fremde Kalender kommen nur dazu,
wenn man sie ausdruecklich anhakt. "Alle anzeigen" gilt nur fuer die
eigenen Kalender.

### Sichtbarkeit (`matchesSource` / `isVisible` in `repositories.ts`)

Jede angehakte Quelle wird einzeln geprueft, gezeigt wird die Vereinigung.

- **Privat** — persoenliche Termine, nur der eigene Kalender
- **Haushalt** — je Haushalt eine eigene Quelle (`house:<id>`), benannt nach
  dem Haushalt. Wer in dreien ist, hat drei davon.
- **Eigener Kalender** — was in diesem Kalender steht, fuer alle, die dabei sind
- **Mitglied** — der persoenliche Kalender einer anderen Person, ohne deren
  private Termine. Wer das darf, steht in `access.canSee`: alle aus den
  eigenen Haushalten plus die angenommenen Anfragen.
- Persoenliche Termine sind standardmaessig fuer den Haushalt sichtbar;
  der Schalter "Privat" nimmt sie heraus.
- Die Startseite (`listUpcoming`) zeigt nur Eigenes, quer ueber die eigenen
  Kalender — nie Eintraege anderer Mitglieder.

### Ein Termin in mehreren Kalendern

Liegt ein Termin in mehreren Kalendern, steht er als **mehrere Zeilen** in
`events`, die sich eine `groupId` teilen (`groupOf(row)` — alte Zeilen ohne
`groupId` stehen fuer sich). So bleibt die Sichtbarkeit je Kopie richtig: die
Haushaltskopie sehen die Mitglieder, die private nicht.

`listBetween` und `listUpcoming` entdoppeln nach `groupId` — wer zwei Kalender
anzeigt, in denen derselbe Termin liegt, sieht ihn trotzdem einmal.
`events.save(groupId, …)` legt fehlende Kopien an, aktualisiert die
bleibenden und loescht die abgewaehlten; `events.remove(groupId)` raeumt alle
Kopien weg.

`dates.ts` haelt die Datumsrechnung ohne Fremdbibliothek; die Woche beginnt
am Montag. `colors.ts` hat die sieben Terminfarben — Termine ohne Farbe
bekommen die Standardfarbe, damit aeltere Zeilen weiter passen.

Noch nicht drin: Wiederholungen, mehrtaegige Termine, Erinnerungen.

## Module

Alle Module sind von Anfang an vorhanden; es gibt keinen Installationszustand.
Zwei Stellen leiten sich aus den im Onboarding gewaehlten Bereichen ab:

- **Module-Tab**: `groupedModules(selectedAreas)` — je Bereich eine Ueberschrift,
  darunter die Module vier nebeneinander. Gewaehlte Bereiche stehen oben.
  Oben rechts schaltet ein Segmented zwischen **Alle** und **Favoriten** um.
- **Heute**: `highlightedModuleIds(selectedAreas)` — nur Prioritaet 1 der
  gewaehlten Bereiche bekommt eine Karte, sonst wird der Bildschirm zur Wand.

Favoriten liegen als `favouriteModuleIds` im `AppContext` und ueberleben einen
Neustart. Gesetzt werden sie **in der Uebersicht**: der Stern sitzt auf der
Kachel, der Langdruck bietet dasselbe im Blatt an. In der geoeffneten App gibt
es keinen Stern mehr; nur die Detailseite hat ihn noch ueber
`useFavouriteAction(moduleId)`.

Der Apps-Tab startet auf **Favoriten** — die ganze Liste holt man sich mit dem
Segmented oben rechts. Wer noch keine hat, sieht dort den Weg zu "Alle".

## Onboarding

Vier Schritte: Name, Bereiche, **Fragen**, Haushalt.

Der Fragenschritt (`app/(onboarding)/questions.tsx`) stellt fuenf Fragen mit
Mehrfachauswahl; `src/features/onboarding/questions.ts` haelt sie samt der
Zuordnung Antwort → Module. `favouritesFromAnswers()` macht daraus die
Startfavoriten, in der Reihenfolge der Registry und hoechstens acht
(`MAX_START_FAVOURITES`). Wer alles ueberspringt, bekommt die Prioritaet-1-Module
der gewaehlten Bereiche, sonst `DEFAULT_FAVOURITE_IDS` — leer bleibt es nie.

## Aussehen

`/appearance` (aus dem Profil) stellt drei Regler, alle am Konto gespeichert:

|                |                                                                      |
| -------------- | -------------------------------------------------------------------- |
| Modus          | Hell, Dunkel oder dem Geraet folgen (`useColorScheme`)               |
| Voreinstellung | `clean` ruhig, `colorful` jede App in ihrer Farbe, `mono` ohne Farbe |
| Akzentfarbe    | Acht Toene aus `ACCENTS`, in Schwarzweiss ohne Wirkung               |

`createTheme(scheme, accent, preset)` baut daraus die Palette; der
`AppContext` haelt sie und gibt sie an den `ThemeProvider`. Konten ohne die
Felder fallen auf hell / clean / Salbei zurueck.

Jede App hat eine eigene Farbe (`src/theme/modules.ts`). `moduleTint(theme, id)`
sagt, wie ihr Logo aussieht: zart getoent bei `clean`, gefuellt bei `colorful`,
grau bei `mono`. Kachel, Detailseite und die Vorschau in den Einstellungen
benutzen denselben Helfer.

## Design

Ein erster Aufraeumdurchgang ist gemacht:

- Karten ohne Rahmen — Weiss auf gedaempftem Hintergrund trennt genug.
- Abschnittsbeschriftungen nicht mehr in Grossbuchstaben.
- Keine Trennlinien unter dem Kopf- und ueber dem Fussbereich.
- Zweitrangige Knoepfe gefuellt statt umrandet.
- Weichere Radien, grosse Titel auf den Tab-Wurzeln.

`Sheet` legt sich im Browser in den Telefonrahmen statt ueber das ganze
Fenster — `usePhoneFrame()` liefert dafuer die Masse.

Die Module heissen in der Oberflaeche **Apps**. Routen und Code-Bezeichner
bleiben `modules` / `ModuleDefinition`, damit die Umbenennung nicht durch
den ganzen Baum faerbt.

## Regeln

- **Keine rohen Zahlen.** Abstand, Schriftgroesse, Farbe und Radius kommen aus
  `useTheme()`. Kein `padding: 12`, kein `#333` im Bildschirmcode.
- **Kein Text im Code.** Jeder sichtbare String geht durch `t('key')`.
  Neue Schluessel in `src/i18n/de.ts`, die anderen Sprachen fallen darauf zurueck
  und loggen die Luecke.
- **Datum und Zahlen ueber `Intl`.** Helfer in `src/i18n/format.ts`, Schweizer Locale.
- **Daten kommen aus `src/db/repositories.ts`**, gelesen ueber `useLiveQuery`.
  Nach jedem Schreiben laufen offene Abfragen von selbst neu.
- **Kein Bildschirm greift direkt auf den Speicher zu** — immer ueber ein
  Repository, damit ein Serverwechsel nur diese eine Schicht trifft.
- **Blaetter rollen.** `Sheet` legt seinen Inhalt in eine `ScrollView` und im
  Browser in den Telefonrahmen. Dort nie `flex: 0` schreiben, wo eine Hoehe
  gelten soll — daraus wird `flex-basis: 0%`, und das Blatt faellt auf null
  zusammen (unsichtbar, aber es faengt weiter alle Klicks ab).
- **Kein leerer Bildschirm.** Wo nichts ist, steht ein `EmptyState` mit Grund und
  Ausweg; wo geladen wird, steht `Loading`.
- **Unveraenderlich.** Zustand wird kopiert, nie mutiert.
- **TypeScript strict**, inklusive `noUncheckedIndexedAccess`. `npx tsc --noEmit`
  muss sauber sein, bevor etwas als fertig gilt.

## Wo die Naht zum Server liegt

Zwei Dateien, sonst nichts:

- `src/db/repositories.ts` — die Abfragen. Gleiche Signaturen, andere Quelle.
- `src/auth/accounts.ts` — Registrieren und Anmelden.

Passwoerter liegen lokal als SHA-256 ueber Salt + Passwort. Das ist fuer einen
Speicher auf dem Geraet vertretbar, ersetzt aber keine Server-Anmeldung: sobald
es einen Server gibt, uebernimmt der die Anmeldung samt richtigem Verfahren.
