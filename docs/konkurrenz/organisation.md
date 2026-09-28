# GetBetter gegen die Konkurrenz — Organisation

Stand: 25.09.2026. Bereich: die Hauptapp GetBetter — Kalender, Aufgaben,
Notizen, Wecker, Wetter, Dokumente, Gewohnheiten, Reisen, Kontakte,
Geburtstage, E-Mail, Startseite/Tagesband, Assistent.
Geprüft am Code (`packages/core/src/features/…`, `db/types.ts`), nicht nur an
CLAUDE.md. Leitlinie: Einrichten ≤ 1 Minute, ein Plus für das Häufigste, alle
Funktionen schauen aufeinander, kein Formular-Wust.

## Was es bei uns wirklich gibt (Kurzbefund aus dem Code)

- **Aufgaben** (`features/tasks/`): Satz-Erkennung (`parse.ts`), Wiederholen
  (`recurrence.ts`), Erinnerungen als Push (`reminders.ts`,
  `pushReminders.ts`), Verschieben (`postpone.ts`), Teilaufgaben, Projekte,
  Tags, Bilder. **Keine Dauer/Schätzung** am Task.
- **Kalender** (`features/calendar/`): Monat, Woche, Tag, mehrere Kalender,
  fremde ansehen, Deep-Link mit Aufleuchten. `EventRow` hat nur `startsAt`,
  `endsAt`, `allDay`, `location`, `notes` — **keine Wiederholung, keine
  Erinnerung, kein Mehrtages-Termin**, Eingabe nur über Felder.
- **Notizen**: Blöcke, Ordner, Tags, Papierkorb, an die Startseite heften,
  Teilen (`share.ts`). **Keine Verknüpfung zu Aufgaben**.
- **E-Mail**: IMAP/SMTP, Unterhaltungen, Senden mit Rückgängig, Entwürfe,
  Filter. **Kein „Später erinnern“ (Snooze), kein „Als Aufgabe“**.
- **Organisation** (`features/organizer/`): Dokumente mit Ablaufdatum,
  Gewohnheiten (Wochenpunkte, Serie), Reisen mit Packliste, Kontakte.
  Reisen und Dokumente tauchen **nicht im Kalender** auf; im Band nur die
  nächste Reise als Hinweis (`useDayThread.ts`).
- **Wecker**: Zeit, Tage, Ton, Schlummern — einfache Liste.
- **Startseite**: Tagesband mit wandernder Jetzt-Linie, grosser Zeitstrahl,
  Aufgaben als Heftseite, vier Ansichten inkl. frei baubarer, Schnellzugriff.
- **Assistent**: bedient die App selbst (`understand.ts`, `vet.ts`,
  `runActions.ts`), Stimme, Rückfrage statt Raten.

## (a) Wo wir schon vorne sind

| Stärke | Warum es zählt | Wer es nicht so hat |
| --- | --- | --- |
| **Eine Datenbank für alles** — Termine, Aufgaben, Geburtstage, Rechnungen, Wecker, Reisen fliessen ins selbe Tagesband | Sunsama und Motion müssen dafür 10+ Dienste verbinden; Things/TickTick kennen keine Mails, keine Rechnungen, keine Geburtstage | Things 3, Todoist, Structured, Fantastical |
| **Tagesband mit echter Zeit** — Karte wird grün, Jetzt-Linie wandert durch, „noch 40 Min.“ | Structured lebt genau von dieser Timeline — bei uns ist sie zusätzlich mit Kalender, Wecker und Rechnungen gefüllt | Structured (nur eigene Blöcke), Apple Kalender |
| **Geburtstage aus den Kontakten**, jedes Jahr gedacht, „Max wird 45“ | Google/Apple zeigen Geburtstage, aber ohne Countdown und eigene Ansicht | Google Calendar, Fantastical |
| **Assistent, der handelt und nachfragt** — löscht/verschiebt nur, wenn er es an den Daten prüfen kann | Todoist Ramble legt nur an; Apple Intelligence schlägt nur vor; Motion plant, kann aber nichts in anderen Bereichen | Todoist, Apple, Amie |
| **Rückgängig statt Rückfrage** überall | Nutzer loben das bei Superhuman und Things; die meisten Kalender fragen „Wirklich löschen?“ | Google, Apple Kalender |
| **Datenschutz Schweiz**, KI in der Schweiz, vier Sprachen inkl. Schweizer Locale | Motion, Superhuman, Sunsama sind US-Dienste mit US-Preisen (20–30 USD/Monat) | alle US-Anbieter |
| **Preis**: GetBetter-Abo CHF 1.–/Monat, alles gratis nutzbar | Habitify-Nutzer klagen über 3 Gratis-Gewohnheiten, Sunsama kostet ~20 USD | Habitify, Sunsama, Motion, Fantastical |

## (b) Die 10 wichtigsten Lücken — sortiert nach Wirkung ÷ Aufwand

| # | Lücke | Wer es hat | Warum es zählt | Wo es bei uns hingehört | Wirkung / Aufwand |
| --- | --- | --- | --- | --- | --- |
| 1 | **Mail → Aufgabe** („Daran erinnern“) | Apple Erinnerungen iOS 26 (Suggested Reminders aus Mails), Superhuman „Remind me“, Todoist-Mail-Weiterleitung | Mails sind die häufigste Quelle für Aufgaben; bei uns liegen beide in derselben App und reden trotzdem nicht miteinander | `features/mail/ConversationBar.tsx`, `useMailActions.ts`, neu `features/mail/toTask.ts` | hoch / klein |
| 2 | **Termine in einem Satz** („Zahnarzt Fr 15–16 @Bern“) | Fantastical (Kern-Grund, warum Leute es kaufen), Apple Kalender iOS 26, Amie, Google | Wir haben die Satz-Erkennung schon für Aufgaben; im Kalender tippt man fünf Felder | neu `features/calendar/parseEvent.ts`, `EventEditor.tsx` | hoch / klein |
| 3 | **Erinnerung vor einem Termin** | jeder Kalender (Apple, Google, Fantastical) | Ohne Erinnerung ist der Kalender auf dem Handy nur zum Nachschauen — das ist die meistgenannte Grundfunktion | `db/types.ts` (`EventRow.reminderMinutes`), neu `features/calendar/reminders.ts`, `features/tasks/pushReminders.ts` | hoch / klein–mittel |
| 4 | **Wiederkehrende Termine** (wöchentlich, monatlich, jährlich) | alle Kalender | Training jeden Dienstag, Putztag, Abo-Termine — heute muss man sie einzeln anlegen. Grösste funktionale Lücke im Kalender | `EventRow.repeat`, Erweiterung in `features/calendar/dates.ts` (`occurrencesBetween`), `db/events.ts` `listBetween`, `EventEditor.tsx`; `features/tasks/recurrence.ts` wiederverwenden | sehr hoch / mittel |
| 5 | **Tag abschliessen** (Abendrückblick: Offenes verschieben, Morgen ansehen) | Sunsama „Daily Shutdown“, Things „Diesen Abend“, TickTick Tagesrückblick | Das Ritual ist der Grund, warum Leute Sunsama 20 USD zahlen; wir haben alle Daten schon im Band | neu `features/today/dayClose.ts`, Karte in `DayTasks.tsx` | mittel–hoch / klein |
| 6 | **Reisen und Ablaufdaten im Kalender und Band** | TripIt (Reiseplan als Tagesansicht), Google/Apple (mehrtägige Termine) | „Alle Funktionen schauen aufeinander“: eine Reise gehört in die Woche, ein ablaufender Pass auf den Tag | neu `features/organizer/dayMarks.ts`, `features/today/useDayThread.ts`, `features/calendar/CalendarView.tsx` | mittel / klein |
| 7 | **Dauer und „Einplanen“** — Aufgabe als Zeitblock in den Tag legen | Structured, Sunsama, Amie, Motion (automatisch), TickTick | Time-Blocking ist 2025/26 der grösste Trend bei Planern; Structured hat 1.5 Mio. Nutzer im Monat damit | `db/types.ts` (`TaskRow.minutes`), `features/tasks/DetailWhen.tsx`, Aktion „Einplanen“ legt einen verknüpften Termin an (`events.save`), Tagesband bleibt aufgabenfrei | hoch / mittel |
| 8 | **Mail „Später“ (Snooze)** | Spark, Superhuman, Gmail, Apple Mail | Inbox Zero ohne Snooze geht nicht; meistgenutzte Geste nach Archivieren | Dienst: `services/api/mail/` (Wiedervorlage-Liste, Takt in `sync.js`), App: `SwipeRow`-Aktion in `InboxParts.tsx` | mittel / mittel |
| 9 | **Bestehende Kalender lesen** (ICS-Abo von Google/Apple/Schule/Verein) | alle Kalender-Apps, Notion Calendar, Amie | Niemand gibt seinen Google-Kalender auf; ohne Import bleibt unser Kalender leer und das Band halb | Dienst: neu `services/api/calendar/ics.js` (Parser nur mit Node-Kern), Sammlung `calendarFeeds`, App: `CalendarPicker.tsx` „Kalender abonnieren“ | sehr hoch / gross |
| 10 | **Widgets / Live Activities** (Tagesband auf dem Sperrbildschirm) | Things, Structured, Fantastical, Streaks | Ein Blick ohne App öffnen; bei Habitify ist das kaputte Widget die Hauptklage — Stabilität zählt mehr als Menge | nativ, eigenes Expo-Modul/Config-Plugin — neuer Store-Bau | hoch / gross |

**Bewusst nicht auf der Liste:** Pomodoro-Timer (TickTick) — wirkt als
Funktionsballast gegen „kein Formular-Wust“; automatische KI-Planung wie
Motion — teuer, und Nutzer klagen über Kontrollverlust; Wiki-Links in Notizen
(Bear) — kleine Zielgruppe.

**Was Nutzer bei der Konkurrenz nervt (und wir vermeiden sollten):**
Habitify — nur 3 Gratis-Gewohnheiten, Widgets aktualisieren nicht; Things —
kein Kalender-Zeitraster, nur Apple; TickTick — überladen; Sunsama/Motion —
teuer und Einrichten dauert; Amie — Aufgaben nur Nebensache; Notion
Calendar — „nur ein einfacher Kalender“.

## (c) Schnelle Gewinne — je wenige Stunden, ohne neues natives Paket

Alle fünf folgen demselben Muster: eine **reine Funktion mit Test**
(`*.test.ts` daneben, relativ importiert, läuft unter `npm test`) und ein
dünner Anschluss an bestehende Bausteine.

### 1. Mail → Aufgabe
- **Rein:** `features/mail/toTask.ts` — `taskFromMail(message, now)` liefert
  `{ title, note, dueDay }`: Titel „Antworten: <Betreff>“ (Betreff ohne
  `Re:/AW:/Fwd:`, gekürzt), Notiz mit Absender und Link
  `/run/mail?message=<id>`, fällig heute. Test: Präfixe, leerer Betreff,
  Länge.
- **Anschluss:** Eintrag „Als Aufgabe“ im Kontextmenü der Zeile
  (`InboxParts.tsx`) und in „Mehr“ der Leiste (`ConversationBar.tsx`);
  speichert über `db/tasks.ts`, danach Feier `task` und „Rückgängig“.
- **Verbindung:** Die Aufgabe steht sofort unter dem Zeitstrahl; ein Tipp auf
  den Link in der Notiz öffnet die Mail.

### 2. Termin in einem Satz
- **Rein:** `features/calendar/parseEvent.ts` —
  `parseEventInput(text, now)` nutzt `parseTaskInput` (`features/tasks/parse.ts`)
  für Tag und Uhrzeit und `readClock` (`features/shared/clock.ts`) für Spannen
  („15–17“, „von 15 bis 17 Uhr“), dazu `@Ort` → `location`. Ergebnis
  `{ title, day, start, end, allDay, location }`. Test mit echten Sätzen wie
  in `understand.test.ts`.
- **Anschluss:** Im `EventEditor.tsx` liest das Titelfeld beim Tippen mit und
  zeigt die erkannten Teile als Chips (wie `chipsOf` in den Aufgaben); die
  Felder darunter füllen sich, bleiben aber änderbar.

### 3. Reisen und Ablaufdaten als Tageszeichen
- **Rein:** `features/organizer/dayMarks.ts` — `tripDaysBetween(trips, from, to)`
  gibt je Tag einen ganztägigen Eintrag („Ferien Tessin · Tag 2 von 5“,
  „Abreise“, „Rückreise“); `expiriesBetween(documents, from, to)` gibt
  „Pass läuft ab“. Ids wie bei Geburtstagen (`trip:<id>:<tag>`), gedacht,
  nicht gespeichert. Test: Grenzen, eintägige Reise, Monatswechsel.
- **Anschluss:** In `useDayThread.ts` in die Ganztags-Karte (`AllDayLane`)
  und in `CalendarView.tsx` neben `birthdaysBetween`; ein Tipp öffnet
  `/run/travel` bzw. `/run/documents`.

### 4. Tag abschliessen
- **Rein:** `features/today/dayClose.ts` — `dayCloseOf(tasks, events, now)`:
  ab 18 Uhr (oder nach dem letzten Termin) `{ open, doneToday, tomorrowFirst }`;
  `null` vorher oder wenn nichts offen ist. Test: Zeitgrenze, nur Heute und
  Überfälliges, erster Termin morgen.
- **Anschluss:** Eine Zeile oben in `DayTasks.tsx`: „3 offen · Alle auf
  morgen“ (über `useTaskActions` und `postpone.ts`, mit „Rückgängig“), darunter
  leise „Morgen: 08:30 Zahnarzt“. Keine neue Seite, kein Formular.

### 5. Erinnerung vor Terminen
- **Rein:** `features/calendar/reminders.ts` — `eventRemindersOf(events, now,
  { max })` im selben `Reminder`-Format wie `features/tasks/reminders.ts`
  (gleiche `reminderInstant`), Vorlauf aus `EventRow.reminderMinutes`
  (`null` = keine; ganztägig = Vortag 18:00). Test wie
  `reminders.test.ts`.
- **Anschluss:** `syncPushReminders` in `features/tasks/pushReminders.ts`
  nimmt beide Listen (gemeinsames Limit 60); im `EventEditor.tsx` eine Zeile
  „Erinnerung“ mit vier Wahlen (keine · pünktlich · 10 Min · 1 Std).
  `expo-notifications` ist in GetBetter schon drin — kein neues Paket; im
  Browser steht wie bei Aufgaben der ehrliche Satz.

## Quellen

- Todoist Ramble (Sprache → Aufgaben, 38 Sprachen): [TechCrunch](https://techcrunch.com/2026/01/21/todoists-app-now-lets-you-add-tasks-to-your-to-do-list-by-speaking-to-its-ai/), [PR Newswire](https://www.prnewswire.com/news-releases/introducing-todoist-ramble-ai-that-turns-natural-speech-into-structured-tasks-302666143.html), [XDA](https://www.xda-developers.com/todoist-ramble/), [Todoist Changelog 2026](https://www.todoist.com/help/articles/2026-changelog-HD3jJAtLd)
- Things 3 vs TickTick: [Nerdynav](https://nerdynav.com/ticktick-vs-things-3/), [ClickUp](https://clickup.com/blog/ticktick-vs-things3/), [Rivva](https://blog.rivva.app/p/todoist-vs-things-vs-ticktick)
- Fantastical (Satz-Eingabe, Openings, Reisezeit): [G2](https://www.g2.com/products/fantastical/reviews), [Morgen](https://www.morgen.so/blog-posts/fantastical-pricing), [Flexibits Release Notes](https://flexibits.com/fantastical/releasenotes)
- Apple Erinnerungen/Kalender iOS 26: [9to5Mac Reminders iOS 26](https://9to5mac.com/2025/10/13/heres-everything-new-in-reminders-with-ios-26/), [Apple Support: Suggested Reminders](https://support.apple.com/en-us/124025), [9to5Mac iOS 26.2](https://9to5mac.com/2026/01/30/ios-26-2s-new-reminders-feature-is-exactly-what-ive-wanted-for-years/), [MacRumors iOS 27](https://www.macrumors.com/guide/ios-27-calendar-reminders/)
- Google Calendar + Gemini: [Workspace Updates](https://workspaceupdates.googleblog.com/2026/01/improved-meeting-suggestions-gemini-calendar.html), [usecarly](https://www.usecarly.com/blog/google-calendar-ai-features/)
- Notion Calendar, Amie, Motion: [Efficient App: Amie](https://efficient.app/apps/amie), [Efficient App: Motion vs Notion Calendar](https://efficient.app/compare/motion-vs-notion-calendar), [Morgen: Motion vs Notion](https://www.morgen.so/blog-posts/motion-vs-notion), [Ellie: Amie Review](https://ellieplanner.com/comparisons/amie-calendar-review)
- Structured: [App Store](https://apps.apple.com/us/app/structured-daily-planner-todo/id1499198946), [Dave Swift](https://daveswift.com/structured/), [Saner](https://blog.saner.ai/structured-review/)
- Sunsama: [Daily Shutdown](https://roadmap.sunsama.com/changelog/daily-shutdown), [Handbuch Daily Planning](https://help.sunsama.com/docs/usage-guides/daily-planning/), [The Business Dive](https://thebusinessdive.com/sunsama-review)
- Apple Notes / Bear: [Atlas: Bear vs Apple Notes](https://www.atlasworkspace.ai/blog/bear-vs-apple-notes), [Fabric](https://fabric.so/comparison/bear-vs-apple-notes)
- Streaks / Habitify: [Habi: Habitify-Alternativen](https://habi.app/insights/habitify-alternatives/), [Habi: Streaks-Alternativen](https://habi.app/insights/streaks-alternatives/)
- Spark / Superhuman: [Spark vs Superhuman](https://sparkmailapp.com/blog/spark-vs-superhuman), [Toolfinder](https://toolfinder.com/comparisons/superhuman-vs-spark-mail)
- TripIt: [Going](https://www.going.com/guides/tripit-review), [TripIt Inbox Sync](https://www.tripit.com/web/blog/news-culture/automate-your-tripit-itineraries-inbox-sync)
