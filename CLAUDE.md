# Better Life — Prototyp der Hauptapp

Durchklickbarer Prototyp in Expo. Kein Backend, keine Datenbank, keine KI.
Alle Daten kommen aus `src/mocks/`. Der Plan liegt in
[docs/plan-prototyp-hauptapp.md](docs/plan-prototyp-hauptapp.md).

> Hinweis: Im Repo lag beim Aufsetzen keine `CLAUDE.md`. Diese Datei beschreibt
> die Konventionen, nach denen der Prototyp tatsaechlich gebaut wurde.
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
  mocks/             modules.ts, today.ts, person.ts, assistant.ts
  state/             AppContext — der gesamte Zustand
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
- **Bildschirme lesen nur aus `useApp()`**, nie direkt aus einer Mock-Datei.
  Ein Wechsel in `src/mocks/` veraendert die ganze App.
- **Kein leerer Bildschirm.** Wo nichts ist, steht ein `EmptyState` mit Grund und
  Ausweg; wo geladen wird, steht `Loading`.
- **Unveraenderlich.** Zustand wird kopiert, nie mutiert.
- **TypeScript strict**, inklusive `noUncheckedIndexedAccess`. `npx tsc --noEmit`
  muss sauber sein, bevor etwas als fertig gilt.

## Wo spaeter die Naht liegt

Beim Umstieg auf ein echtes Backend wird nur `src/mocks/` durch Abfragen ersetzt.
Die Form der Daten in `src/mocks/types.ts` — besonders `ModuleDefinition` mit
`permissions.read` / `permissions.write` — ist bereits die vorgesehene echte Form.
Bildschirme und Bausteine bleiben stehen.
