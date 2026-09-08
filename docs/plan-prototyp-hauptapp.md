# Plan: Prototyp der Hauptapp

Better Life · Stand 8. September 2026 · Ziel ist ein durchklickbarer Prototyp, keine funktionierende App

---

## 1. Was gebaut wird

Eine Weboberfläche, die auf `localhost` im Browser läuft und dort als Handy dargestellt wird. Man kann sich durchklicken: anmelden, Onboarding, Startbildschirm mit dem Tag, eigene Module, Module entdecken und installieren, Assistent, Profil.

**Nichts davon hängt an einem Server.** Keine Datenbank, kein Supabase, keine echte Anmeldung, keine KI. Alle Daten kommen aus statischen Dateien im Projekt.

### Warum trotzdem Expo und nicht einfach eine Webseite

Der Prototyp wird später die echte App. Wenn er in Expo entsteht, ist er von Anfang an dasselbe Projekt — dieselbe Ordnerstruktur aus `CLAUDE.md`, dieselben Bildschirme, dieselben Bausteine. Später werden die Mock-Dateien durch echte Abfragen ersetzt, und aus dem Prototyp wird die App. Eine separate Webseite müsste man wegwerfen.

### Was ausdrücklich noch nicht gebaut wird

| Nicht jetzt | Wann |
|---|---|
| Supabase, Datenbank, echte Anmeldung | Phase 0 |
| Haushalte mit echten Mitgliedern | Phase 0 |
| Das echte Modul-System mit Berechtigungen | Phase 0 |
| Ein Modul, das wirklich etwas tut | Phase 1 |
| KI-Anbindung | Phase 4 |
| Schönes Design, Animationen, Feinschliff | später, bewusst |

### Zum Aussehen

Schlicht und ruhig, aber nicht lieblos: durchgehende Abstände, eine Schriftgrösse-Skala, Graustufen, eine einzige zurückhaltende Akzentfarbe. Keine Verläufe, keine bunten Überschriften, keine Illustrationen. Das Ziel ist, dass man die **Struktur** beurteilen kann, nicht die Optik.

---

## 2. Wann der Prototyp fertig ist

- `npm run web` startet, im Browser erscheint ein Handy-Rahmen mit der App darin
- Man klickt sich vom Startbildschirm über Anmelden und Onboarding bis in die App
- In "Heute" stehen Termine, Aufgaben und Karten der installierten Module
- Unter "Entdecken" findet man über 20 Module, kann suchen und nach Bereich filtern
- Ein Modul lässt sich installieren; es erscheint danach in "Meine Module" und in "Heute"
- Deinstallieren nimmt es wieder weg
- Der Assistent öffnet sich und zeigt einen Beispieldialog
- Kein Bildschirm ist leer, ohne dass er erklärt, warum
- Alles läuft auch auf dem Handy, wenn man das Projekt dort öffnet

---

## 3. Technische Basis

```
Expo mit Expo Router, TypeScript strict
React Native Web für den Browser
Kein State-Management-Paket — React Context reicht für den Prototyp
Kein Backend, kein Netzwerkaufruf
Mock-Daten in src/mocks/
```

Ordnerstruktur wie in `CLAUDE.md` Kapitel 5. Neu dazu, nur für den Prototyp:

```
src/
  mocks/
    modules.ts        die Modul-Registry, ~24 Einträge
    today.ts          Termine, Aufgaben, Karten für den Tag
    person.ts         angemeldete Person, Haushalt
    assistant.ts      Beispieldialog
  ui/                 die Bausteine aus P-004
  theme/              Abstände, Schriften, Farben
```

---

## 4. Die Bildschirme

### Vor der Anmeldung
1. **Start** — Name, ein Satz, "Anmelden" und "Konto erstellen"
2. **Anmelden** — E-Mail, Passwort, Apple- und Google-Knopf. Jeder Knopf führt weiter, ohne zu prüfen.
3. **Konto erstellen** — dasselbe, führt ins Onboarding

### Onboarding
4. **Willkommen** — Name eingeben
5. **Bereiche wählen** — Gesundheit, Organisation, Geld, Haushalt. Mehrfachauswahl.
6. **Module vorschlagen** — passend zur Auswahl, mit Häkchen zum Abwählen
7. **Haushalt** — anlegen, beitreten oder überspringen

### Die App, vier Tabs
8. **Heute** — der Hub. Datum, dann Karten untereinander: nächste Termine, offene Aufgaben, und pro installiertem Modul eine Karte.
9. **Meine Module** — Raster wie ein Homescreen. Antippen öffnet das Modul. Langes Antippen zeigt "Zum Homescreen hinzufügen" und "Deinstallieren".
10. **Entdecken** — Suchfeld oben, darunter die vier Bereiche als Filter, dann Modulkarten. Installierte sind markiert.
11. **Profil** — Person, Haushalt mit Mitgliedern, Abo-Stand, Sprache, Einstellungen.

### Weitere
12. **Modul-Detail** — was es macht, worauf es zugreift ("liest deinen Kalender, schreibt Aufgaben"), Knopf Installieren oder Deinstallieren
13. **Assistent** — Chat-Oberfläche, über einen Knopf im Kopfbereich von überall erreichbar
14. **Beispielmodul Kalender** — ein Platzhalter-Bildschirm, damit man sieht, wie es aussieht, wenn man ein Modul öffnet

---

## 5. Tickets

Ein Ticket pro Prompt an Claude Code. Reihenfolge einhalten.

### P-001 · Projekt aufsetzen
Expo mit TypeScript strict, Expo Router, Web-Target. ESLint, Prettier. `CLAUDE.md` und die Dokumente nach `docs/`.
**Fertig wenn:** `npm run web` öffnet eine leere Seite im Browser, `npx tsc --noEmit` ist sauber.

### P-002 · Telefon-Rahmen für den Browser
Eine Komponente, die auf Web den Inhalt in einen zentrierten Rahmen von 390 × 844 Punkten legt, mit abgerundeten Ecken und einer angedeuteten Statusleiste. Auf einem echten Gerät rendert sie einfach die Kinder ohne Rahmen.
**Fertig wenn:** Im Browser sieht man ein Handy in der Mitte der Seite, auf dem Handy sieht man nur die App.
**braucht:** P-001

### P-003 · Gestaltungsgrundlagen
`src/theme/`: Abstandsskala (4, 8, 12, 16, 24, 32), Schriftgrössen (12, 14, 16, 20, 28), Graustufen, eine Akzentfarbe, Eckenradien. Hell und dunkel vorbereitet, aber vorerst nur hell.
**Fertig wenn:** Keine Zahl für Abstand, Grösse oder Farbe steht irgendwo direkt im Code.
**braucht:** P-001

### P-004 · UI-Bausteine
`src/ui/`: `Screen`, `Header`, `Card`, `ListItem`, `Button`, `Input`, `Badge`, `Sheet`, `EmptyState`, `Divider`, `Avatar`, `Icon`.
**Fertig wenn:** Ein Testbildschirm zeigt jeden Baustein in allen Zuständen (normal, gedrückt, deaktiviert, lädt).
**braucht:** P-003

### P-005 · Sprachen
`src/i18n/` mit `de`, `fr`, `it`, `en`. Nur `de` gefüllt, der Rest fällt darauf zurück und wird geloggt. Zahlen und Datum über `Intl`, Schweizer Format.
**Fertig wenn:** Der Sprachwechsel in den Einstellungen wirkt sofort, fehlende Schlüssel erscheinen in der Konsole.
**braucht:** P-001

### P-006 · Navigationsgerüst
Zwei Bereiche: der Auth-Stack (Start, Anmelden, Registrieren, Onboarding) und der Tab-Navigator (Heute, Meine Module, Entdecken, Profil). Ein Schalter im Mock-Zustand entscheidet, welcher gezeigt wird.
**Fertig wenn:** Man kommt vom Start bis in die Tabs und über "Abmelden" im Profil wieder zurück.
**braucht:** P-004, P-005

### P-007 · Mock-Datenschicht
`src/mocks/` plus ein React-Context, der den Zustand hält: angemeldet ja/nein, Person, installierte Module. Alle Bildschirme lesen nur von hier, nie aus einer Datei direkt.
**Fertig wenn:** Ein Wechsel in `mocks/` verändert die ganze App, ohne dass ein Bildschirm angefasst wird.
**braucht:** P-006

### P-008 · Modul-Registry
`src/mocks/modules.ts` mit rund 24 Modulen aus dem Plattformkonzept Kapitel 5. Pro Modul: `id`, `name`, `area`, `beschreibung`, `icon`, `permissions.read`, `permissions.write`, `installed`.
Die Struktur ist bereits die echte aus dem Plattformkonzept — später wird nur die Quelle getauscht, nicht die Form.
**Fertig wenn:** Alle vier Bereiche haben Module, alle Prioritäten 1 bis 3 sind vertreten.
**braucht:** P-007

### P-009 · Start, Anmelden, Registrieren
Drei Bildschirme, ohne Prüfung. Jeder Knopf führt weiter. Passwortfeld verdeckt, aber nichts wird validiert.
**Fertig wenn:** Man kommt über alle drei Wege ins Onboarding oder in die App.
**braucht:** P-006

### P-010 · Onboarding
Vier Schritte mit Fortschrittsanzeige, vor und zurück: Name, Bereiche wählen, vorgeschlagene Module, Haushalt. Die Auswahl landet im Mock-Zustand und bestimmt, welche Module am Ende installiert sind.
**Fertig wenn:** Wer im Onboarding nur "Haushalt" wählt, hat danach andere Module installiert als jemand, der "Gesundheit" wählt.
**braucht:** P-008, P-009

### P-011 · Tab "Heute"
Datum oben, darunter Karten: die nächsten Termine, offene Aufgaben, und pro installiertem Modul eine Karte mit Beispielinhalt. Ein Knopf oben rechts öffnet den Assistenten.
**Fertig wenn:** Ein neu installiertes Modul erscheint hier, ein deinstalliertes verschwindet.
**braucht:** P-008

### P-012 · Tab "Meine Module"
Raster mit Icon und Name. Antippen öffnet das Modul. Langes Antippen öffnet ein Sheet mit "Zum Homescreen hinzufügen" (zeigt vorerst nur einen Hinweistext) und "Deinstallieren".
**Fertig wenn:** Deinstallieren wirkt sofort in beiden Tabs.
**braucht:** P-008

### P-013 · Tab "Entdecken"
Suchfeld, Bereichsfilter als Reihe von Chips, darunter die Modulkarten. Suche filtert nach Name und Beschreibung. Installierte Module sind markiert.
**Fertig wenn:** Eine Suche nach "kalender" findet das Modul, eine nach "xyz" zeigt einen sinnvollen leeren Zustand.
**braucht:** P-008

### P-014 · Modul-Detailseite
Icon, Name, Bereich, Beschreibung, und der Abschnitt "Worauf dieses Modul zugreift" — aus `permissions` erzeugt, in verständlichen Sätzen: "Liest deine Termine. Schreibt Aufgaben und Einkaufslisten." Unten der Knopf Installieren oder Deinstallieren.
**Fertig wenn:** Die Berechtigungstexte entstehen automatisch aus den Daten, nicht von Hand geschrieben.
**braucht:** P-013

### P-015 · Installieren und Deinstallieren
Der Zustand liegt im Context und bleibt über einen Neustart erhalten (`AsyncStorage`). Deinstallieren fragt nach und zeigt an, was verschwindet.
**Fertig wenn:** Nach einem Neuladen der Seite sind dieselben Module installiert.
**braucht:** P-014

### P-016 · Tab "Profil"
Person mit Namen und Bild, Haushalt mit drei Beispiel-Mitgliedern und deren Rollen, Abo-Stand, Sprachwahl, Einstellungen, Abmelden.
**Fertig wenn:** Der Sprachwechsel wirkt sofort auf die ganze App.
**braucht:** P-005, P-007

### P-017 · Assistent
Chat-Oberfläche als Vollbild-Sheet, von überall über den Knopf im Kopfbereich erreichbar. Beispieldialog aus `mocks/assistant.ts`. Eingabe möglich, Antwort ist eine feste Beispielantwort mit kurzer Verzögerung. Oben der Hinweis, dass es sich um KI handelt.
**Fertig wenn:** Der Dialog zeigt, wie eine Aktion über mehrere Module aussieht — inklusive der Bestätigungsfrage vor dem Ausführen.
**braucht:** P-011

### P-018 · Beispielmodul Kalender
Ein Platzhalter-Bildschirm: Kopfzeile mit Modulname, eine Wochenansicht mit Beispielterminen, ein Plus-Knopf ohne Funktion.
**Fertig wenn:** Aus "Meine Module" und aus "Heute" landet man hier.
**braucht:** P-012

### P-019 · Leere und ladende Zustände
Jeder Bildschirm, der etwas anzeigen könnte, hat einen definierten Zustand, wenn nichts da ist: kein Modul installiert, keine Termine heute, keine Suchtreffer. Dazu ein einheitlicher Ladezustand.
**Fertig wenn:** Kein Bildschirm ist jemals einfach weiss.
**braucht:** alle vorherigen

### P-020 · Durchklicken und aufräumen
Einmal alles durchklicken, jeden Weg. Jede Sackgasse, jeder falsche Zurück-Knopf, jeder abgeschnittene Text wird notiert und behoben. Zusätzlich einmal im schmalen Fenster und einmal auf einem echten Handy prüfen.
**Fertig wenn:** Es gibt keinen Weg, auf dem man stecken bleibt.
**braucht:** P-019

---

## 6. Mock-Daten

Damit der Prototyp echt wirkt, brauchen die Daten Substanz. Halbleere Bildschirme lassen keine Beurteilung zu.

**`modules.ts`** — 24 Module aus dem Plattformkonzept. Beispiel:
```ts
{
  id: 'shopping',
  area: 'household',
  name: 'Einkaufsliste',
  short: 'Geteilte Listen, automatisch aus deinen Rezepten',
  icon: 'cart',
  permissions: {
    read:  ['tasks'],
    write: ['tasks', 'money_entries'],
  },
  installed: false,
}
```

**`today.ts`** — ein realistischer Dienstag: vier Termine, sechs Aufgaben, davon zwei aus dem Haushalt, eine Frist, zwei geplante Mahlzeiten.

**`person.ts`** — Person mit Namen, dazu ein Haushalt "Zuhause" mit drei Mitgliedern in verschiedenen Rollen.

**`assistant.ts`** — ein Beispieldialog, der zeigt, worum es geht:
> **Du:** Plan mir morgen Abend Training und ein leichtes Znacht
> **Assistent:** Ich würde das so machen — Training 18:30 bis 19:30, du hast dort nichts im Kalender. Danach Pouletsalat, etwa 480 kcal. Für den Salat fehlen dir drei Sachen, die kämen auf die Einkaufsliste vom Haushalt. Soll ich?
> *[Bestätigen] [Anpassen]*

---

## 7. Der Prompt für Claude Code

Zum Start:

```
Lies CLAUDE.md, docs/better-life-plattform.md und
docs/plan-prototyp-hauptapp.md.

Fass mir in acht Sätzen zusammen, was der Prototyp ist, was er
ausdrücklich nicht ist, und wie die vier Tabs heissen.

Schreib noch keinen Code.
```

Dann pro Ticket:

```
Arbeite Ticket P-001 aus docs/plan-prototyp-hauptapp.md ab.
Halte dich an CLAUDE.md.
Zeig mir zuerst deinen Plan und welche Dateien du anlegen willst.
Warte auf mein OK.
```

Nach jedem Ticket:

```bash
npx tsc --noEmit
git add . && git commit -m "feat(proto): phone frame for web (P-002)"
```

---

## 8. Was danach passiert

Der Prototyp ist die Vorlage, an der du entscheidest, ob die Struktur stimmt: Sind vier Tabs richtig? Gehört der Assistent in einen eigenen Tab? Ist "Entdecken" der richtige Ort, um Module zu finden?

Was du dort änderst, ist billig. Dieselbe Änderung nach Phase 0 ist teuer.

Erst wenn der Durchklick sitzt, kommt Phase 0 aus dem Plattformkonzept: Supabase, Haushalte, Kernobjekte, das echte Modul-System. Die Bildschirme bleiben dabei stehen — es wird nur die Datenquelle getauscht.
