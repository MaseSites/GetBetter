# BetterGym (ohne Ernährung) und BetterAi gegen den Rest (25.09.2026)

Ergänzt [../better-fit-konkurrenz.md](../better-fit-konkurrenz.md) und
[../better-fit-100.md](../better-fit-100.md). Ernährung, Küche, Progression,
Studio-Idee, Barcode und Apple Health für Better Fit stehen dort und werden hier
nicht wiederholt. Hier: **Schlaf, Medikamente, Werte, Kopf frei, Trinken, der
Rest vom Training, BetterAi und der Assistent.**

Stand des Codes am 25.09.2026 nachgelesen. Was die Konkurrenz kann, stammt aus
ihren eigenen Seiten, Stores und Tests; Werbeseiten anderer Apps sind als solche
gewertet.

## Was es bei uns wirklich gibt

| Bereich | Was da ist | Wo |
| --- | --- | --- |
| Training | Better Fit: Plan, Sätze, Pausentimer, Rekorde, 1RM, Volumen je Muskel, Wochenrückblick, Verlauf mit Monatsstreifen | `features/fit/*Training*`, `ProgressTraining.tsx` |
| Schlaf | Bett/aufgestanden, Qualität 1–3, Schnitt 7 Nächte, **Tipp aus dem Kalender** (erster Termin morgen − 9 h) | `features/gym/SleepView.tsx`, `db/health.ts` |
| Medikamente | Einnahmezeiten (morgens/mittags/abends/nachts) als Chips, Vorrat zählt mit, „Nachschub“ unter 5 Stück | `features/gym/MedsView.tsx` |
| Werte | Gewicht (→ Better Fit), Blutdruck, Puls; letzter Wert, Unterschied, zehn Balken | `features/gym/VitalsView.tsx` |
| Kopf frei | Laune 1–5 + ein Satz je Tag, Verlauf, Atemübung 4-7-8 | `features/gym/MindView.tsx` |
| Trinken | 2.5/5 dl, Balken, Ziel aus Better Fit (35 ml/kg, Trainingstag +0.5 l), Rückgängig, Nachtragen | `features/gym/WaterView.tsx`, `features/fit/WaterCard.tsx` |
| BetterAi | Gesprächsliste (Neuestes zuerst, Vorschau), wischen zum Löschen, Anfang-Chips, KI über den eigenen Dienst mit Stufen-Router | `features/ai/ChatsView.tsx`, `AiChatView.tsx`, `db/chats.ts` |
| Assistent | bedient die App: in BetterGym `log_water`, `log_meal`, `log_workout`, öffnen, hell/dunkel; Kontext mit kcal, dl, Minuten, letzter Nacht | `services/api/ai/tools.js`, `features/assistant/useAssistantContext.ts` |

**Nicht da:** Erinnerungen in BetterGym (Mitteilungen gibt es nur in GetBetter
für Aufgaben), Schlafschuld, Regelmässigkeit, Einordnung von Blutdruck,
Zusammenhänge zwischen Laune und Rest, Kalender-/Pixelansicht der Laune,
Suche/Umbenennen/Anheften in BetterAi, Gedächtnis, Anhänge in BetterAi (der
Router kennt `vision_model`, die Oberfläche nicht), Assistent-Funktionen für
Schlaf, Medikamente, Laune und Werte, Widgets, Apple Health / Health Connect.

## (a) Wo wir schon besser sind

1. **Alles schaut aufeinander, ohne Verbindung einzurichten.** Die grossen
   Einzel-Apps sind Inseln: Rise und How We Feel brauchen Apple Health, um
   Schlaf oder Bewegung überhaupt zu sehen ([How We Feel](https://apps.apple.com/us/app/how-we-feel/id1562706384));
   Daylio kennt nur, was man von Hand als Aktivität antippt
   ([Daylio-Statistik](https://daylio.net/faq/activity-and-mood-statistics/)).
   Bei uns liegen Training, Essen, Trinken, Schlaf, Laune, Medikamente **und der
   Kalender** in derselben Datenbank. Das nutzen wir erst an zwei Stellen
   (Trinkziel am Trainingstag, Schlaftipp aus dem Kalender) — das ist der
   grösste ungenutzte Hebel der ganzen App.
2. **Schlaftipp aus dem echten Kalender.** Rise hat eine Kalender-Anbindung,
   aber für die Energiekurve ([Rise](https://www.risescience.com/)); Oura
   rechnet die Bettzeit aus Ringdaten ([Oura Bedtime Guidance](https://support.ouraring.com/hc/en-us/articles/360025445154-Bedtime-Guidance)).
   „Morgen 7:30 Zahnarzt → heute um 22:15 ins Bett“ ohne Wearable hat keiner.
3. **Der Assistent trägt ein, statt nur zu plaudern.** ChatGPT, Claude,
   Gemini haben Gedächtnis und Projekte, aber sie schreiben nichts in eine
   Trink- oder Trainingsliste. Unser „die KI versteht, die App prüft und
   handelt“ (`vet.ts`, `runActions.ts`) ist das, was Gemini mit Google-Apps
   versucht — nur für die eigenen Daten und mit Rückgängig.
4. **Ein Training zählt überall.** Better Fit schreibt `workouts`, daraus lesen
   Woche, Profil, GetBetter-Karte und Trinkziel. Hevy/Strong müssen dafür nach
   Apple Health exportieren.
5. **Einrichten in Sekunden.** Medisafe, Rise, Oura und How We Feel beginnen
   mit Fragebögen oder Kopplung; bei uns ist jede Gesundheitsfunktion ein
   Plus-Knopf ohne Vorbereitung.
6. **Kein Streak-Druck, keine Werbung, vier Sprachen.** Finch-Nutzer loben die
   Serien und klagen zugleich über den Druck, den sie machen
   ([aidorable, Finch-Review](https://www.aidorable.ai/blog/finch-app-reviews)).
   Wir haben die Freiheit, Konstanz zu zeigen, ohne zu bestrafen.

## (b) Die 10 wichtigsten Lücken, nach Wirkung ÷ Aufwand

| # | Lücke | Wer es hat | Warum es zählt | Aufwand | Wo bei uns |
| - | --- | --- | --- | --- | --- |
| 1 | **Zusammenhänge der Laune** („An Tagen mit Training: Laune 4.1, sonst 3.3“, „nach < 6 h Schlaf: 2.8“) | Daylio (Aktivitäten ↔ Laune), How We Feel (über HealthKit) | Daylios meistgelobte Funktion. Wir haben die Daten schon, Daylio muss sie von Hand erfragen. Genau „alle Funktionen schauen aufeinander“ | klein: reine Funktion + Karte | neu `features/gym/moodInsights.ts`, `MindView.tsx` |
| 2 | **Schlafschuld und Regelmässigkeit** (14 Nächte, jüngere zählen mehr; Streuung der Bettzeit) | Rise (Schlafschuld 14 Nächte, letzte Nacht ~15 %), Oura (Regularity), AutoSleep | Macht aus einer Liste eine Aussage. Rises ganzes Produkt ist diese Zahl, für 60 USD/Jahr | klein | `db/pure.ts` (neben `sleepMinutes`), `SleepView.tsx`, `HealthPanels.tsx` |
| 3 | **Assistent-Funktionen für Gesundheit**: `log_sleep`, `take_med`, `log_mood`, `log_vital` | keiner so — Apple Health loggt per Siri nur Medikamente | „Hab gut 7 Stunden geschlafen“, „Tablette genommen“, „Blutdruck 128 zu 82“ — das Häufigste ohne Tippen. Weg ist gebaut, nur die Funktionen fehlen | mittel (Dienst + App + Test gleich halten) | `services/api/ai/tools.js`, `features/assistant/actions.ts`, `runActions.ts`, `understand.ts`, `test/assistant-tools.test.js` |
| 4 | **Erinnerungen für Medikamente** (+ Nachfassen nach 30 min, „Ausgelassen“) | Medisafe, Apple Health Medikamente | Ohne Erinnerung ist eine Medikamenten-Liste nur ein Protokoll. Einzige Funktion, bei der Vergessen schadet | mittel: `expo-notifications` ist im Arbeitsbereich schon da (GetBetter), in BetterGym ins `app.json` + neuer Store-Bau | `features/gym/MedsView.tsx`, Muster `features/tasks/reminders.ts` + `pushReminders.ts`, `apps/bettergym/app.json` |
| 5 | **Blutdruck einordnen + Arztbericht** (Mittel je Woche, Tabelle zum Teilen) | Withings (PDF-Bericht, CSV), Apple Health | Blutdruck wird für den Arzt gemessen; Withings-Nutzer beschweren sich, wenn sie keine Liste bekommen | klein (Einordnung), mittel (Bericht über Teilen-Dialog) | `VitalsView.tsx`, neu `features/gym/bloodPressure.ts` |
| 6 | **BetterAi: Suche, Umbenennen, Anheften** | ChatGPT (Suche, Anheften, Umbenennen, Archiv), Claude, Le Chat | Ab 20 Gesprächen ist die Liste ohne Suche wertlos. Standard in jeder KI-App | klein | `db/chats.ts` (`pinnedAt`, `rename`), `ChatsView.tsx` |
| 7 | **BetterAi: „Über mich“ / Gedächtnis** | ChatGPT, Claude (seit 03/2026 gratis), Le Chat (gratis), Gemini | Heute weiss BetterAi in jedem Gespräch nichts. Eine sichtbare, selbst geschriebene Notiz „Über mich“ ist die ehrliche, günstige Fassung (Claude sagt offen, wann es sich erinnert — das ist die richtige Haltung) | klein–mittel: Feld am Konto + Systemtext im Dienst | `features/ai/`, `services/api/ai/` (Systemtext), `SettingsScreen.tsx` |
| 8 | **Wochenrückblick Gesundheit** (Sonntag: Schlafschnitt, Trainings, Laune, Medi-Treue, Trinkziel-Tage) | Hevy Monatsbericht, Oura, Plant Nanny Monatsvergleich | Better Fit hat den Trainingsrückblick; Schlaf/Laune/Medis fehlen darin. Ein Blatt statt fünf Bildschirme | mittel | neu `features/gym/weekReview.ts`, Startseite BetterGym |
| 9 | **Laune als Kalender / Jahr in Pixeln**, dazu Trainingskalender-Heatmap | Daylio („Year in Pixels“), Hevy (Kalender + Wochenserie) | Das meistgeteilte Bild dieser Apps; zeigt Konstanz ohne Streak-Druck | klein–mittel | `MindView.tsx`, `features/fit/TrainingHistory.tsx` |
| 10 | **BetterAi: Foto/Datei anhängen** | ChatGPT, Claude, Gemini, Le Chat | Router hat die Stufe `vision_model`, nur die Oberfläche fehlt. Aber: Groq kann keine Bilder, ohne Abo `plan_required` — erst mit Safe Swiss Cloud sinnvoll | mittel (`expo-image-picker` ist schon da) | `AiChatView.tsx`, `db/ai.ts` |

**Bewusst nicht in der Liste** (hohe Wirkung, aber gross oder nativ):
Apple Health / Health Connect (steht schon als Punkt 2 in
`better-fit-konkurrenz.md`, gilt dann auch für Schlaf, Gewicht, Blutdruck,
Trinken), Widgets (WaterMinder, Plant Nanny, Finch leben davon — braucht
native Erweiterung je Plattform), Watch, Schlaftracking per Sensor (Sleep
Cycle, AutoSleep — nicht unser Spiel), Wechselwirkungs-Prüfung von
Medikamenten (Apple hat eine Datenbank; ohne geprüfte Quelle nicht anbieten),
Sprachmodus in BetterAi (Stimme gibt es im Assistenten; für BetterAi erst,
wenn Kosten je Konto das tragen).

**Trinken** ist gut genug: WaterMinder hat Getränkefaktoren (Kaffee zählt
weniger), Plant Nanny die Pflanze als Motivation und Erinnerungen. Eine Zeile
„Kaffee / Tee“ mit Faktor wäre nett, aber nicht unter den ersten zehn.

**Training** ausserhalb von Better Fit: Hevy lebt von Monatsbericht,
Wochenserie und Muskel-Heatmap; Ladder von Coaches und Team-Gefühl
(Women's Health 2026 „Best Overall“). Better Fit hat Wochenrückblick und
Volumen je Muskel; es fehlen die Wochenserie (Lücke 9) und alles Soziale —
Letzteres widerspricht dem Leitsatz nicht, ist aber gross.

## (c) Schnelle Gewinne — je wenige Stunden, kein neues natives Paket

Jeder als **reine Funktion mit Test** plus eine Zeile Oberfläche, Texte in vier
Sprachen.

1. **Schlafschuld und Regelmässigkeit** — `sleepDebtOf(rows, needMinutes = 480)`
   und `regularityOf(rows)` in `db/pure.ts` (dort liegt `sleepMinutes`, schon
   unter Test). Schuld = Summe (Bedarf − Schlaf) über 14 Nächte, jüngere
   schwerer gewichtet; Regelmässigkeit = Streuung der Bettzeit in Minuten
   (über Mitternacht rechnen!). In `SleepView.tsx` unter dem Schnitt:
   „Schlafschuld 3 Std. 10 Min. · Bettzeit schwankt um 50 Min.“ Mit dem
   Kalendertipp zusammen: „Heute 22:15 ins Bett holt 45 Min. auf.“
2. **Laune ↔ Schlaf/Training/Trinken** — `moodInsightsOf(moods, sleeps,
   workoutDays, waterDays)` in `features/gym/moodInsights.ts`: je Faktor
   Mittel mit/ohne, nur ab je 5 Tagen und einem Unterschied ≥ 0.5, höchstens
   zwei Sätze. Karte „Was dir guttut“ in `MindView.tsx`. Kein Daylio-Nutzer
   bekommt das ohne Handarbeit.
3. **Blutdruck einordnen** — `bpCategoryOf(sys, dia)` nach ESC 2024
   (nicht erhöht < 120/70, erhöht 120–139/70–89, Hypertonie ≥ 140/90;
   [ESC 2024](https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/elevated-blood-pressure-and-hypertension/),
   [ACC-Zusammenfassung](https://www.acc.org/latest-in-cardiology/ten-points-to-remember/2024/09/05/14/11/2024-esc-guidelines-for-bp-esc-2024)),
   dazu Mittel der letzten 7 Messungen. In `VitalsView.tsx` als Wort mit Form
   (nicht nur Farbe) und dem Satz „Eine Einordnung, keine Diagnose“. Die höhere
   Kategorie von systolisch/diastolisch zählt.
4. **Medikamente: „Alle genommen“ und Reichweite in Tagen** — `daysLeftOf(med)`
   = `stock / slots.length` in einer kleinen Datei neben `MedsView.tsx`;
   „Nachschub“ ab ≤ 7 Tagen statt ≤ 5 Stück (Medisafe erinnert typisch 10 Tage
   vorher). Ein Knopf „Alle genommen“ für die aktuelle Tageszeit (Apple:
   „Log All as Taken“) über das bestehende `meds.toggle`, mit Rückgängig.
5. **BetterAi: Suchen und Anheften** — `filterChats(chats, latest, query)` und
   Sortierung „Angeheftet zuerst“ als reine Funktion in `db/pure.ts` (wie
   `chatTitleOf`), Feld `pinnedAt` an `ChatRow`, `chats.setPinned`.
   Suchfeld über der Liste ab 6 Gesprächen, Anheften per Wisch nach rechts
   (`SwipeRow` kann das schon).

Danach, nicht mehr „wenige Stunden“: Lücke 3 (Assistent-Funktionen für
Gesundheit) — der grösste Hebel für „ein Plus für das Häufigste“, weil jeder
Eintrag ein Satz wird.

## Quellen

- Rise: [risescience.com](https://www.risescience.com/), [Schlafschuld erklärt](https://www.risescience.com/blog/best-sleep-debt-tracking-app), [Review 2026](https://www.mattressclarity.com/accessories/rise-app-review/)
- Oura: [Bedtime Guidance](https://support.ouraring.com/hc/en-us/articles/360025445154-Bedtime-Guidance), [Cumulative Stress (TechCrunch, 20.10.2025)](https://techcrunch.com/2025/10/20/oura-launches-redesigned-app-and-cumulative-stress-feature/)
- AutoSleep / Sleep Cycle: [health-tech-reviews, 2026](https://health-tech-reviews.com/best-sleep-apps/), [AutoSleep App Store](https://apps.apple.com/us/app/autosleep-watch-sleep-tracker/id1164801111)
- Medisafe: [Funktionen](https://medisafeapp.com/features/), [Review](https://www.minimalistjourneys.com/medisafe-app-review/)
- Apple Health Medikamente: [Apple Support](https://support.apple.com/en-us/105064), [TidBITS](https://tidbits.com/2022/10/07/an-apple-a-day-ios-16-medications-feature-provides-alerts-logging-and-peace-of-mind/)
- Withings: [Bericht an den Arzt](https://support.withings.com/hc/en-us/articles/360004485358-Health-Mate-iOS-App-Sharing-my-Health-Report), [Klage über fehlende Liste](https://support.withings.com/hc/en-us/community/posts/4406678425105-Lack-of-exportable-list-of-readings-is-unacceptable-and-makes-product-useless)
- Blutdruck: [ESC 2024 Leitlinie](https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/elevated-blood-pressure-and-hypertension/), [ACC Key Points](https://www.acc.org/latest-in-cardiology/ten-points-to-remember/2024/09/05/14/11/2024-esc-guidelines-for-bp-esc-2024)
- Daylio: [Statistik](https://daylio.net/faq/activity-and-mood-statistics/), [Review 2026](https://www.reflection.app/journaling-apps/daylio)
- How We Feel: [App Store](https://apps.apple.com/us/app/how-we-feel/id1562706384)
- Finch: [Review 2026](https://www.aidorable.ai/blog/finch-app-reviews), [finchcare.com](https://finchcare.com/about-finch)
- Trinken: [WaterMinder](https://blog.waterminder.com/tips/never-forget-to-drink-water-again-best-water-reminder-app-for-ios/), [Plant Nanny](https://sparkful.app/plant-nanny), [Vergleich 2026 (Suu, selbst Anbieter)](https://suuapp.com/blog/en/best-water-tracking-app.html)
- Hevy: [Monatsbericht](https://www.hevyapp.com/features/monthly-report/), [Kalender und Serie](https://www.hevyapp.com/features/gym-consistency/)
- Ladder: [Garage Gym Reviews 2026](https://www.garagegymreviews.com/ladder-app-review)
- ChatGPT: [Release Notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes), [Funktionen 2026](https://suprmind.ai/hub/chatgpt/features/)
- Claude/ChatGPT/Gemini Gedächtnis: [Notebookcheck-Vergleich](https://www.notebookcheck.net/AI-that-remembers-ChatGPT-Gemini-and-Claude-compared.1336513.0.html)
- Le Chat: [Mistral: Connectors und Memories](https://mistral.ai/news/le-chat-mcp-connectors-memories/)
