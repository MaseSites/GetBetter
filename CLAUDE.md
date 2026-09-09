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
  (tabs)/            Startseite, Module, Assistent, Profil
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
| Was           | Verwaltet quer ueber die installierten Module                           | Ein ganz normales KI-Gespraech                        |
| Wo            | `app/(tabs)/assistant.tsx` → `src/features/assistant/AssistantView.tsx` | `app/run/[id].tsx` → `src/features/ai/AiChatView.tsx` |
| Installierbar | Nein, eingebaut                                                         | Entfaellt — alle Module sind da (im Abo enthalten)    |
| Daten         | Liest und schreibt deine Module, fragt vor dem Eintragen                | Sieht deine Daten nicht                               |

## Haushalte

`src/db/households.ts` — Haushalt, Mitgliedschaften, Rollen. Ein Haushalt hat
einen sechsstelligen Einladungscode (ohne I, O, 0, 1). Wer anlegt, wird
Verwalter; wer beitritt, wird Mitglied. Verwalter koennen umbenennen und Rollen
wechseln — der letzte Verwalter kann sich nicht selbst herabstufen, und beim
Austritt erbt das aelteste Mitglied die Rolle.

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

- `MonthView` — Raster mit farbigen Punkten, darunter die Agenda des gewaehlten Tages
- `TimeGrid` — Zeitraster fuer Tag und Woche, mit Ueberlappung nebeneinander
  und einer Linie fuer die aktuelle Uhrzeit
- `EventEditor` — Titel, ganztaegig, Datum, Von/Bis, Kalender, Farbe, Ort, Notiz

Sichtbarkeit (`isVisible` in `repositories.ts`):

- **Privat** — persoenliche Termine, nur der eigene Kalender
- **Familie** — Termine im Familienkalender, alle Mitglieder sehen sie
- **Mitglied** — der persoenliche Kalender eines Mitglieds, ohne dessen
  private Termine
- Persoenliche Termine sind standardmaessig fuer den Haushalt sichtbar;
  der Schalter "Privat" nimmt sie heraus.

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
Neustart. Gesetzt werden sie per Langdruck auf eine Kachel oder ueber den Stern
oben rechts — `useFavouriteAction(moduleId)` liefert diesen Kopf-Knopf, jeder
Modul-Bildschirm und die Detailseite benutzen denselben; das Onboarding belegt sie mit den Prioritaet-1-Modulen der
gewaehlten Bereiche, ohne Onboarding gilt `DEFAULT_FAVOURITE_IDS`.

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
