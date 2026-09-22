# Better Fit — 100 Verbesserungen (22.09.2026)

Aus vier Prüfungen (Ernährung, Küche, Training/Coach, Querschnitt), jede am Code
nachgelesen und entdoppelt. Arbeitspakete nach Dateien, damit parallel gearbeitet
werden kann.

**Stand 22.09.2026: alle 100 erledigt** — Typecheck und Lint sauber, 981/981 Tests, im Browser
(BetterGym, 8083) durchgeklickt: Einrichten, „Was passt noch?“, Mahlzeit bearbeiten + Rückgängig,
Heute machen, Satz mit Pausentimer und Scheibenrechner, Training erledigt/wieder öffnen (Minuten
genau einmal), Vorrat erkennen, Fortschritt, Coach-Karten, alles nochmals auf Französisch.

## 0 · Vorbereitung (erledigt)

- ☑ 0.1 `db/fit.ts` aufgeteilt: `fit.ts` (Kern), `fitDiary.ts`, `fitKitchen.ts`, `fitTraining.ts`, `fitEvents.ts`.
- ☑ 0.2 Aenderungen nach Bereich melden (`changedFor('diary'|'kitchen'|'training'|'all')`, `useFit(run, deps, topics)`).
- ☑ 0.3 `useFit`: beim Wechsel der `deps` (anderer Tag) wieder `loading`, nie die Zahlen des Vortags.
- ☑ 0.4 Sprache an den Dienst: App schickt `Accept-Language`, der Server reicht `language` an jeden Handler; `fit/lang.js` (`languageOf`, `pick`, `nameIn`).
- ☑ 0.5 Eigene Textdateien je Paket: `i18n/*-fit4.ts` (Ernährung), `-fit5` (Küche), `-fit6` (Training), `-fit7` (Querschnitt).

## A · Dienst: Sicherheit, Kosten, Robustheit

1. ☑ Tageslimit der Foto-Analyse nach Erstellungstag in Zürich statt nach Mahlzeit-Tag; das zweite Bild zählt mit.
2. ☑ Limit und Monatsbudget vor dem Gemini-Aufruf reservieren (parallele Starts überziehen nicht).
3. ☑ `STORE_ORIGINAL_MEAL_IMAGES` durchsetzen; behaltene Fotos mit Aufbewahrungsfrist aufräumen.
4. ☑ Idempotenz atomar: prüfen, arbeiten und merken ohne Lücke (Doppeltipp legt nie doppelt an).
5. ☑ Kaputte `fit.json` sichern und Schreiben verweigern statt still leer überschreiben.
6. ☑ `sessions.json` atomar schreiben (Temp-Datei + rename).
7. ☑ Passwort-Reset im Admin widerruft alle Sitzungen des Kontos.
8. ☑ Aktions-Argumente bereinigt und in der Grösse begrenzt speichern.
9. ☑ Obergrenzen je Konto für Coach-Nachrichten, Aktionen, Analysen, Ledger; `foodCache` aufräumen.
10. ☑ Sitzungs-Token auf dem Gerät im sicheren Speicher (`expo-secure-store`, `db/tokenStore.native.ts`; ein altes Token aus AsyncStorage zieht um), im Browser wie bisher.
11. ☑ Wertebereiche erzwingen: Gramm-Spannen, `gramsPerPiece`, `activeMinutes`.
12. ☑ Fehlercodes vereinheitlichen (`no_food` 422, geschlossene Analyse 409).
13. ☑ Rückgängig ersetzt die ganze Zeile (exakter Vorzustand).
14. ☑ Abgelaufene Analyse (Foto nach 1 h weg) → `409 analysis_expired` ohne bezahlten Aufruf.
15. ☑ Spanne (min–max kcal) nach Korrektur der Gramm neu rechnen.
16. ☑ Sprache bei `nutrition-label/scan` prüfen.
17. ☑ Tests für `sessions.js`, `dayKind.js`, `toGrams`, `tempImages.js`, `once` und die Punkte 1 und 4.

## B · Ernährung (Tagebuch, Foto, Verpackung, Einrichten)

18. ☑ Mahlzeit nach dem Eintragen bearbeiten: Gramm je Zeile, Mahlzeit wechseln, Zeile entfernen.
19. ☑ PATCH einer Mahlzeit prüft grosse Portionen wie POST und passt den Namen an.
20. ☑ Foto: falsche Zutat entfernen, ersetzen, fehlende hinzufügen (über die Suche).
21. ☑ Foto: grosse Portion → „Trotzdem eintragen“ statt Sackgasse.
22. ☑ Foto: Spanne im Blatt live aus den geänderten Gramm.
23. ☑ Suchverlauf wirkt: Begriff speichern, normalisiert zählen — Häufiges steht oben.
24. ☑ Lebensmittelnamen in der Sprache der Person (Suche, Tagebuch, Barcode, Foto).
25. ☑ Ballaststoffe, Zucker, Salz speichern und je Tag summieren; Ballaststoffe im Kopf.
26. ☑ Unbekannter Barcode: „Werte selbst eingeben“; Duplikat-Prüfung wirklich nutzen.
27. ☑ Mehrere Lebensmittel in einer Mahlzeit sammeln und einmal eintragen.
28. ☑ Leere Suche zeigt „Zuletzt gegessen“ mit der letzten Menge (ein Tipp).
29. ☑ Doppel-Tipp sperren, Schlüssel je Absicht stabil (Wie immer, Plan, Rezept).
30. ☑ Fehler beim Eintragen sichtbar machen statt still.
31. ☑ Einheitliche Rückmeldung „… eingetragen · Rückgängig“ auf allen Wegen.
32. ☑ `ChoiceTile` als Knopf vorlesen (nicht als Optionsfeld), mit Beschäftigt-Zustand.
33. ☑ `FitState`: bei vorhandenen Daten nur ein schmales „Nochmal versuchen“ statt alles zu verdecken.
34. ☑ Wochentage im Plan-Schritt ändern auch das Profil (kcal-Verteilung stimmt).
35. ☑ Wettlauf beim Umplanen der Wochentage: nur die letzte Antwort zählt.
36. ☑ „Wie gestern“: Mahlzeit oder Tag von gestern mit einem Tipp übernehmen.
37. ☑ Trinken auch für vergangene Tage nachtragen, mit Rückgängig.
38. ☑ Neues Gewicht passt die Ziele an (Grundumsatz, Eiweiss).
39. ☑ Tagesband exakt: Lücken verschieben den Zielstrich nicht mehr.
40. ☑ Suchfehler richtig benennen (nicht immer „offline“).
41. ☑ „Welche Mahlzeit ist dran“ nach Zürcher Zeit.
42. ☑ Neu: Serie — Tage in Folge mit Einträgen, im Kopf der Ernährung.
43. ☑ Neu: „Was passt noch?“ — Vorschläge für die restlichen Makros direkt in der Ernährung.
44. ☑ Dateien unter 500 Zeilen: `routes/diary.js`, `FitOnboarding.tsx`, `NutritionView.tsx` teilen.
45. ☑ Einheiten und Zahlen über `t()`/`Intl` (g, kcal) in den Ernährungs-Dateien.

## C · Küche (Vorrat, Rezepte, Wochenplan, Einkauf)

46. ☑ Handposten der Einkaufsliste gehen beim Aktualisieren nicht mehr verloren.
47. ☑ „Liste veraltet“ verschwindet, wenn sich nichts geändert hat.
48. ☑ Rezept ersetzen/auslassen: Portionen neu rechnen, Reste-Einträge lösen.
49. ☑ Optionale Zutaten: Kalorien und Vorratsabzug zählen dasselbe.
50. ☑ Bibliotheksrezept nicht mehrfach speichern (`basedOn`).
51. ☑ Doppelte Vorratszeilen im selben Vorschlag zusammenführen.
52. ☑ Bekannte Vorratsmenge bleibt, wenn nur der Name kommt.
53. ☑ Vorratsabzug über mehrere Zeilen verteilen, roh/gekocht umrechnen.
54. ☑ Nicht erkannte Wörter und Fehler im Vorrat anzeigen.
55. ☑ Mengen-Erkennung: „500g“, EL/TL/Prise/Dose/Becher/Bund, „½“, „6x“.
56. ☑ Ablaufdatum erfassen, „Bald ablaufen“ oben, nach Datum sortiert.
57. ☑ Vorratsmengen in ihrer Einheit (Stück bleiben Stück), Menge direkt ändern.
58. ☑ Eingekauftes gesammelt in den Vorrat (ein Vorschlag statt vieler).
59. ☑ Mengenfeld der Einkaufsliste: nur einmal speichern, Fehler zeigen, `Intl`.
60. ☑ Handposten mit Menge, Abteilung und Lebensmittel („2 Bananen“ → Früchte).
61. ☑ Erledigtes unten unter „im Korb“ wie in BetterFamily; Reihenfolge aus dem Kern.
62. ☑ Übergabe an BetterFamily: kein Doppeltes, Mengen zusammenführen, nur was fehlt, Rückmeldung.
63. ☑ Wochenplan: Fehler zeigen, Auslassen zurücknehmen, Woche wechseln.
64. ☑ Ersetzen: nur erlaubte, entdoppelte Rezepte mit kcal.
65. ☑ Verschieben auch in eine andere Mahlzeit; Reste nie vor dem Kochen.
66. ☑ Rezept: Portionen skalieren die Zutatenliste; Fehler beim Bearbeiten zeigen.
67. ☑ Bibliotheksrezept direkt „Gekocht & gegessen“.
68. ☑ Rezepte suchen und nach Tags filtern; gespeicherte nicht doppelt.
69. ☑ Neu: Favoriten (Stern) für Rezepte, oben sortiert.
70. ☑ Neu: Kochmodus — ein Schritt je Seite, Minuten im Text starten einen Timer.
71. ☑ Vorschlag zeigt „zu wenig“ und „läuft bald ab“; Plan-Toleranz nicht nur als Farbe.
72. ☑ Rezepttitel, Schritte und Lebensmittelnamen der Küche in DE/FR/IT/EN.

## D · Training, Fortschritt, Coach

73. ☑ „Wieder öffnen“ zählt Minuten nicht doppelt (eine `workouts`-Zeile je Training).
74. ☑ Statuswechsel und Sätze prüfen (nur geplant; ohne Satz nicht abschliessen).
75. ☑ Neuer Plan löscht kein angefangenes Training.
76. ☑ Verschieben mit Sätzen verweigern oder die Sätze mitnehmen.
77. ☑ Zukünftiges Training starten → „Heute machen“ verschiebt es zuerst.
78. ☑ Körpergewichtsübungen: kein „0 kg“, Ziel +1 Wiederholung, Rekord nach Wiederholungen.
79. ☑ Pausentimer fest unten, mm:ss, +30 s/Überspringen, Vibration am Ende, vorgelesen.
80. ☑ „Letztes Mal: 60 kg × 8 · 8 · 7“, Wiederholungen vorbelegt, „Wie letztes Mal“.
81. ☑ Aufwärmsätze als Aufwärmen eintragen und getrennt zählen.
82. ☑ Zeitübungen (Unterarmstütz) in Sekunden.
83. ☑ Steigerung: Rückschritt nach zwei verfehlten Einheiten, +5 kg nur bei grossen Übungen, RIR ohne Vorwahl, Deload jede 5. Woche.
84. ☑ Plan läuft weiter (verlängert sich selbst), statt nach 4 Wochen still zu enden.
85. ☑ Verpasste Trainings: „Heute nachholen“ oder „Auslassen“.
86. ☑ Verlauf der Trainings mit Monatsstreifen.
87. ☑ „Neuer Rekord!“ im Training mit kleiner Feier.
88. ☑ Volumen je Muskelgruppe und Woche (Mo–So) mit Wochenrückblick.
89. ☑ Gewicht an einer Stelle: Startseite liest Better Fit, „Werte → Gewicht“ schreibt dorthin.
90. ☑ Tagesgrenze überall Zürich, Wechsel um Mitternacht.
91. ☑ Coach: „Ich habe 80 kg gedrückt“ ist kein Körpergewicht.
92. ☑ Coach: „Verschieb Freitag auf Samstag“ nimmt den richtigen Tag; Wortgrenzen.
93. ☑ Coach: Training auslassen, Rekorde abfragen, tägliche Hinweiskarte.
94. ☑ Coach: Nachricht bleibt bei Fehler im Feld, ehrlicher Grund mit „Abo ansehen“, scrollt ans Ende.
95. ☑ Übungen, Anleitungen, Vorlagen und Einheiten in DE/FR/IT/EN.
96. ☑ Zahlen über `Intl` (62,5 kg auf Französisch), Vorzeichen beim Trend.
97. ☑ Bedienungshilfe: RIR-Chips, Zeilen mit Tag/Status, Trinkbalken; Satz löschen mit Rückgängig.
98. ☑ Neu: Scheibenrechner — welche Scheiben je Seite auf die Langhantel.
99. ☑ Neu: geschätztes Maximum (1RM) je Übung im Fortschritt.

## E · Querschnitt

100. ☑ Doppelter Schlüssel `fit.add.search` aufgelöst; Test gegen doppelte Schlüssel über Teildateien.

## F · Beim Prüfen im Browser dazugekommen

- ☑ Häkchen-Zeilen in Better Fit mit vorlesbarem Namen und `aria-checked` (react-native-web 0.21 übersetzt `accessibilityState` nicht mehr; der Rest der App ist eine eigene Aufgabe).
- ☑ Sprache: `setFitLanguage` im Layout-Effekt, sonst ging die erste Abfrage auf Deutsch hinaus; ein Sprachwechsel lädt alle Fit-Ansichten neu.
- ☑ „1 Training, 1 Satz“ statt „1 Trainings, 1 Sätze“ (Fortschritt, vier Sprachen).
- ☑ Unsicher erkannte Vorratszeilen („Zauberpulver“ → Kakaopulver) sind nicht mehr vorab abgehakt.
- ☑ Erstes Training: Wiederholungen mit dem unteren Ende des Bereichs vorbelegt.
- ☑ Vorschau „Training auslassen“ in der Aktionskarte (Zeile und Ergebnis).
- ☑ Foto bestätigen, Küche und Training rechnen mit dem neusten Gewicht (`goalsOf`) und in der Sprache der Person; Trainingstitel in der Tagesübersicht übersetzt.
- ☑ Wackeltest `speech/service.test.js` („Proben“, „Abo über dem Budget“) wartet jetzt auf die geschriebene Datei.

## Offen für den Eigentümer

- **Lebensmittelnamen auf FR/IT/EN:** Der Code ist bereit, aber die eingelesene Schweizer
  Nährwertdatenbank enthält nur Deutsch. Die französische, italienische und englische Datei von
  https://naehrwertdaten.ch/de/downloads/ laden und neu importieren:
  `node scripts/import-swiss-foods.js <de.xlsx> --version 7.1 --fr <fr.xlsx> --it <it.xlsx> --en <en.xlsx>`.
- Auf echten Telefonen testen: Kamera, Scanner, Vibration und der sichere Token-Speicher brauchen Expo Go oder einen Dev-Build.
- Packungsgrössen im Vorrat (Dose 400 g, Becher 180 g, Bund 40 g) sind Schätzwerte.
