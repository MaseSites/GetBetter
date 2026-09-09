# GetBetter und die Better-Apps

Fünf eigenständige Expo-Apps in einem Arbeitsbereich, die sich **eine Datenbank
teilen**. Im Browser laufen sie als Handy, auf einem echten Gerät über Expo Go.
Anmeldung und Daten sind echt und liegen im Dienst `services/api`, den du
mitstartest.

| App              | Was drin ist                                                                                | Web  |
| ---------------- | ------------------------------------------------------------------------------------------- | ---- |
| **GetBetter**    | Privater Kalender, Aufgaben, Notizen, Wecker, Assistent — dazu die Übersicht über alle Apps | 8081 |
| **BetterFamily** | Familienkalender, Einkaufsliste, Ämtli, Rezepte, Pflanzen, Haustiere, Fahrzeuge, Haushalt   | 8082 |
| **BetterGym**    | Training, Menüplan, Trinken                                                                 | 8083 |
| **BetterAi**     | Das KI-Gespräch                                                                             | 8084 |
| **BetterMoney**  | Budget, Rechnungen, Abos, Sparziele                                                         | 8085 |

```bash
npm install
npm run all        # Datenbank und alle fünf Apps auf einmal
```

Einzeln geht auch: `npm run server`, `npm run web`, `npm run family`,
`npm run gym`, `npm run ai`, `npm run money`.

Jede App hat drei Tabs: **Start** (was gerade ansteht, direkt bearbeitbar),
**Funktionen** (die Logos dieser App) und **Profil**. GetBetter hat dazu den
**Assistenten**.

Der **Kalender** in GetBetter hat Tages-, Wochen- und Monatsansicht, Termine mit
Farbe, Ort und Notiz, und legt beim Antippen einer freien Stunde gleich einen an.
Ein Termin kann in mehreren Kalendern liegen und wird trotzdem einmal angezeigt.
GetBetter hat dazu Aufgaben (nach Frist in Abschnitten, mit Fahne und Notiz),
Notizen mit Suche und Anheften, Wecker, Dokumente mit Ablaufdatum,
Gewohnheiten mit Wochenpunkten und Serie, Reisen mit Packliste und Kontakte
mit Geburtstagen. BetterFamily führt die Einkaufsliste nach Abteilungen
sortiert, Ämtli, Rezepte (Zutaten direkt auf die Liste), Pflanzen mit
Giessrhythmus, Haustiere mit Terminen und Fahrzeuge mit Service, Vignette und
Reifen. BetterGym hat Training, Menüplan und Trinken, BetterMoney Budget,
Rechnungen, Abos und Sparziele, BetterAi den Chat. Was noch fehlt, steht
unter **Kommt noch** und sagt das.

**Haushalte** (BetterFamily): anlegen oder mit einem sechsstelligen Code
beitreten, Rollen Verwalter und Mitglied. Im Haushalt teilen sich alle die
Einkaufsliste, den Familienkalender und die Ämtli samt Zuteilung.

## Wie die Apps zusammenspielen

Alle Apps sprechen mit demselben Dienst. Dort liegen die Profile **und** die
Daten: du meldest dich überall mit denselben Daten an, und was die eine App
einträgt, sieht die andere. Läuft der Dienst nicht, sagen die Apps das und
schreiben nichts.

GetBetter kann den anderen Apps ausserdem etwas **auftragen**:

> „pack mir 2 Bananen auf die Einkaufsliste“

Der Assistent erkennt das und öffnet BetterFamily über einen Tiefenlink
(`betterfamily://befehl/einkauf?text=2%20Bananen`), die es dann einträgt.

**Wer was führt**: GetBetter hat den privaten Kalender, die Aufgaben, Notizen
und den Wecker. Haushalte und der Familienkalender liegen in BetterFamily.

Ein neues Konto startet leer.

## Veröffentlichen

Jede App ist für den Store vorbereitet: `apps/<name>/app.json` trägt Name,
Version, `ch.better.<name>` als Bundle- und Paketkennung, Splash und Icons;
`apps/<name>/eas.json` die Bauprofile `development`, `preview`, `production`.

```bash
node scripts/icons.js                       # alle Bilder neu aus dem Code
cd apps/getbetter
EXPO_PUBLIC_API_URL=https://api.example.ch eas build --profile production
```

`EXPO_PUBLIC_API_URL` sagt der App, wo die Datenbank läuft — ohne sie nimmt sie
den Rechner, von dem Expo geladen hat. Der mitgelieferte Dienst ist für die
Entwicklung gedacht (kein HTTPS, keine Zugriffstoken); vor einer echten
Veröffentlichung gehört die Datenbank hinter einen richtigen Server.
Sobald eine App im Store ist, kommt ihr `packageName` in `APPS`
(`packages/core/src/app/identity.ts`) — dann führt der Installieren-Knopf in
GetBetter dorthin.

Die Konventionen und der genaue Aufbau stehen in [CLAUDE.md](CLAUDE.md).
