# BetterMoney und die Konkurrenz

Stand: 25.09.2026. Recherche zu Budget, Rechnungen, Abos und Sparzielen, alles in CHF.
Es wurde kein Code geändert.

## 1. Was es bei uns wirklich gibt

Nachgeschaut in `packages/core/src/db/money.ts`, `db/types.ts` (Zeilen `ExpenseRow` bis
`SavingsGoalRow`) und `packages/core/src/features/money/`:

| Modul | Daten | Was geht | Was fehlt im Datenmodell |
| --- | --- | --- | --- |
| **Budget** (`BudgetView.tsx`) | `expenses` {day, amountChf, category, note}, `budgets` {month, limitChf} | Ausgabe mit sechs Kategorien (food, home, transport, fun, health, other), Monatssumme, **ein** Monatsbudget mit Balken, Aufteilung nach Kategorie, Monat wischen | Einnahmen, Budget je Kategorie, Wiederholung |
| **Rechnungen** (`BillsView.tsx`) | `bills` {title, amountChf, dueDay, paidAt} | Fälligkeit per Chip (heute/7/14/30 Tage), antippen = bezahlt, bezahlte darunter | IBAN, Referenz, Empfänger, Wiederholung, Notiz |
| **Abos** (`SubscriptionsView.tsx`) | `subscriptions` {name, amountChf, interval month/year} | Summe pro Monat und Jahr (Jahresabos anteilig) | **Datum der nächsten Abbuchung**, Kündigungsfrist, Kategorie |
| **Sparziele** (`SavingsView.tsx`) | `savingsGoals` {name, targetChf, savedChf} | Ziel, Balken, Chips zum Einzahlen, nie über das Ziel | Zieldatum, Monatsrate, Auszahlung |

Verknüpft ist schon:
- Offene Rechnungen stehen am Fälligkeitstag im **Tagesband von GetBetter** und lassen sich
  dort abhaken (`features/today/useDayThread.ts`, Zeilen 204–217).
- Die **Startseite von BetterMoney** (`screens/MoneyHomeScreen.tsx`) zeigt Monatssumme und die
  nächsten Rechnungen, die **AppFamily-Karte in GetBetter** Monatssumme und offene Rechnungen.
- Der **Assistent** kann `add_expense` und `add_bill` (`services/api/ai/tools.js`). Ohne KI liest
  `features/assistant/understand.ts` Sätze wie „12 Fr. für Migros ausgegeben“ und rät die
  Kategorie aus Händlernamen (Migros, Coop, SBB, Apotheke …).
- Rechnungen fliessen in die Suche (`features/search/useSearchCandidates.ts`) und in die Liste
  des Assistenten (`features/assistant/context.ts`).

Nicht verknüpft: Abos erscheinen weder im Kalender noch im Tagesband (sie haben kein Datum),
Abos zählen nicht ins Budget, Sparziele wissen nichts von Fristen.

## 2. Die Konkurrenz kurz

| App | Was Nutzer lieben | Was nervt |
| --- | --- | --- |
| **YNAB** | Die Methode (jeder Franken bekommt eine Aufgabe) ändert das Verhalten | USD 109/Jahr, kein Gratis-Plan, **keine Abo-Verwaltung**, keine Schweizer Bankanbindung |
| **Monarch Money** | Haushalts-Übersicht, zu zweit nutzbar, viele Konten | Nur Abo, USA-zentriert |
| **Copilot Money** | Schönste Oberfläche, beste automatische Kategorien | Nur Apple, nur Abo |
| **Rocket Money** | Findet und kündigt Abos | Viele Beschwerden: Gebühren für „Verhandeln“ (35–60 % der Ersparnis), schwer kündbar; Trustpilot ~3.3/5 |
| **Finanzguru** (DE) | Verträge erkennen, mit einem Tipp kündigen | Vertragserkennung oft falsch, aufdringliche Versicherungs-Empfehlungen, die sich nicht dauerhaft ausblenden lassen |
| **Cashew** | Gratis, schnell, eigene Buchungsarten „bevorstehend“, „Abo“, „wiederholt“, „geliehen/verliehen“, Budget je Kategorie, eigene Zeiträume | Viele Einstellungen, eher für Tüftler |
| **Money Manager / Spendee / Wallet (BudgetBakers)** | Schnelle Handeingabe, Diagramme, geteilte Wallets | Werbung, Bankanbindung kostet, Schweiz schwach abgedeckt |
| **Splitwise / Tricount** | Geteiltes Geld in WG, Ferien, Paar | Splitwise hat seit 2023 ein Tageslimit gratis (2–4 Ausgaben), Trustpilot 1.8/5; Tricount ohne Limit |
| **PostFinance App** „Meine Analysen“ | Budget je Kategorie **und Label** mit Warnung kurz vor dem Limit, Abos mit Durchschnittsbetrag | Nur PostFinance-Konten |
| **neon / Yuh / Revolut** | „Spaces“/Töpfe für Sparziele, Ausgaben nach Kategorie automatisch | Nur das eigene Konto, kein Rechnungs-Überblick über alles |
| **BudgetCH** (Budgetberatung Schweiz) | Vorlagen und Richtwerte aus Schweizer Lebenshaltungskosten | Eher Planungsblatt als Alltag |
| **BlueBudget / Liquid** | Multibanking über **bLink** (SIX), 50+ Schweizer Banken | Anbindung braucht Vertrag und Zulassung bei SIX und der Bank |
| **eBill** (3.8 Mio. Nutzer in der Schweiz) | Rechnungen direkt ins E-Banking, **Dauerfreigabe** bei gleichem Betrag | Lebt nur im E-Banking, kein Budget-Bezug |

Schweizer Eigenheiten, die keine der ausländischen Apps abdeckt:
- **QR-Rechnung**: jede Papier- und PDF-Rechnung trägt einen Swiss QR Code mit Empfänger,
  IBAN, Betrag, Referenz und oft Rechnungsdatum und Zahlungsfrist (`/11/`, `/40/0:30`).
  Banken-Apps scannen ihn nur zum Zahlen, nicht fürs Budget.
- **Krankenkassenprämie**: 2026 im Mittel CHF 393.30 im Monat (+4.4 %); die Prämien fürs
  nächste Jahr kommen Ende September, gewechselt wird bis 30. November.
- **Steuern** kommen einmal oder in Raten — die Budgetberatung rät, sie monatlich als Fixkosten
  zurückzulegen.
- **Säule 3a**: 2026 höchstens CHF 7'258 (mit Pensionskasse), Einzahlung bis 31.12.; ab 2026
  sind Nachzahlungen für Lücken ab 2025 möglich.
- **Richtwerte** (Budgetberatung Schweiz): Miete höchstens rund ein Drittel des Einkommens,
  Fixkosten oft die Hälfte, etwa 20 % sparen.

## 3. Wo wir schon besser sind

1. **Alles hängt zusammen.** Eine Rechnung steht ohne Zutun am Fälligkeitstag im Tagesband von
   GetBetter und lässt sich dort bezahlt abhaken. Keine der Budget-Apps hat einen Tagesplan, in
   dem Geld neben Terminen und Aufgaben steht.
2. **Per Satz eintragen.** „12 Fr. für Migros ausgegeben“ legt die Ausgabe mit Kategorie an —
   im Assistenten, ohne Formular, auf Deutsch mit Schweizer Wörtern („Stutz“, „Znacht“, „SBB“).
   Cashew, YNAB oder Money Manager haben das nicht.
3. **Gratis und ohne Tageslimit.** Alle vier Module sind ohne Abo voll nutzbar (BetterMoney hat
   noch keinen Preis). YNAB, Monarch und Copilot kosten ab dem ersten Tag, Splitwise bremst
   gratis.
4. **Keine Bankanbindung, keine Werbung, keine Verkaufsempfehlungen.** Genau das, was an
   Finanzguru und Rocket Money am meisten stört, gibt es bei uns nicht.
5. **Rappen-genau und CHF zuerst.** Komma und Punkt, Rappen gerundet (`features/money/amount.ts`,
   getestet), vier Landessprachen.
6. **Einfach.** Eine Ausgabe braucht zwei Eingaben und einen Tipp; Rechnungen bezahlt man mit
   einem Tipp oder Wisch, mit Rückgängig.

## 4. Die 10 wichtigsten Lücken — nach Wirkung ÷ Aufwand

Wirkung und Aufwand je 1–5 (5 = gross). Sortiert nach dem Verhältnis.

| # | Lücke | Wer es hat | Warum es zählt | Wo bei uns | W | A |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Nächste Abbuchung bei Abos** — Datum, dann im Tagesband/Kalender und in der Startseite „diese Woche wird abgebucht“ | Cashew, Rocket Money, PostFinance (Durchschnitt) | Ohne Datum kann nichts auf das Abo schauen; das ist die fehlende Brücke Abos ↔ Kalender | `db/types.ts` `SubscriptionRow` (+ `nextDay`), `SubscriptionsView.tsx`, `features/today/useDayThread.ts` | 5 | 1 |
| 2 | **Budget-Tempo statt nur Balken** — „noch CHF 23 pro Tag“, „auf Kurs / 180 drüber, wenn es so weitergeht“ | Copilot, Cashew, „Cashews: one number a day“ | Beantwortet die eine Frage „Darf ich noch?“ | `BudgetView.tsx`, `MoneyHomeScreen.tsx` | 4 | 1 |
| 3 | **Swiss-QR-Rechnung einlesen** — Empfänger, Betrag, Fälligkeit, Referenz aus dem QR-Text | Keine Budget-App; Banken-Apps nur zum Zahlen | Das Häufigste in der Schweiz: eine Papierrechnung liegt da. Aus 3 Eingaben wird 1 Scan | neu `features/money/qrBill.ts`, `BillsView.tsx`; Kamera: `features/fit/BarcodeScanner.native.tsx` gibt es schon (`expo-camera`), BetterMoney braucht aber das Plugin in `apps/bettermoney/app.json` → **neuer Store-Bau** | 5 | 2 |
| 4 | **Wiederkehrende Rechnungen** — Miete, Krankenkasse, Steuerraten: bezahlt → die nächste entsteht | Cashew („repeating“), eBill-Dauerfreigabe, YNAB (scheduled) | Fixkosten einmal erfassen statt jeden Monat; Einrichten ≤ 1 Minute | `BillRow` (+ `repeat`), `bills.setPaid` in `db/money.ts` | 5 | 2 |
| 5 | **Kategorie beim Eintragen raten** — Händlername in der Notiz → Kategorie vorgewählt | Copilot (KI), Money Manager (Merkliste) | Die Regeln gibt es schon im Assistenten, das Formular nutzt sie nicht | `features/assistant/understand.ts` (`CATEGORIES`), `BudgetView.tsx` | 3 | 1 |
| 6 | **Sparziel mit Datum und Monatsrate** — Steuern, Ferien, 3a bis 31.12.: „noch CHF 410 pro Monat“ | YNAB (Targets), neon/Yuh Spaces | Macht Rückstellungen (Steuern!) planbar, verbindet Sparziel ↔ Kalender | `SavingsGoalRow` (+ `dueDay`), `SavingsView.tsx` | 4 | 2 |
| 7 | **Einnahmen und „frei verfügbar“** — Lohn einmal eintragen; frei = Lohn − Abos − wiederkehrende Rechnungen − Sparraten − Ausgaben | Monarch, Copilot, BudgetCH | Erst damit schauen alle vier Module aufeinander | neue Sammlung oder Feld am `BudgetRow`, `MoneyHomeScreen.tsx` | 5 | 3 |
| 8 | **Budget je Kategorie mit Warnung** bei 80 % | PostFinance, Cashew, YNAB | Häufigster Wunsch in Budget-Apps; Mitteilung gibt es schon im Kern | `BudgetRow` (+ `category`), `BudgetView.tsx`, `features/notifications/` | 3 | 2 |
| 9 | **Schweizer Vorlagen beim ersten Öffnen** — „Krankenkasse“, „Miete“, „Steuern“, „Säule 3a (7'258)“ als Chips, ein Tipp legt an; im Herbst Hinweis „Neue Prämien — wechseln bis 30.11.“ | BudgetCH (Richtwerte), keine App mit Prämien-Hinweis | Einrichten ≤ 1 Minute; typisch schweizerisch | `features/money/*View.tsx` (EmptyState), `i18n/*` | 3 | 2 |
| 10 | **Geteilte Ausgaben im Haushalt** — wer hat bezahlt, wer schuldet wem | Splitwise, Tricount, Monarch | Haushalte gibt es schon in BetterFamily; Splitwise-Frust ist gross | `db/households.ts`, `ExpenseRow` (+ `householdId`, `paidBy`, `split`) — Modul in BetterFamily oder BetterMoney? Entscheidung nötig | 4 | 4 |

**Bewusst nicht vorgeschlagen:**
- **Bankanbindung über bLink (SIX)**: technisch möglich, aber als Drittanbieter braucht es die
  Zulassung bei SIX, Verträge mit jeder Bank und Datenschutz-Prüfung. Seit Nov. 2025 sind erst
  acht Banken dabei. Nicht ohne Geschäftsentscheid.
- **eBill** ist nur für E-Banking und Rechnungssteller zugänglich (Netzwerk von SIX) — keine
  Schnittstelle für eine Budget-App.
- **Zahlen aus der App** (QR-Rechnung bezahlen) wäre Zahlungsverkehr → Bank-Lizenz. Wir merken
  uns die Rechnung, bezahlt wird im E-Banking.
- **Abos automatisch kündigen** (Finanzguru, Rocket Money): braucht Vollmachten und
  Rechtsprüfung; der Ärger bei Rocket Money zeigt das Risiko.

## 5. Schnelle Gewinne (je wenige Stunden, kein neues natives Paket)

Jeder: eine reine Funktion mit `*.test.ts` daneben (läuft mit `npm test`), dazu eine kleine
Oberfläche. Neue Felder immer optional, damit alte Zeilen gültig bleiben.

### A. Swiss-QR-Rechnung als Text lesen — `features/money/qrBill.ts`

Ja, als reine Funktion sehr sinnvoll: das Format ist öffentlich und streng (SIX,
Implementation Guidelines QR-bill v2.4, gültig ab 14.11.2026; v2.3 bis Nov. 2027).

- Zeilen getrennt mit CR+LF oder LF; Zeile 1 `SPC`, 2 `0200`, 3 `1`, 4 IBAN (21 Zeichen, nur CH/LI),
  5 Adresstyp (`S`), 6 Name des Empfängers, 7–11 Adresse, 12–18 endgültiger Empfänger (leer),
  19 **Betrag** (leer erlaubt, 0.01–999'999'999.99), 20 **Währung** CHF/EUR, 21–27 Zahler,
  28 Referenztyp `QRR`/`SCOR`/`NON`, 29 Referenz (QRR: 27 Ziffern, Modulo 10 rekursiv; SCOR:
  ISO 11649, Modulo 97), 30 Mitteilung (≤ 140), 31 `EPD`, 32 optional Rechnungsinformationen
  `//S1/10/<Nr>/11/<JJMMTT>/…/40/0:<Tage>` → **Fälligkeit = Rechnungsdatum + Tage**.
- Rückgabe: `{ title (Empfänger), amountChf | null, dueDay | null, iban, reference, message }`
  oder ein Fehlergrund (`not_swiss_qr`, `currency_eur`, `bad_checksum`).
- Oberfläche jetzt: im Rechnungs-Blatt „QR-Rechnung einfügen“ — ein Feld, in das man den Text
  einfügt (z. B. aus einem QR-Scanner des Handys oder vom PDF). Füllt Titel, Betrag, Fälligkeit
  vor. Später dieselbe Funktion hinter der Kamera (siehe Lücke 3, braucht Store-Bau).
- Tests: die Beispiele aus Anhang A der Guidelines (mit und ohne Betrag, QRR, SCOR, NON,
  `/40/0:30`), CR+LF und LF, fehlerhafte Prüfziffer.

### B. Nächste Abbuchung — `features/money/nextCharge.ts`

`nextChargeDay(startDay, interval, today)` → nächster Tag ≥ heute (Monatsende sauber: 31. → 30./28.).
Optionales Feld `SubscriptionRow.startDay`, im Formular ein `DayPicker` (gibt es schon,
`features/shared/DayPicker.tsx`). Liste zeigt „nächste: 3. Oktober“; das Tagesband zeigt Abos an
ihrem Tag wie Rechnungen (Muster in `useDayThread.ts` Zeile 204).

### C. Budget-Tempo — `features/money/pace.ts`

`budgetPace({ spent, limit, day, daysInMonth })` → `{ perDayLeft, projected, status: 'ok'|'tight'|'over' }`.
Eine Zeile unter dem Balken in `BudgetView.tsx` und auf `MoneyHomeScreen.tsx`: „Noch CHF 23 pro
Tag“ bzw. „So geht es CHF 180 drüber“. Keine Datenänderung.

### D. Kategorie aus der Notiz raten — `features/money/categories.ts`

Die Liste `CATEGORIES` aus `features/assistant/understand.ts` in eine eigene getestete Datei
ziehen (`guessExpenseCategory(text)`), Assistent und `BudgetView.tsx` nutzen dieselbe: wer
„Migros“ in die Notiz schreibt, bekommt „Essen“ vorgewählt (solange nicht von Hand gewählt).
Ergänzen um Schweizer Fälle: Krankenkasse/CSS/Helsana/Swica → health, Swisscom/Salt/Sunrise →
home, Halbtax/GA/ZVV → transport.

### E. Sparziel mit Frist — `features/money/savingsPlan.ts`

`monthlyNeeded({ target, saved, dueDay, today })` → Rate pro Monat (aufgerundet auf Franken),
0 wenn erreicht, `overdue` wenn vorbei. Optionales `SavingsGoalRow.dueDay`. Vorlage-Chips
„Steuern“ und „Säule 3a (CHF 7'258 bis 31.12.)“ im leeren Zustand.

Reihenfolge-Vorschlag: C → B → D → A → E (C und D ohne Datenänderung; A ist der grösste
Schweizer Vorteil).

## Quellen

- SIX: [Swiss Implementation Guidelines for the QR-bill v2.4 (PDF)](https://www.six-group.com/dam/download/banking-services/standardization/qr-bill/ig-qr-bill-v2.4-en.pdf), [v2.3 (PDF)](https://www.six-group.com/dam/download/banking-services/standardization/qr-bill/ig-qr-bill-v2.3-en.pdf), [QR-Rechnung Leitfaden (Vidima)](https://vidima.ch/en/qr-bill/)
- [WalletHub: YNAB vs. Monarch vs. Copilot (2026)](https://wallethub.com/edu/b/ynab-vs-monarch-vs-copilot-vs-wallethub/150687), [Engadget: Best budgeting apps 2026](https://www.engadget.com/apps/best-budgeting-apps-120036303.html), [WalletGrower: YNAB vs Monarch vs Copilot](https://walletgrower.com/compare/ynab-vs-monarch-vs-copilot)
- Rocket Money: [BBB-Beschwerden](https://www.bbb.org/us/md/silver-spring/profile/billing-services/rocket-money-inc-0241-236043013/complaints), [Trustpilot](https://www.trustpilot.com/review/rocketmoney.com), [Wall Street Survivor](https://www.wallstreetsurvivor.com/is-rocket-money-worth-it/)
- Finanzguru: [neuebanken.de Test 2026](https://www.neuebanken.de/finanzguru-test/), [finwiss: negative Erfahrungen](https://finwiss.de/finanzguru-negative-erfahrungen/)
- Cashew: [GitHub](https://github.com/jameskokoska/Cashew), [FAQ](https://cashewapp.web.app/faq.html), [App Store](https://apps.apple.com/us/app/cashew-expense-budget-tracker/id6463662930)
- Splitwise: [Hilfe: Ausgaben-Limit](https://feedback.splitwise.com/knowledgebase/articles/2010350-why-am-i-seeing-an-expense-limit), [splitty: Limits](https://splittyapp.com/learn/splitwise-free-limits/), [GoodShare vs Splitwise](https://goodshare.app/blog/goodshare-vs-splitwise/)
- PostFinance: [Analysefunktionen](https://www.postfinance.ch/en/private/paying-saving/e-banking-apps/analyse-manage-finances.html), [Budget erstellen](https://www.postfinance.ch/en/private/investing/tools-calculator/draw-up-budget.html)
- Neobanken: [Wise: neon vs Revolut](https://wise.com/ch/blog/revolut-vs-neon-schweiz), [finelles: Neobanken 2026](https://www.finelles.com/de/blog/neo-banken-schweiz)
- Schweizer Budget-Apps: [Magic Heidi: Budget-Apps Schweiz 2026](https://magicheidi.ch/budgeting-apps)
- Budgetberatung Schweiz: [Budgetbeispiele](https://budgetberatung.ch/budgetbeispiele), [Steuern im Griff](https://budgetberatung.ch/steuern), [BudgetHub](https://budgethub.ch/budget-schweiz)
- eBill: [finews: Nutzerzahlen](https://www.finews.ch/news/finanzplatz/61667-six-ebill-nutzerzahlen), [eBill FAQ](https://www.ebill.ch/en/home/private/faq.html), [moneyland: eBill](https://www.moneyland.ch/en/ebill-faq)
- bLink: [SIX: Start Multibanking (Nov. 2025)](https://www.six-group.com/en/newsroom/media-releases/2025/20251125-multibanking-launch.html), [bLink](https://blink.six-group.com/en), [finews](https://www.finews.ch/news/finanzplatz/70282-six-launch-multibanking-blink-sfti-open-banking)
- Säule 3a: [UBS: Maximalbetrag 2026](https://www.ubs.com/ch/de/services/pension/pillar-3/maximal-contribution.html), [BSV: Einkäufe 3a](https://www.bsv.admin.ch/bsv/de/home/sozialversicherungen/bv/grundlagen-und-gesetze/grundlagen/einkaeufe-saeule-3a.html)
- Krankenkasse: [BAG: Prämien 2026 +4.4 %](https://www.bag.admin.ch/de/newnsb/d2okh_kUK_OFhmMDfpyiy), [SRF](https://www.srf.ch/news/schweiz/erneuter-anstieg-so-stark-steigen-die-krankenkassenpraemien-2026-in-ihrer-gemeinde)
- Steuern: [ESTV Steuerrechner](https://www.estv.admin.ch/estv/de/home/die-estv/steuerstatistiken-estv/steuerrechner.html)
