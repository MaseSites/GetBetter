# GetBetter und die Better-Apps

Fünf eigenständige Expo-Apps in einem Arbeitsbereich, die sich einen Kern und
**eine Datenbank** teilen. **GetBetter** ist die Hauptapp und die Schaltzentrale;
die anderen decken je einen Bereich ab. Der ursprüngliche Plan liegt in
[docs/plan-prototyp-hauptapp.md](docs/plan-prototyp-hauptapp.md); er beschreibt
noch die Zeit, als alles eine App war.

## Die Apps

| App              | Ordner              | Schema            | Web  | Was drin ist                                                                                                                                                                           |
| ---------------- | ------------------- | ----------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GetBetter**    | `apps/getbetter`    | `getbetter://`    | 8081 | Privater Kalender, Aufgaben, Notizen, Wecker, Wetter, Dokumente, Gewohnheiten, Reisen, Kontakte, Geburtstage, E-Mail — alles ausgebaut, dazu Assistent, Mitteilungen und App-Übersicht |
| **BetterFamily** | `apps/betterfamily` | `betterfamily://` | 8082 | Familienkalender, Einkaufsliste, Ämtli, Rezepte, Pflanzen, Haustiere, Fahrzeuge — samt Haushalt, alles ausgebaut                                                                       |
| **BetterGym**    | `apps/bettergym`    | `bettergym://`    | 8083 | Training mit Sätzen und Vorlagen, Menüplan, Trinken, Schlaf, Medikamente, Werte, Kopf frei — alles ausgebaut                                                                           |
| **BetterAi**     | `apps/betterai`     | `betterai://`     | 8084 | Die Gespräche mit der KI, gespeichert und als Liste — sonst nichts                                                                                                                     |
| **BetterMoney**  | `apps/bettermoney`  | `bettermoney://`  | 8085 | Budget, Rechnungen, Abos, Sparziele — alle vier ausgebaut                                                                                                                              |

`APP_MODULES` in `packages/core/src/app/identity.ts` ist die Wahrheit darüber,
welche App welche Module führt. `calendar` steht in zwei Apps: GetBetter führt
den privaten, BetterFamily den Familienkalender — `hasHouseholds()` entscheidet,
welcher gemeint ist.

## Starten

```bash
npm install        # einmal, für alle Arbeitsbereiche
npm run all        # Datenbank und alle fünf Apps auf einmal
npm run server     # nur die Datenbank (8090)
npm run web        # GetBetter im Browser (8081)
npm run family     # BetterFamily (8082)
npm run gym        # BetterGym (8083)
npm run ai         # BetterAi (8084)
npm run money      # BetterMoney (8085)
npm run typecheck  # tsc über alles, danach über die Tests
npm run lint
npm test           # die reinen Rechenteile, unter Node
node scripts/icons.js   # alle Bilder neu erzeugen
```

## Tests

`npm test` lässt Node die `*.test.ts` neben dem Code laufen — ohne Jest, ohne
Bundler: Node streift die Typen selbst ab, `scripts/test-hooks.mjs` löst
`@/…` und Importe ohne Endung auf. Getestet wird, was ohne App und Datenbank
rechnet: Beträge (`features/money/amount.ts`), Abteilungen und Mengen
(`features/shopping/categories.ts`), Tage und Geburtstage
(`features/shared/days.ts`), die Datumsrechnung des Kalenders
(`features/calendar/dates.ts`) und `db/pure.ts` — dort liegen `dayKey`,
`monthKey`, `sleepMinutes` und `chatTitleOf`, bewusst ohne Speicher dahinter.
Eine Datei, die getestet werden soll, importiert deshalb relativ, nicht über
den Speicher-Index. `tsconfig.test.json` prüft die Tests mit den Node-Typen.
`npm test` nimmt ausserdem `services/api/**/*.test.js` mit: MIME, Anbieter,
Tresor, IMAP und SMTP gegen nachgebaute Server (`services/api/test/fakes.js`)
und die Routen gegen einen Dienst im Temp-Ordner — nie gegen echte Postfächer.

Wirft ein Bildschirm, fängt `app/ErrorBoundary.tsx` das ab und zeigt statt
eines weissen Blatts „Da ist etwas schiefgegangen“ mit „Nochmal versuchen“.

`/ui-kit` (nur in GetBetter) zeigt jeden UI-Baustein in allen Zuständen.

## Aufbau

```
packages/core/src/     Der gemeinsame Kern — jede App zieht ihn über `@/…`
  app/                 identity.ts (welche App bin ich), RootShell, tabs, bridge
  screens/             Bildschirme, die alle Apps gleich brauchen
  theme/ ui/ i18n/     Aussehen, Bausteine, Sprache
  db/ auth/ state/     Speicher, Konten, Sitzung
  features/            Kalender, Aufgaben, Notizen, Einkauf, Ämtli, Wecker, Gym,
                       KI, Assistent, Haushalt, Onboarding, Apps
  assets/              Erzeugte Logos (nicht von Hand anfassen)
apps/<name>/
  app/                 Nur die Routen — meist einzeilige Verweise auf den Kern
  app.json             Name, Schema, Store-Kennung, Splash, Icons
  eas.json             Bauprofile
  assets/              Erzeugte Store-Bilder
  metro.config.js      Beobachtet auch den Kern ausserhalb des App-Ordners
services/api/          Die Datenbank: ein Node-Dienst ohne Abhängigkeiten
scripts/               dev.js (alles starten), icons.js (alle Bilder)
```

Die Routen sind absichtlich dünn: `export { WorkspaceScreen as default } from '@/screens';`.
Was an einer App wirklich anders ist, steht in ihrer `app.json` und in ihrem
`(tabs)/_layout.tsx`.

## Eine Datenbank für alle Apps

`services/api/server.js` hält alles in einer JSON-Datei
(`services/api/data/db.json`, nicht im Git): Konten, Termine, Listen,
Haushalte, Training. Jede App lädt beim Start den ganzen Stand (`GET /v1/db`),
hält ihn im Speicher (`db/store.ts`) und schreibt geänderte Sammlungen zurück
(`PUT /v1/db/:collection`). Alle vier Sekunden fragt sie nach der Revision und
lädt neu, wenn eine andere App etwas geändert hat — so landen die Zahlen aus
BetterGym ohne Neuladen auf der GetBetter-Karte.

Antwortet der Dienst nicht, zeigt `RootShell` einen Bildschirm mit „Nochmal
versuchen“. Ohne erfolgreiches Laden wird nie geschrieben, damit ein leerer
Stand nichts überschreibt.

| Route                                               |                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /v1/db`                                        | Alles, ohne Passwort-Hashes                                      |
| `PUT /v1/db/:collection`                            | Eine Sammlung ersetzen                                           |
| `GET /v1/revision`                                  | Hat sich etwas geändert?                                         |
| `POST /v1/accounts`                                 | Registrieren, mit Wunsch-Benutzernamen                           |
| `POST /v1/sessions`                                 | Anmelden                                                         |
| `GET /v1/accounts/:id`                              | Konto lesen                                                      |
| `GET /v1/accounts/by-username/:name`                | Für Einladungen                                                  |
| `PATCH /v1/accounts/:id`                            | Spitzname, Sprache, Benutzername, Aussehen, Assistent, Hintergrund |
| `POST /v1/notifications`                            | Mitteilung für ein Konto anlegen                                 |
| `POST /v1/notifications/:id/read`                   | als gelesen markieren                                            |
| `DELETE /v1/notifications/:id`                      | löschen                                                          |
| `POST /v1/notifications/remove-by-ref`              | alle zu einer Anfrage löschen                                    |
| `POST /v1/uploads` · `GET`/`DELETE /v1/uploads/:id` | eigenes Hintergrundbild                                          |
| `GET /v1/mail/providers?email=`                     | Anbieter und Server erkennen                                     |
| `POST /v1/mail/accounts` · `DELETE …/:id`           | Postfach verbinden / trennen                                     |
| `POST /v1/mail/sync`                                | Postfächer eines Kontos abgleichen                               |
| `POST /v1/mail/messages/:id/seen`                   | gelesen / ungelesen                                              |
| `POST /v1/mail/messages/:id/delete`                 | in den Papierkorb                                                |
| `POST /v1/mail/messages/actions`                    | mehrere auf einmal: gelesen, Fahne, verschieben, löschen         |
| `POST /v1/mail/send`                                | senden: sofort, verzögert (`delayMs`), Antwort, Weiterleitung    |
| `POST /v1/mail/send/:sendId/cancel` · `GET …/:sendId` | verzögerte Mail aufhalten / wie es ihr ging                    |
| `GET /v1/mail/messages/:id/body?images=0\|1`        | HTML gesäubert und Text, auf Nachfrage                           |
| `GET /v1/mail/messages/:id/attachments/:index`      | ein Anhang als Bytes, höchstens 25 MB                            |
| `POST /v1/mail/drafts` · `DELETE …/:id`             | Entwurf sichern oder ersetzen / löschen                          |
| `GET /v1/speech/status` · `GET /v1/speech/voices`   | Stimmen von ElevenLabs: eingerichtet? welche?                    |
| `POST /v1/speech` · `GET /v1/speech/<id>.mp3`       | einen Satz sprechen lassen, das Audio kommt als Strom            |
| `POST /v1/speech/sample`                            | Probe einer Stimme: fester Satz, einmal erzeugt, dann gratis     |
| `GET /v1/ai/budget?accountId=&app=`                 | KI-Kontingent dieses Kontos in dieser App, diesen Monat          |
| `POST /v1/view/redeem`                              | Ticket aus dem Admin einlösen („App ansehen“), genau einmal      |

`db/service.ts` ist der Draht dorthin (`serviceUrl()`, im Bau über
`EXPO_PUBLIC_API_URL` übersteuerbar), `auth/accounts.ts` die Schicht darüber.
Passwörter prüft nur der Dienst, mit scrypt über Salt und Passwort; Salt und
Hash verlassen ihn nie. Konten-Ids sind aus der E-Mail abgeleitet, damit jede
App dasselbe Konto meint.

Die Sammlung `appAccess` merkt sich, in welcher App ein Konto schon einmal war
(`appAccess.markSeen`). Darauf beruht in GetBetter der Unterschied zwischen
„freigeschaltet“ und „Installieren“.

**Gesperrt und weggenommen** entscheidet der Admin, nicht die App: am Konto
stehen `disabled` (ganzes Konto) und `blockedApps` (einzelne `AppId`s).
`accessOf` (`app/access.ts`, getestet) liest beides; `RootShell` zeigt dann
statt der App „Dein Konto ist gesperrt“ bzw. „Nicht freigeschaltet“ mit
**Abmelden**. Die Änderung kommt mit dem nächsten Abgleich an, ohne Neustart.
Ein gesperrtes Konto kann sich nicht mehr anmelden (`account_disabled`).
Ebenso nur vom Admin: `paidApps`, die Apps mit Abo (siehe „Abo und Kontingent“).

**Drei Sammlungen gehören dem Dienst:** `notifications`, `mailAccounts` und
`mailMessages`. Die Apps lesen sie wie alles andere, schreiben aber nur über die
Routen oben — `PUT` darauf antwortet `403 server_owned`. Sonst überschriebe eine
App, was der Dienst gerade für eine neue E-Mail angelegt hat. Im Kern geht das
über `callService` (`db/service.ts`) und danach `refresh()` aus dem Speicher.

Der Dienst ist in Teile zerlegt: `server.js` (Routen), `store.js`,
`notifications.js`, `uploads.js` und `mail/` (IMAP, SMTP, MIME, Ordner, Struktur, Anbieter,
Tresor, Abgleich) — alles nur mit Node-Kernmodulen. Der Datenordner lässt sich
mit `BETTER_DATA_DIR` umlenken (die Tests tun das immer), der Abgleich-Takt mit
`BETTER_MAIL_SYNC_MS`. Nach Änderungen am Dienst muss er neu starten.

Der Dienst ist für die Entwicklung gedacht: kein HTTPS, keine Zugriffstoken,
keine Ratenbegrenzung (siehe `services/api/README.md`). Vor einer echten
Veröffentlichung gehört die Datenbank hinter einen richtigen Server.

## Admin (nur auf diesem Rechner)

**http://127.0.0.1:8091** — läuft im selben Prozess wie der Dienst
(`services/api/admin/server.js`), startet also mit `npm run all`; nach
Änderungen am Dienst neu starten. `BETTER_ADMIN_PORT=0` schaltet ihn ab.

- **Übersicht:** Konten, aktive der letzten 7/30 Tage, Nutzer je App, Einträge
  je Funktion, KI-Anfragen und -Kosten der letzten 30 Tage, Anteil der
  günstigen Stufe (Ziel 80 %), die Stimmen (Sätze, Credits, gesparte Credits,
  Credits des Monats gegen das Kontingent), Speicher.
- **Verbrauch je Konto:** in der Liste „Verbrauch 30 Tage“ („12’340 Tokens ·
  1’230 Credits“), im Konto eine Tabelle für die letzten 30 Tage und gesamt —
  KI: Anfragen, Tokens ein/aus/zusammen, CHF; Stimme: Sätze, davon aus dem
  Zwischenspeicher, erzeugte Zeichen, Credits, davon Proben, gesparte Credits
  (`usage` an `/api/accounts` und `/api/accounts/:id`).
- **Konten:** Spitzname, Benutzername, Sprache und Passwort ändern; das Konto
  sperren (`disabled`). Gleich daneben je App eine Zeile: Zugang
  (erlaubt/gesperrt, `blockedApps`), Abo (an/aus, `paidApps`) und der Verbrauch
  dieses Monats als Balken gegen das Budget, dazu ein Abzeichen Gratis/Abo; in
  der Liste die Spalte „Abo“. Alle drei Felder setzt **nur** der Admin —
  `PUT /v1/db/accounts` behält die gespeicherten Werte, `PATCH
  /v1/accounts/:id` übergeht sie. Die App merkt es beim nächsten Abgleich.
- **Marge:** Übersicht (laufender Monat) und Kosten (gewählter Monat): je App
  Nettoeinnahmen (Abos × Preis ÷ 1.081 × 0.85), KI, Stimme, davon Gratis-Konten,
  Marge in CHF und %, negativ rot; gesamt auch mit den Fixkosten (was die
  Mindestgebühr von Safe Swiss Cloud über dem Verbrauch kostet,
  `BETTER_SPEECH_MONTHLY_FIXED_USD`). Abos zählen nach heutigem Stand, auch für
  frühere Monate (`admin/billing.js`, getestet).
- **App ansehen:** Der Knopf im Konto öffnet ein kleines Fenster (390 × 780)
  mit der App dieses Kontos und seinen Daten — Umschalter für die fünf Apps
  (Standard: die erste, in der das Konto schon war), Neu laden, Schliessen,
  „Nur ansehen – es wird nichts geändert“. Jedes Laden holt ein **Einmal-Ticket**
  (`POST /api/accounts/:id/view`, 32 Zufallsbytes, 60 s, nur im Speicher:
  `services/api/viewTickets.js`); die App lädt `http://localhost:<port>/?view=…`,
  löst es mit `POST /v1/view/redeem` ein und nimmt `?view=` aus der Adresse.
  Danach ist sie **nur lesend** (`packages/core/src/app/viewMode.ts`, getestet):
  das Konto lebt nur im Arbeitsspeicher (keine Sitzung in AsyncStorage, die
  eigene Anmeldung in anderen Tabs bleibt unberührt), kein `appAccess`, kein
  Intro, Einrichten oder Vorlesen, kein Mikrofon, `accessOf` gilt nicht. Zentral
  gesperrt: der Speicher ändert und schreibt nichts (`store.ts`), `callService`
  schickt nur GET und das Einlösen (sonst `read_only`), Aufträge an andere Apps
  gehen nicht los; jeder Versuch zeigt „Nur ansehen“ statt „Gelöscht ·
  Rückgängig“. Jede Anfrage trägt `X-Better-View: 1`, und der Dienst lehnt damit
  alles ausser GET/HEAD mit `403 read_only` ab. Der Abgleich alle vier Sekunden
  läuft weiter. Oben steht „Ansicht von @name · nur lesen“; ein abgelaufenes
  Ticket zeigt „Diese Ansicht ist abgelaufen“. Die CSP des Admins erlaubt
  `frame-src` genau für localhost:8081–8085. Im Verlauf `admin.viewed { app }`.
  **Keine echte Anmeldung, nur für die Entwicklung.**
- **Konto löschen** (`DELETE /api/accounts/:id` mit `{ confirm: <E-Mail> }`,
  Regeln in `admin/deletion.js`, getestet): das Konto und alle privaten Zeilen
  samt ihren Kindern, eigene Kalender, Freigaben, Mitteilungen, Postfächer
  (über `mail.removeAccount`) und Bilder, auf die nichts mehr zeigt. Was mit
  einem Haushalt geteilt ist, in dem noch jemand zugesagt hat, bleibt; ohne
  andere Mitglieder geht der Haushalt mit, sonst übernimmt das älteste Mitglied
  die Verwaltung. Vorher landet eine Sicherung ohne Salt und Hash in
  `data/deleted-accounts/<id>-<zeit>.json`. Die entfernten Ids merkt sich
  `db.json` unter `deleted` (nie an die Apps); `PUT /v1/db/:collection` lässt
  sie weg, damit eine App mit altem Stand nichts zurückschreibt. Registriert
  sich dieselbe Adresse neu (gleiche Id), gilt das nicht mehr. Eine offene
  Sitzung meldet sich beim nächsten Abgleich ab (`AppContext`, nur bei
  `not_found`, nie offline).
- **Verlauf** (`services/api/activity.js`, `<datenordner>/activity.jsonl`):
  Konto angelegt, angemeldet, Anmeldung gescheitert oder gesperrt, Profil
  geändert, je Sammlung neu/geändert/gelöscht (`collection.changed`, ohne
  Inhalte), Admin-Änderungen — dazu jeder KI-Aufruf aus `ai-usage.jsonl`.
  Ämtli haben keinen Besitzer und erscheinen dort nicht.
- **Kosten:** je App, je Konto, je Stufe und je Tag aus `ai-usage.jsonl`
  (Tokens × Preis je Modell in `ai/usage.js`), dazu die Mindestgebühr von
  Safe Swiss Cloud (CHF 95 im Monat, `BETTER_AI_MONTHLY_MINIMUM_CHF`). Dazu die
  Stimmen aus `speech-usage.jsonl` in Credits — je Konto, je App, davon Proben,
  gesparte Credits — gegen das Kontingent (`BETTER_SPEECH_MONTHLY_CREDITS`,
  Standard 10’000 wie der Gratis-Plan), und der Zwischenspeicher: Sätze,
  Grösse, Wiedergaben und die zehn meistgespielten — nur Art, Zeichen und
  Hits, nie der Wortlaut und nie eine Id.

Die Seite selbst ist schlichtes HTML/JS ohne Fremdbibliothek
(`services/api/admin/public/`), mit `?demo=1` auch ohne Dienst.

**Sicherheit:** nur an 127.0.0.1 gebunden, der `Host` muss `127.0.0.1:<port>`
oder `localhost:<port>` sein, jede ändernde Anfrage braucht dieselbe `Origin`
und JSON, strenge CSP, keine CORS-Kopfzeilen. Eine Anmeldung gibt es nicht —
wer an diesem Rechner sitzt, kann alles. Nur für die Entwicklung.

## Aufträge zwischen den Apps

Neben der gemeinsamen Datenbank gibt es **Aufträge per Tiefenlink**
(`packages/core/src/app/bridge.ts`):

```
getbetter        →  betterfamily://befehl/einkauf?text=2%20Bananen
```

Der Assistent in GetBetter erkennt ein paar Muster
(`features/assistant/route.ts`) und schickt sie los; die andere App fängt sie
auf ihrer Route `befehl/[command]` auf, trägt sie ein und sagt, was daraus
wurde. Es wirkt nur, wenn die andere App auf demselben Gerät installiert ist;
im Browser gibt es keine Schemata, dort nimmt die Brücke `localhost:<port>`.

## Abo und Kontingent

Damit KI und Stimmen nie mehr kosten, als ein Konto einbringt, hat jedes Konto
**je App und Kalendermonat in Zürich** ein Budget (`services/api/billing/`,
getestet; `2026-09-30T22:30Z` zählt schon zum Oktober).

| App          | Abo im Monat | Budget     |
| ------------ | ------------ | ---------- |
| BetterAi     | 8.–          | 4.72 CHF   |
| BetterGym    | 5.–          | 2.95 CHF   |
| BetterFamily | 3.–          | 1.77 CHF   |
| GetBetter    | 1.–          | 0.59 CHF   |
| BetterMoney  | noch keins   | nur Gratis |

- **Formel:** `preis / 1.081 (MwSt) × 0.85 (Store) × 0.75` — dem Betreiber
  bleiben mindestens 25 % der Nettoeinnahmen. **Ohne Abo** 0.10 CHF je App,
  nur die günstige Stufe (ein Bild → `403 plan_required`), keine Stimmen von
  ElevenLabs.
- **Wer zahlt:** `paidApps` am Konto. Bis es den Kauf im Store gibt, setzt es
  **nur der Admin**; `planOf` (`billing/plans.js`) ist die eine Stelle, die
  später ein Kaufbeleg füttert.
- **Gezählt** nach `app` in `ai-usage.jsonl` (`costChf`) und
  `speech-usage.jsonl` (Credits × `BETTER_SPEECH_USD_PER_1K_CHARS` / 1000 ×
  `BETTER_USD_CHF`, bewusst zu hoch; aus dem Zwischenspeicher 0). Das
  Kassenbuch (`billing/ledger.js`) baut sich nach einem Neustart aus den
  Protokollen und wächst dann im Speicher mit.
- **Durchgesetzt im Dienst, vor jedem bezahlten Aufruf.** KI: ohne Rest `402
  budget_exhausted` (mit `plan`, `resetsOn`, `priceChf`); sonst kürzt er
  `max_tokens` (samt Denkzuschlag), bis der schlimmste Fall passt — unter 150
  Tokens auch `402` — und **reserviert** den Betrag vor dem Aufruf, damit
  parallele Anfragen nicht überziehen. Stimmen: ohne Abo (oder ohne Konto)
  `403 plan_required`, mit Abo neue Sätze nur im Budget (`402`), aus dem
  Zwischenspeicher immer. `GET /v1/speech/status?accountId=&app=` sagt der App
  `allowed`, `GET /v1/ai/budget` den Stand.
- **In der App:** Assistent und BetterAi sagen ehrlich „Dein KI-Kontingent für
  diesen Monat ist aufgebraucht. Am 1. Oktober geht es weiter.“ oder „Dein
  Gratis-Kontingent ist aufgebraucht. Mit dem Abo (CHF 8 im Monat) geht es
  weiter.“ (`aiFailureText` in `aiTurns.ts`, getestet) — **keinen Kaufknopf**.
  Ohne Abo sind nur Browser-Stimmen wählbar, mit „Echte Stimmen gibt es mit dem
  Abo.“ In den Einstellungen (Gruppe App, in allen Apps) „KI diesen Monat“:
  Gratis oder Abo, genutzt in Prozent mit Balken, darunter wann es wieder voll
  ist — nie Franken.
- **Stellschrauben:** `BETTER_PRICE_<APP>_CHF`, `BETTER_VAT`,
  `BETTER_STORE_FEE`, `BETTER_USER_SHARE`, `BETTER_TRIAL_BUDGET_CHF`,
  `BETTER_SPEECH_USD_PER_1K_CHARS`, `BETTER_USD_CHF`,
  `BETTER_SPEECH_MONTHLY_FIXED_USD`. Nach Änderungen den Dienst neu starten.
- Die **Fixkosten** (Mindestgebühr Safe Swiss Cloud CHF 95, Plan von
  ElevenLabs) deckt kein einzelnes Budget — dafür braucht es genug zahlende
  Konten. Die Marge im Admin zeigt, ob es reicht.

## Die zwei KI-Oberflächen

|       | Assistent (Tab in GetBetter)                                      | BetterAi                                  |
| ----- | ----------------------------------------------------------------- | ----------------------------------------- |
| Was   | Verwaltet quer über die Apps, schickt Aufträge los                | Ein ganz normales KI-Gespräch             |
| Wo    | `features/assistant/AssistantView.tsx`                            | `features/ai/ChatsView.tsx`, `/chat/[id]` |
| Daten | Liest deine GetBetter-Daten, schickt Aufträge an die anderen Apps | Sieht deine Daten nicht                   |

Beide folgen dem Aussehen des Kontos wie jeder andere Bildschirm — eine eigene
dunkle Fläche gibt es nicht mehr. Der Assistent hat keinen Kopfbereich: in der Mitte der Avatar und „Wie kann ich
dich unterstützen?“, unten das Feld.

**Die Antworten kommen von der KI im Dienst** (`POST /v1/ai/reply`,
`db/ai.ts`), Anbieter ist **Safe Swiss Cloud** („Private AI“, alles in der
Schweiz). Ein Router im Dienst wählt ohne eigenen KI-Aufruf die günstigste
Stufe, die die Frage kann (cheap · chat · reasoning · vision), begrenzt die
Länge und liefert im Gespräch per Stimme zusätzlich einen kurzen `voice_text`
zum Vorlesen:

- **Assistent** (`AssistantView`): Was `route()` als Auftrag erkennt, geht wie
  bisher an die andere App; alles andere fragt die KI mit den letzten zwölf
  Zügen (`turnsFor` in `features/assistant/aiTurns.ts`, getestet). Im
  **Gespräch** wird `voice_text` vorgelesen, geschrieben steht die ganze
  Antwort.
- **BetterAi** (`AiChatView`): ein gespeichertes Gespräch, dessen letzte
  Nachricht noch unbeantwortet ist, beantwortet sich selbst — so wartet ein
  frisch aus der Liste angefangenes Gespräch mit der Denkanzeige, statt eine
  feste Antwort zu bekommen. „Denkt nach“ ergibt sich dort aus der Liste, nicht
  aus einem Zustand im Effekt.
- **Ohne eingerichtete KI** (`not_configured`, oder ein alter Dienst ohne die
  Route) bleibt es beim ehrlichen Satz von vorher; nicht erreichbar, zu viel
  los und gescheitert haben je einen eigenen Satz (`aiFailureKey`).

**Einrichten:** Schlüssel in `SAFESWISSCLOUD_API_KEY` oder
`services/api/data/safeswisscloud.key`, die eigene Adresse von Safe Swiss Cloud
(`https://…/v1`) in `SAFESWISSCLOUD_API_URL` oder
`services/api/data/safeswisscloud.url` — beides wird bei jeder Anfrage neu
gelesen, nie ins Git. Die Weiche steht in `services/api/ai/router.js`
(getestet), die Modelle je Stufe (`gemma4-31b`, `gpt-oss-120b`,
`deepseek-v4-flash`, Vision `gemma4-31b`) lassen sich mit
`BETTER_AI_MODEL_CHEAP|CHAT|REASONING|VISION` tauschen. Denkende Modelle
bekommen 1024 Tokens Zuschlag, damit das Nachdenken die Antwort nicht
auffrisst. Jeder Aufruf landet ohne Inhalt in `data/ai-usage.jsonl` (Stufe,
Modell, Tokens, CHF) — daraus rechnet der Admin die Kosten.

**Mit ihm reden** (`features/assistant/speech.ts`, `useVoice.ts`,
`VoiceControls.tsx`): **Sprechen** legt das Gesagte ins Feld — nicht direkt
abschicken, die Erkennung irrt sich. **Gespräch** hört zu, antwortet, liest vor
und hört wieder zu; nach zwei stummen Runden legt er auf, damit das Mikrofon
nicht ewig läuft. Beides gibt es **nur im Browser**, über `SpeechRecognition`
und `speechSynthesis` — ohne Paket geht es auf dem Gerät nicht, und dort sagt
ein Tipp das ehrlich. Beim Verlassen des Bildschirms **und** beim Tabwechsel
(`useIsFocused`, `AppState`) hört das Zuhören auf; Expo Router hängt einen Tab
nicht aus, ein Effekt allein reicht also nicht.

**Echt klingende Stimmen** kommen von **ElevenLabs** — über den eigenen Dienst
(`services/api/speech/service.js`), nie direkt aus der App, damit der
Schlüssel den Rechner nicht verlässt. Er steht in `ELEVENLABS_API_KEY` oder in
`services/api/data/elevenlabs.key` (nie im Git) und wird bei jeder Anfrage neu
gelesen. Die App fragt `/v1/speech/status` und `/v1/speech/voices`
(`features/assistant/cloudVoice.ts`); ist ElevenLabs eingerichtet, stehen nur
noch dessen Stimmen zur Wahl (`assistantVoice` = `eleven:<voice_id>`), und
alle sprechen damit: Avatar, Gespräch, Probe. Ein Satz geht als
`POST /v1/speech` an den Dienst — mit `accountId` und `app` (`setSpeaker` in
`cloudVoice.ts`, gesetzt von `AppContext`; vor dem Anmelden `null`) —, das
Audio kommt als `GET …/<id>.mp3?play=<ticket>` im Strom. Scheitert es
(Schlüssel falsch, Guthaben leer, kein Netz), spricht der Browser, und die
Auswahl sagt, warum. Modell: `eleven_multilingual_v2`, tauschbar mit
`BETTER_SPEECH_MODEL`. Der Gratis-Plan hat 10’000 Credits im Monat (ein Credit
je Zeichen, Flash und Turbo einen halben) und erlaubt keine kommerzielle
Nutzung.

- **Zwischenspeicher** (`services/api/speech/cache.js`, getestet): fertiges
  Audio liegt in `data/speech-cache/`, derselbe Satz mit derselben Stimme kostet
  nur einmal. Der Schlüssel vereinheitlicht Leerraum, typografische
  Anführungszeichen, Apostrophe und Striche — „3 Bananen hinzugefügt.“ mit
  und ohne Leerzeichen am Ende ist dieselbe Datei; Gross/klein und Satzzeichen
  zählen, gesprochen wird das Original. `index.json` zählt je Datei die Hits;
  wird es zu voll (`BETTER_SPEECH_CACHE_FILES`, Standard 2000, und
  `BETTER_SPEECH_CACHE_MB`, Standard 200), fallen zuerst die mit den wenigsten
  Hits, bei Gleichstand die am längsten nicht gespielten, nie der eben
  erzeugte. So bleiben häufige Bestätigungen wie „BetterFamily übernimmt das:
  „2 Bananen“ ist unterwegs.“ (`assistant.handedOver`, ein fester Satz ohne
  Zeit oder Zufall) und werden nur noch abgespielt. Fehlt der Index oder ist er
  kaputt, entsteht er neu aus den Dateien.
- **Proben** (`POST /v1/speech/sample { voice, language, accountId?, app? }`):
  den Satz wählt der Dienst — je Sprache ein fester ohne Namen („Hallo, so
  klinge ich.“); ein mitgeschickter Text zählt nicht. Eine Probe entsteht, wenn
  irgendwer die Stimme zum ersten Mal anhört, und liegt dann in
  `speech-cache/samples/`, das nie aufgeräumt wird — für alle anderen gratis.
  Vorab erzeugt wird nichts. Auch die Stimme des Browsers sagt diesen Satz
  (`assistant.voice.sampleAnon`, `Voice.saySample`, `VoicePicker` in den
  Einstellungen und beim Einrichten) — keine Probe nennt den Namen.
- **Verbrauch** (`services/api/speech/usage.js`): jede Wiedergabe mit Ticket
  und jede Erzeugung wird eine Zeile in `data/speech-usage.jsonl` — `{ at,
  accountId, app, purpose: speech|sample, model, voiceId, characters, credits,
  cached, ok, error }`, nie der Text. Aus dem Speicher `cached: true, credits:
  0`; ein zweites Holen mit demselben Ticket zählt nicht. Daraus rechnet der
  Admin die Credits je Konto.

**Stimmen des Browsers** (`features/assistant/voices.ts`, getestet): natürliche zuerst
(„Natural“, „Enhanced“, „Premium“ — Edge und Safari), dann Stimmen aus dem Netz
wie „Google Deutsch“, zuletzt die blechernen Sprachpakete des Systems. Die
fallen aus der Auswahl, sobald es zwei bessere gibt; ohne eigene Wahl spricht
die oberste. Chrome unter Windows hat nur „Google Deutsch“ als bessere Stimme.

BetterAi führt die Gespräche in der Datenbank (`chats`, `chatMessages`,
`db/chats.ts`): die Startseite ist die Liste, das Neueste zuerst, mit der
letzten Nachricht als Vorschau; ein Anfang-Chip legt ein Gespräch mit dieser
Frage an, der Titel ist die erste Frage. `AiChatView` ohne `chatId` (die
Funktion in GetBetter) lebt nur bis zum Schliessen.

## Haushalte (BetterFamily)

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

Haushalte gibt es **nur in BetterFamily** (`APPS_WITH_HOUSEHOLD`). Dort ist der
Haushalt eine Funktion wie jede andere: eine Kachel unter Funktionen, ein
Abschnitt auf der Startseite, die Route `/household`. Beim Beitritt werden
Einkaufsliste und Ämtli in den Haushalt übernommen — Termine nicht, die
bleiben privat.

## BetterFamily: der Haushalt

Vorbild sind Cozi und FamilyWall — eine Liste, die alle sehen, und die Dinge,
die man sonst vergisst. Alles gehört dem Haushalt (`householdId`); wer in
keinem ist, sieht nur Eigenes (`familyVisible` in `db/family.ts`).

- **Einkaufsliste** (`shoppingItems`) — sortiert wie im Laden: Früchte &
  Gemüse, Brot, Milch & Käse, Fleisch & Fisch, Vorrat, Getränke, Haushalt,
  Anderes. Die Abteilung rät `guessCategory`
  (`features/shopping/categories.ts`) aus dem Namen, ein Chip über dem Feld
  setzt sie fest; „2 Bananen“ wird zu Menge 2 (`splitQuantity`). Erledigtes
  steht unten unter „im Korb“.
- **Rezepte** (`recipes`) — Personen, Zutaten (eine pro Zeile), Zubereitung,
  Chips Schnell/Vegi/Kinder/Gäste. **Zutaten auf die Einkaufsliste** legt jede
  Zeile als Posten an, mit Menge und geratener Abteilung.
- **Pflanzen** (`plants`) — Ort und Giessrhythmus; `plantDueDay` sagt, wer dran
  ist. Oben **Heute giessen**, ein Tipp auf „Gegossen“ setzt den Rhythmus neu.
- **Haustiere** (`pets`, `petEvents`) — Art, Alter, Termine (Tierarzt, Impfung,
  Entwurmung, Pflege); oben **Demnächst** über alle Tiere.
- **Fahrzeuge** (`vehicles`) — Kennzeichen, nächster Service, Reifenwechsel,
  Vignette (Jahr), Kilometerstand. Was in 30 Tagen fällig ist oder fehlt, rot.

Die Startseite zeigt die Liste, die letzten Rezepte, was heute zu giessen ist
(antippen heisst gegossen), die nächsten Tiertermine und was am Auto ansteht.

## Kalender

`features/calendar/` — drei Ansichten über denselben Datenbestand, in GetBetter
über den privaten Kalender, in BetterFamily über den der Haushalte:

- `MonthView` — Raster mit Kästchen: jeder Tag zeigt seine Termine als farbige
  Streifen, `+N` wenn mehr da sind. Ein Tag antippen führt in seine Tagesansicht.
- `TimeGrid` — Zeitraster für Tag und Woche, mit Überlappung nebeneinander
  und einer Linie für die aktuelle Uhrzeit. Ganztägiges steht darüber als
  farbiger Balken über die ganze Breite seines Tages, ohne Punkt, mit weisser
  Schrift (`AllDayRow` in `CalendarView.tsx`); mehrere stehen untereinander,
  nie nebeneinander, und in der Woche genau über ihrer Spalte.
- `EventEditor` — Titel, ganztägig, Datum, Von/Bis, Kalender, Farbe, Ort, Notiz.
  Die Zielkalender werden angehakt, **mehrere sind erlaubt**. Der Knopf zum
  Anlegen ist der kleine `FloatingButton` unten rechts.
- `CalendarPicker` — das aufklappbare Menü in der Kopfzeile: oben die Ansicht,
  darunter je ein Häkchen pro Kalender, unten unter **Kalender anzeigen** die
  Personen. „Kalender verwalten“ sitzt als Zahnrad oben rechts.

### Eigene Kalender

`db/calendars.ts` — bis zu **5** eigene Kalender (`MAX_CALENDARS`). Geteilt wird
über `calendarMembers`: Haushaltsmitglieder kommen direkt dazu, Externe werden
per **Benutzername** eingeladen und müssen zustimmen.

### Fremde Kalender ansehen

Unter **Kalender anzeigen** stehen die Haushaltsmitglieder — je Haushalt eine
Gruppe, mit Überschrift erst, wenn mehrere welche beisteuern. Darunter
**Andere**: Konten ausserhalb, die zugestimmt haben. „Andere Person anzeigen“
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

Noch nicht drin: Wiederholungen, mehrtägige Termine, Erinnerungen. Geburtstage
kommen trotzdem jedes Jahr — sie werden aus den Kontakten gedacht (siehe unten).

## GetBetter: die Organisation

Vorbild sind Things 3 und Apple Erinnerungen — wenig Text, klare Abschnitte,
ein Tipp fürs Wichtigste. Alles je Konto, Tage als `YYYY-MM-DD`
(`features/shared/days.ts`: `daysUntil`, `shiftDay`, `relativeDay`,
`nextBirthday`). Ein Datum wählt man mit `DayPicker`
(`features/shared/DayPicker.tsx`): Chips für heute, morgen, in einer Woche, in
einem Monat, dahinter ein Feld für alles andere.

- **Aufgaben** (`tasks`, `projects`, `features/tasks/`):
  - **Ansichten** im Titelmenü „Heute ▾“: Eingang, Heute, Geplant, Projekte,
    Alle Listen. Eine durchgehende Liste mit Abschnittsköpfen; „Überfällig“ ist
    rot und ab drei Aufgaben eingeklappt.
  - **Zeile**: Kreis, „!!“ vor dem Titel, Metazeile nur mit dem, was da ist
    (Zeit · ↻ · Erinnerung · 2/5 · Projekt · Tags).
  - **Abhaken**: Der Kreis hakt nach 1,2 s ab, mit Rückgängig. Nach rechts
    wischen heisst erledigt, nach links **Morgen** · Planen · Löschen.
  - **Verschieben** (`postpone.ts`, getestet): „Morgen“ im Wisch schiebt mit
    einem Tipp auf morgen, die Uhrzeit bleibt, mit „Verschoben: Morgen ·
    Rückgängig“. Der lange Druck hat die Gruppe Heute (nur überfällig) ·
    Morgen · Nächste Woche (nächster Montag) · Datum wählen …. Gerechnet wird
    ab dem echten Heute; bei wiederkehrenden ändert sich nur diese Frist.
  - **Langer Druck**: öffnet das Kontextmenü; Ziehen sortiert um (`order`).
  - **Schnelleingabe**: „+“ öffnet sie über der Tastatur. Die Satz-Erkennung
    (`parse.ts`, getestet) versteht „morgen 14 Uhr“, „jeden Montag“, „!!“,
    „#tag“ und „@Projekt“.
  - **Detail** als Blatt: Datum, Uhrzeit, Erinnerung, Wiederholen (auch ab
    Erledigung), Priorität 0–3 (immer über `priorityOf` lesen), Projekt, Tags,
    Teilaufgaben (`parentId`), Notiz, Bilder.
  - **Speicherung**: Ein Fälligkeitstag liegt als 12:00 Ortszeit
    (`dueAtOfDay`/`dueDayOf`), die Uhrzeit in `dueTime`.
  - **Erinnerungen** werden gespeichert, aber noch nicht zugestellt; dafür
    fehlt `expo-notifications`.
  - **Links**: `/run/tasks?new=1`, `?task=<id>`.
- **Notizen** (`notes`, `noteFolders`, `features/notes/`):
  - **Liste**: nach Datum gruppiert (Angeheftet, Heute, Letzte 7 Tage,
    Monate), Zeilen von 64 pt, Raster je Ordner (`view`). Das Titelmenü
    führt zu Alle Notizen, Ordnern, Tags und „Zuletzt gelöscht“.
  - **Editor**: ein eigener Bildschirm aus Blöcken (`blocks`, je Block ein
    `TextInput`). Die erste Zeile ist der Titel. Kürzel `- `, `1. `, `[] `,
    `# `, `> `; die Werkzeugleiste gibt es nur beim Schreiben.
  - **Speichern** ohne Knopf: Die Notiz entsteht mit dem ersten Zeichen und
    sichert 500 ms nach der letzten Eingabe (`NoteDraft`). Leer verlassen
    verwirft sie. `title` und `body` leitet `noteTextOf` ab.
  - **Tags** sind `#wort` im Text.
  - **Löschen** setzt `deletedAt`; nach 30 Tagen ist die Notiz weg.
  - **Grenzen**: Bilder nur im Browser. Fett und kursiv, Anhänge,
    Sprachaufnahmen und Sperren fehlen, weil sie Pakete brauchen.
  - **Links**: `/run/notes?new=1`, `?note=<id>`, `folder=`, `tag=`, `q=`.
- **Dokumente** (`documents`, `db/organizer.ts`) — Art (Vertrag, Versicherung,
  Garantie, Ausweis, Anderes), Ablaufdatum, Notiz. Was in 60 Tagen abläuft,
  steht oben unter **Läuft bald ab**, Abgelaufenes rot.
- **Gewohnheiten** (`habits`, `habitTicks`) — je Vorsatz eine Karte mit der
  Woche als sieben Punkten; ein Tipp hakt den Tag ab, die Zukunft bleibt
  stumm. Serie (`streakOf`) und Wochenziel (`targetPerWeek`) stehen daneben.
- **Reisen** (`trips`, `packingItems`) — Countdown, Zeitraum, Packliste mit
  Fortschritt und Vorschlägen (Pass, Ladegerät, …), Vergangene blass darunter.
- **Kontakte** (`contacts`) — alle Kontakte. Ein Geburtstag wird über dieselbe
  Räder-Maske gesetzt wie in den Geburtstagen. Im Blatt steht „Heute gesehen“
  (`lastSeenOn`).
- **Geburtstage** (`features/birthdays/`):
  - **Demnächst**, sortiert nach Tagen bis zum Geburtstag:
    - eine grosse Karte nur für heute (Nachricht, Anrufen);
    - „Diese Woche“ mit grossen Zeilen;
    - „Dieser Monat“ und „Später“.
  - **Anlegen** im Blatt: Vorschläge aus den Kontakten, Räder für Tag, Monat
    und Jahr. Das Jahr ist freiwillig: ganz unten auf dem Jahresrad steht „—“
    für ohne Jahr, vorgewählt, gleich unter dem laufenden Jahr.
  - **Person** als eigener Bildschirm, bewusst kurz: Bild, Name, „wird 45 am
    Samstag, 19. September“ (ohne Jahr nur das Datum) und gross die Tage bis
    dahin; „Bearbeiten“ oben rechts öffnet das Blatt (Datum, Geburtstag
    entfernen). Keine Telefonnummer, Notiz, Geschenkideen oder Erinnerungen —
    die Felder `gifts` und `birthdayReminders` bleiben in den Daten, aber ohne
    Oberfläche.
  - **Noch nicht**: der Import aus Kontakten braucht `expo-contacts`.
  - **Links**: `/run/birthdays?new=1`, `?person=<id>`.
- **Wetter** (`features/weather/`), über Open-Meteo ohne Schlüssel:
  - **Orte**: bis 20 (`weatherPlaces`; `weatherPlace` ist immer der erste),
    dazu „Mein Standort“ (ungefähr, nur im Browser).
  - **Aufbau**: eine Seite pro Ort, seitlich blätterbar, unten eine eigene
    Leiste mit Punkten und der Orte-Liste. Der Kopf (96 pt) schrumpft beim
    Scrollen zu einer Zeile.
  - **Flächen** darunter:
    - 24 Stunden, mit einem Satz als Überschrift (`summary.ts`)
    - Regen in den nächsten 2 h (`minutely_15`)
    - 7 Tage mit Tagesblatt
    - Kacheln: UV, Luftqualität (EAQI), Gefühlt, Wind, Feuchtigkeit, Sonne,
      Sicht, Druck
  - **Keine Unwetterwarnungen**: Open-Meteo liefert keine.
  - **Links**: `/run/weather?place=<lat>,<lon>`, `?view=places`.

### Geburtstage liegen bei den Kontakten

Es gibt keine eigene Sammlung: ein Geburtstag ist `ContactRow.birthday`. Die
Funktion Geburtstage, die Kontakte und der Kalender lesen dieselbe Zeile.

- **Eintragen** geht in den Geburtstagen und im Kalender: das „+“ im privaten
  Kalender fragt zuerst „Termin“ oder „Geburtstag“ und öffnet dann nur dieses
  Blatt (`EventEditor` bzw. `BirthdayEditor`), nie beides in einem. Ein
  Geburtstag legt einen Kontakt an oder setzt dessen Datum.
- **Mit Jahr** steht überall „Max wird 45“ (`birthdays.event`), ohne Jahr
  „Max hat Geburtstag“ (`birthdays.eventNoAge`).
- **Im Kalender** stehen Geburtstage jedes Jahr als ganztägiger Eintrag in
  Rosa („Anna wird 36“) — gedacht, nicht gespeichert (`birthdaysBetween` in
  `features/birthdays/birthdays.ts`, Ids `birthday:<kontakt>:<tag>`). Ein Tipp
  darauf öffnet das Geburtstags-Blatt, nicht den Termin-Editor. BetterFamily
  zeigt sie nicht.
- **Entfernen** (`contacts.removeBirthday`) nimmt nur den Geburtstag weg, nie
  den Kontakt. Rückgängig geht über `restoreBirthday`.
- **Ohne Jahr** (`birthYearKnown: false`) steht das Platzhalterjahr 2000 (ein
  Schaltjahr) in `birthday`, und nirgends erscheint ein Alter.
- Wer am 29. Februar geboren ist, feiert in anderen Jahren am 1. März.

Die Startseite zeigt je Funktion das Nächste: was bald abläuft, die Haken von
heute (antippbar), die nächste Reise, wer heute oder morgen feiert. **Ganztägiges**
— Termine ohne Uhrzeit und wer heute Geburtstag hat — steht ganz oben am
Tagesband als **eine Karte mit einer Zeile je Eintrag** (`AllDayLane` in
`features/today/DayThread.tsx`, Daten aus `events.listAllDay`): Farbstreifen
oder Geschenk, Titel, rechts woher. Untereinander, nie als Pillen nebeneinander;
ab vier Einträgen stehen zwei da und „2 weitere“ klappt den Rest auf. Die drei
Plätze im Band gehören dann den Terminen mit Uhrzeit.

Ein **Geburtstag steht nur an seinem Tag im Band** — oben in der
Ganztags-Karte oder unten unter „Morgen“, nie Tage im Voraus (dafür gibt es
die Funktion Geburtstage). Geschenk und „Max wird 45“ (bis zwei Zeilen; ohne
Jahr „Max hat Geburtstag“, `birthdayTitle` in `WorkspaceScreen.tsx`). Kein Kurzwort
rechts, und bei Terminen auch kein „Kalender“ — Symbol und Uhrzeit sagen es.

**Ganz unten im Band** endet der Tag mit einem leicht roten Strich, darunter
der nächste Tag („Morgen“) mit höchstens zwei Einträgen — wer feiert,
Ganztägiges, dann nach Uhrzeit —, die immer blasser werden (`NextDayPeek`).
Das Verblassen ist gewollt und die eine Ausnahme von der Kontrast-Regel: eine
Vorschau, kein Inhalt. Ein Tipp blättert zu diesem Tag.

## BetterGym

`db/gym.ts`, `db/health.ts` und `features/gym/` — sieben Module, Vorbild sind
Hevy und Streaks:

- **Training** (`workouts`, `workoutSets`, `routines`) — **Vorlagen** als Chips
  starten ein Training mit ihren Übungen; im Blatt je Übung die Sätze
  („Satz 1 · 60 kg × 8“), daneben die **Bestleistung** über alle Trainings,
  nach jedem Satz ein **Pausentimer** (90 s). Übungen aus der Liste oder frei.
  Ohne Vorlage: Art (Kraft, Laufen, …) und Dauer.
- **Menüplan** (`meals`) — Mahlzeit, Kalorien, Tagesabschnitt; oben die
  Tagessumme gegen 2000 kcal
- **Trinken** (`drinks`) — zwei Knöpfe (2.5 dl, 5 dl), ein Balken, das letzte
  lässt sich zurücknehmen
- **Schlaf** (`sleeps`) — ins Bett, aufgestanden, wie gut; `sleepMinutes`
  rechnet über Mitternacht. Oben der Schnitt der letzten 7 Nächte, dazu der
  **Tipp aus dem Kalender**: erster Termin morgen minus 9 Stunden.
- **Medikamente** (`meds`, `medTakes`) — je Einnahmezeit ein Chip, ein Tipp
  heisst genommen; der Vorrat zählt mit, unter 5 steht „Nachschub“.
- **Werte** (`vitals`) — Gewicht, Blutdruck, Puls: der letzte Wert gross, der
  Unterschied zum vorletzten, die letzten zehn als Balken.
- **Kopf frei** (`moods`) — ein Wort zur Laune (1–5), ein Satz zum Tag, dazu
  die Atemübung 4-7-8 in vier Runden.

`dayKey(date)` ist der Tagesschlüssel `YYYY-MM-DD`, nach dem gruppiert wird.
Die Startseite zeigt die Zahl des Tages, die letzte Nacht, die nächste offene
Einnahme (antippbar), das letzte Gewicht und die Laune von heute.

## BetterMoney

`db/money.ts` und `features/money/` — vier Module, alle in CHF und je Konto:

- **Budget** (`expenses`, `budgets`) — Ausgaben mit Kategorie und Notiz, oben
  die Monatssumme; wer ein Monatsbudget festlegt, sieht einen Balken und was
  übrig ist (rot, wenn drüber)
- **Rechnungen** (`bills`) — offen nach Fälligkeit, überfällig rot; antippen
  heisst bezahlt. Fälligkeit per Chip: heute, in 7, 14, 30 Tagen
- **Abos** (`subscriptions`) — monatlich oder jährlich; oben, was das im Monat
  und im Jahr macht (Jahresabos anteilig)
- **Sparziele** (`savingsGoals`) — Ziel, Balken, Chips zum Einzahlen; über das
  Ziel hinaus geht es nicht

`monthKey(date)` ist der Monatsschlüssel `YYYY-MM`. Beträge gehen durch
`parseAmount` (`features/money/amount.ts`: Komma oder Punkt, Rappen gerundet)
und werden mit `formatMoney` gezeigt. Löschen nur über den Papierkorb
(`RemoveButton`) in Zeilen, die selbst nicht drückbar sind.

## Navigation

Jede App hat dieselben drei Tabs — **Start**, **Funktionen**, **Profil** —,
GetBetter dazu den **Assistenten**, BetterAi nur **Chat** und **Profil**. Alles
andere (Haushalt, Aussehen, die volle Ansicht einer Funktion) liegt dahinter
als Route. Keine der beiden Übersichten ist ein Kachelbrett.

### Die Startseite (`screens/WorkspaceScreen.tsx`)

In GetBetter: oben Datum (mit Wetter), Gruss und rechts die **Glocke** — kein
Profilknopf, dafür gibt es den Tab
(`features/notifications/NotificationBell.tsx`, Zähler der ungelesenen, führt zu
`/notifications`). Darunter **Was gibt's Neues**
(`features/notifications/NewsSection.tsx`), dann der Tagesstrahl und zuunterst
der **Schnellzugriff** — ein 3D-Karussell der Favoriten mit einer „+“-Karte am
Ende (`features/quick/QuickAccess.tsx`). Unten rechts steht ein „+“
(`FloatingButton` mit Menü), von oben nach unten: Termin, Aufgabe, Notiz,
E-Mail. Es öffnet die Funktion direkt beim Anlegen (`/run/calendar?new=1`,
`/run/tasks?new=1` …). Ein eigenes Eingabefeld
für Aufgaben gibt es auf der Startseite nicht mehr.

**Der Tagesstrahl lässt sich wischen**: nach links kommt morgen, nach rechts
gestern; ein Knopf **Heute** führt zurück. Heute zeigt das Band alles, was die
Startseite weiss. An einem anderen Tag steht nur, was wirklich an diesem Tag
ist: ganztägige Termine und Geburtstage oben, Termine mit Uhrzeit, der Wecker,
der dann klingelt (`AlarmRow.days`), Aufgaben mit Frist an dem Tag und
Rechnungen, die dann fällig sind. Was kein Datum hat — Einkauf, Gewohnheiten,
Reisen, Dokumente — bleibt bei heute, und die Jetzt-Marke fällt weg
(`showNow`).

In den anderen Apps: Gruss und Datum, darunter je Funktion ein Abschnitt mit dem,
was sie gerade weiss — und mit dem, was man direkt tun kann:

| Funktion                      | Was dort steht und geht                             |
| ----------------------------- | --------------------------------------------------- |
| Haushalt (BetterFamily)       | der aktive Haushalt                                 |
| Kalender                      | die nächsten Termine                                |
| Aufgaben                      | offene Aufgaben, antippen hakt ab, Feld zum Anlegen |
| Notizen                       | die letzten drei                                    |
| Wecker                        | der nächste                                         |
| Einkauf                       | offene Posten, antippen erledigt                    |
| Ämtli                         | was ansteht                                         |
| Training / Menüplan / Trinken | die Zahl des Tages                                  |
| Budget / Abos                 | die Summe des Monats                                |
| Rechnungen                    | die nächsten drei, antippen heisst bezahlt          |
| Sparziele                     | die ersten drei mit Stand                           |

Welche Abschnitte erscheinen, sagt `modulesOfApp()`. In GetBetter folgen die
Karten der anderen Better-Apps (`features/apps/AppFamily.tsx`): wo man schon
einmal drin war, stehen feste Felder mit Wert oder „—“; wo nicht, das Logo
blass, ein Satz und ein farbiger **Installieren**-Knopf (`storeUrl`, sonst die
laufende App). Ganz unten steht **Kommt noch** — was diese App führt, aber noch
nicht kann. Nur die Kopfzeile eines Abschnitts führt in die volle Ansicht; die
Zeilen darunter gehören der Funktion. Kein Knopf im Knopf: eine `Card` ist nur
dann drückbar, wenn sie keinen eigenen Knopf enthält — im Browser wäre das
ungültiges HTML und fällt beim Rendern auf.

### Funktionen (`screens/FunctionsScreen.tsx`)

Der zweite Tab zeigt die Funktionen **dieser** App als Zeilen: links Name und
Symbol, rechts, was die Funktion gerade weiss.

Gegliedert wird nach **Thema**, nicht nach Bereich (`ModuleDefinition.topic`,
die Liste `TOPICS` in `mocks/types.ts` ist zugleich die Reihenfolge): Planung,
Kommunikation, Notizen und Ablage, Menschen, Alltag … Vier Bereiche wären ein
langer Block; erst das Thema sagt, warum zwei Funktionen nebeneinander stehen —
der Kalender ist Planung, E-Mail ist Kommunikation. `area` bleibt am Modul für
alles andere.

**Kein Kurztext unter dem Namen** — die zweite Zeile gibt es nur bei einem
Favoriten aus einer anderen App, und dann steht dort deren Name. Auch keine
hervorgehobene Zahl: jeder Wert ist schlichter Text. `BUILT_MODULE_IDS` in
`mocks/modules.ts` ist die eine Stelle, die weiss, was gebaut ist. Nie die
Funktionen anderer Apps.

### Suche (`screens/SearchScreen.tsx`, `features/search/`)

**Ohne Eingabe**
- „Zuletzt gesucht“: die letzten drei, je Konto in AsyncStorage.
- Die Funktionen dieser App.
- Ganz unten **„Andere Better-Apps“**, zugeklappt. Nur hier stehen die
  Funktionen der anderen Apps, grau und nicht tippbar.

**Mit Eingabe** gibt es feste Gruppen, je drei Treffer und dazu „Alle N“:
1. bester Treffer
2. Aufgaben
3. Notizen
4. E-Mails
5. Personen
6. Orte
7. Weitere Einträge (Termine, Einkauf … der anderen Apps)
8. Funktionen

**Ein Treffer öffnet den Eintrag selbst** (`/run/notes?note=<id>` …).

Suche und Gruppen sind reine Funktionen mit Tests (`results.ts`, `recent.ts`).

### Favoriten und Schnellzugriff (`features/quick/`)

**Das sind zwei Listen, nicht eine.** Was man oft braucht, ist nicht dasselbe
wie was man mag:

| Liste             | Am Konto             | Wo man sie sieht                            |
| ----------------- | -------------------- | ------------------------------------------- |
| **Favoriten**     | `account.favorites`  | der Stern in „Bereiche“ und der Tab daneben |
| **Schnellzugriff**| `account.quickAccess`| das Karussell auf der Startseite            |

Beide sind Listen von `appId:moduleId` in der gewählten Reihenfolge, beide
gehen durch dieselben reinen Helfer (`favorites.ts`, getestet) und denselben
Haken (`useFavorites()` bzw. `useQuickAccess()` in `useFavorites.ts`). Eine
Karte ins Karussell zu legen macht daraus **keinen** Favoriten. Die Karten im
Karussell tragen **keinen Stern** — Favoriten setzt man in „Bereiche“ —, und
im „+“-Blatt steht ein Haken statt eines Sterns.

Das „+“ im Karussell zeigt auch die Funktionen **anderer** Better-Apps, aber
nur solcher, in denen das Konto schon angemeldet war (`appAccess.appsOf`). Eine
fremde Funktion öffnet ihre App über `appUrl(app) + 'run/<id>'`.

Das Karussell ist ein horizontales `Animated.ScrollView` und steht auf einem
**Ring, den man von aussen sieht**: jede Karte dreht ihre Aussenkante nach
hinten (ein Schritt sind 24 Grad auf Radius 200), rückt zur Mitte und wird
kleiner. `translateZ` kennt React Native nicht — die Tiefe macht darum die
Grösse. Im Browser rastet das Band selbst ein, weil react-native-web
`snapToInterval` nicht kennt.

## Gesten

Die Apps sind fürs Handy gebaut; wischen geht überall dort, wo man es am
iPhone erwarten würde. Alle Gesten laufen über `PanResponder` (kein
Zusatzpaket) und teilen sich die Masse in `ui/gestures.ts`.

| Geste                                  | Wo                                   | Baustein                |
| -------------------------------------- | ------------------------------------ | ----------------------- |
| Zeile nach rechts wischen → umschalten | erledigt, anheften, gelesen          | `ui/SwipeRow.tsx`       |
| Zeile nach links: halb Aktionen, ganz wegräumen | Planen, Löschen, Archivieren – mit Rückgängig | `ui/SwipeRow.tsx` |
| Langer Druck → Kontextmenü (Android: Auswahl) | Aufgaben, Notizen, Geburtstage, E-Mail | `ui/ContextMenu.tsx` |
| Nach links/rechts → weiter/zurück      | Kalender, Budget, Tagesstrahl        | `ui/useSwipeSteps.ts`   |
| Blatt am Griff/Kopf nach unten wischen | jedes `Sheet`, auch mit `header`     | `ui/Sheet.tsx`          |
| Vom linken Rand nach rechts → zurück   | iOS vom Stapel, im Browser selbst    | `app/EdgeSwipeBack.tsx` |
| Mit der Maus ziehen und werfen         | nur im Browser, alle Rollflächen     | `app/webDragScroll.ts`  |

Ein Blatt lässt sich nur am Griff und an der Kopfzeile herunterziehen, nicht im
Inhalt — dort stecken Felder und das Wecker-Rad. Wer eine eigene Kopfzeile
braucht (X, Titel, Haken), gibt sie als `header` mit. `SwipeRow` meldet das
Löschen auch als Aktion der Bedienungshilfe; bestehende Papierkörbe bleiben.

**Bausteine der Neugestaltung**, alle aus `@/ui`:
- `PlainList`, `SectionHeader` (mit `tone="danger"` für „Überfällig“) und
  `PlainRow`: eine durchgehende Liste statt Karten
- `Sheet` mit `detent` mittel/gross
- `Menu` und `ContextMenu`
- `Header` mit `titleMenu` für den Ansichtswechsel im Titel
- `FloatingButton` mit `text` und `menu`
- `useUndo()` für die Leiste „Rückgängig“ (5 s; `UndoProvider` sitzt in
  `RootShell`)

Löschen, Archivieren und Abhaken fragen nicht nach, sie lassen sich
zurücknehmen. Eine Rückfrage kommt nur, wo nichts mehr zurückgeht.

Der Zustand einer Geste lebt in einer kleinen Klasse, die per
`useState(() => new …)` einmal entsteht — die React-Compiler-Regeln verbieten
`useRef(…).current` im Rendern und Mutationen an Zustandswerten. Die neueste
Rückruffunktion reicht ein Effekt über eine Methode nach (`setOnDelete`).

Das Wecker-Rad (`features/alarm/AlarmEditor.tsx`) hat kein Ende: die Zahlen
stehen mehrmals hintereinander, und in Ruhe springt das Rad unsichtbar in die
mittlere Runde zurück.

## Mitteilungen (`features/notifications/`, `db/notifications.ts`)

Eine Mitteilung ist eine Zeile `NotificationRow` (Art, Titel, Text, `ref`,
`readAt`). `title` und `body` sind Daten (Name, Kalendername, Betreff) — den
Satz baut die Oberfläche je Art mit `t()`. Angelegt werden sie dort, wo etwas
passiert: Kalender-Freigabe angefragt (`shares.requestByUsername`), in einen
Kalender eingeladen (`calendars.invite`), per Benutzername in einen Haushalt
eingeladen (`households.inviteByUsername`) — und vom Dienst für neue E-Mails.
Wird eine Anfrage anderswo beantwortet oder zurückgezogen, räumt
`removeByRef` die Mitteilung weg. Scheitert das Anlegen, bleibt die Einladung
trotzdem bestehen.

| Wo                        | Anfrage             | E-Mail                         | Sonst               |
| ------------------------- | ------------------- | ------------------------------ | ------------------- |
| Was gibt's Neues          | Annehmen / Ablehnen | Gesehen / Löschen (Papierkorb) | Gelesen / Weg damit |
| Glocke (`/notifications`) | Annehmen / Ablehnen | Gesehen / Löschen              | Gelesen = weg       |

„Gelesen“ in Was gibt's Neues setzt `readAt`: die Mitteilung bleibt in der
Glocke. „Weg damit“ löscht sie ganz. In der Glocke heisst gelesen weg. Nach
links wischen löscht, bei E-Mails die E-Mail selbst. Leer: „Keine Neuigkeiten“.

## E-Mail (`features/mail/`, `db/mail.ts`, `services/api/mail/`)

Beliebig viele Postfächer, wahlweise einzeln oder alle zusammen. Verbunden wird
mit Adresse und Passwort über IMAP/SMTP — die Maske fragt nur diese zwei ab,
keine Server, Ports, Benutzernamen oder Anzeigenamen; der Dienst erkennt den Anbieter
(`mail/providers.js`), prüft die Anmeldung live und legt das Passwort
**verschlüsselt** ab (AES-256-GCM, Schlüssel `<datenordner>/mail.key`, Tresor
`mail-vault.json` — nie in `db.json`, nie in einer Antwort).

**Ordner** (`mail/folders.js`): sechs Rollen — Posteingang, Gesendet, Entwürfe,
Spam, Papierkorb, Archiv. Welcher Ordner welche Rolle hat, sagt erst SPECIAL-USE
(RFC 6154), dann der Name, auch in modifiziertem UTF-7 (`INBOX.Gel&APY-scht` ist
der Papierkorb). Gmails „All Mail“ gilt bewusst **nicht** als Archiv.

Der Abgleich (`mail/sync.js`) läuft alle 2 Minuten über **alle** Ordner und
merkt sich je Ordner UIDVALIDITY und letzte UID in `mail-state.json`: der
Posteingang holt 50 und behält 100, die übrigen 25 und 40. Gelesen, Fahne
(`\Flagged`) und beantwortet (`\Answered`) kommen mit. Anhänge liest
`mail/structure.js` aus der BODYSTRUCTURE — Name, Typ und Grösse, **kein Byte
des Inhalts**, dazu die Teilnummer (`part`) und die Content-ID. Text ohne HTML.
Mitteilungen gibt es nur für neue ungelesene im **Posteingang**; Spam meldet
sich nicht. Zeilen einer älteren Fassung holt der Abgleich einmal nach (nur
Kopfzeilen und BODYSTRUCTURE, die Ids bleiben).

**Unterhaltungen** (`mail/threads.js`): jede Zeile trägt `inReplyTo`,
`references`, `bcc` und `threadId` (`th_…`). Die Wurzel ist `references[0]`,
sonst die Kette der `inReplyTo`, sonst die eigene Message-ID; ohne diese
Kopfzeilen zählt der Betreff ohne `Re:`/`AW:`/`Fwd:`/`WG:`/`TR:` plus eine
gemeinsame Adresse. Berechnet über alle Postfächer eines Kontos, darum steht die
eigene Antwort aus „Gesendet“ in derselben Unterhaltung. Mail-Mitteilungen
tragen `threadId` in `ref`.

**Inhalt und Anhänge kommen auf Nachfrage**, nie in `db.json` (das geht an jede
App): `GET …/messages/:id/body` holt Text und HTML per `BODY.PEEK`, legt sie
unter `<datenordner>/mail-cache/` ab (400 Dateien, je Teil 300 KB) und säubert
das HTML bei jeder Anfrage mit `mail/sanitize.js` — Liste erlaubter Tags und
Attribute, eigener Tokenizer, entfernte Bilder als Platzhalter, bis `images=1`.
`GET …/attachments/:index` fliesst entschlüsselt durch: Bilder und PDF inline,
alles andere als Download, HTML/SVG/XML nie mit ihrem Typ. `db/mail.ts` hat
`fetchBody` (macht Bild-Adressen absolut) und `attachmentUrl`.

**Senden mit Rückgängig** (`mail/outbox.js`): mit `delayMs` (bis 20 s) wartet
die Mail **im Dienst** — die App darf geschlossen werden, auch ein Neustart des
Dienstes verliert sie nicht — und lässt sich bis dahin mit
`POST …/send/:sendId/cancel` aufhalten (`409 already_sent`, wenn es zu spät ist).
`bcc` steht nur in der eigenen Kopie. Weiterleiten (`forwardOf`) hängt Kopf und
Text zitiert an, **ohne die Anhänge**. Scheitert eine verzögerte Mail, wird sie
Entwurf und es gibt eine Mitteilung `system` mit `ref.reason: 'mailSendFailed'`.

**Entwürfe** (`mail/drafts.js`): `POST /v1/mail/drafts` legt per APPEND mit
`\Draft` in den Entwurfsordner und ersetzt mit `draftId` die vorige Fassung
(erst die neue ablegen, dann die alte expungen). `draftId` ist ein Griff des
Dienstes oder die Id einer Zeile im Entwurfsordner. Nach dem Abgleich sind
Entwürfe gewöhnliche Zeilen mit `folderRole: 'drafts'`.

Die Oberfläche (`features/mail/`, verdrahtet in `MailView.tsx`), Vorbild Gmail
und Apple Mail:

- **Einstieg:** Wer E-Mail öffnet, landet in der **Postfächer-Übersicht**
  (Alle Posteingänge, je Postfach die Ordner), nicht in einem Posteingang.
  Ohne verbundenes Postfach kommt gleich die Einrichtung; `?message=<id>`
  öffnet die Unterhaltung, Zurück führt dann in den Posteingang.
- **Posteingang:**
  - Sammel-Posteingang, chronologisch, gebündelt nach `threadId`
    (`threads.ts`).
  - Oben: „‹ Postfächer“ und „…“ (Auswählen, Vorschauzeilen 0/1/2). Der Titel
    ist der Ordner.
  - Zeile: Ungelesen-Punkt, Absender, Anzahl in der Unterhaltung, Zeit,
    Betreff mit Büroklammer, Vorschau. Kein Bild.
  - Unten rechts „Schreiben“, unten links der Filter (Ungelesen · Markiert ·
    Mit Anhang · An mich · Heute) mit einer Pille zum Aufheben.
- **Gesten:**
  - Nach rechts wischen schaltet gelesen/ungelesen.
  - Nach links, halb: „Mehr“ und Löschen.
  - Nach links, ganz: archivieren (ohne Archiv löschen, im Papierkorb nach
    Rückfrage endgültig).
  - Rückgängig gleicht erst ab, sucht die Mail über `messageId` im Zielordner
    und verschiebt sie zurück.
  - Langer Druck öffnet das Kontextmenü, auf Android die Auswahl.
- **Postfächer:** Alle Posteingänge, je Postfach die Ordner mit Zahlen, darunter
  „Postfächer verwalten“. Über den Ordnern steht die Adresse klein geschrieben
  mit einem Klappsymbol direkt daneben; ein Tipp klappt die Ordner dieses
  Postfachs auf oder zu (`MailboxToggle`). Der Zustand liegt in `MailView`,
  damit er beim Hin und Zurück aus einem Ordner bleibt.
- **Unterhaltung** (Vollbild):
  - ˄ ˅ springen zur nächsten Unterhaltung; jede Nachricht hat Kopf und
    „an mich ▾“, ab vier Nachrichten sind die mittleren gebündelt.
  - Das HTML steht im Browser in einem iframe mit `sandbox` ohne Skripte und
    einer strengen CSP, auf dem Gerät nur als Text. Die Höhe ist geschätzt,
    weil das iframe nicht messbar ist.
  - Blockierte Bilder lassen sich nachladen. Anhänge stehen als Kacheln mit
    Vorschau.
  - Leiste unten: Archivieren · Verschieben · Antworten · Markieren · Löschen.
  - Gelesen gilt erst nach 1 s.
- **Schreiben** (Blatt, gross):
  - An als Tokens, eine Zeile „Cc/Bcc, Von“.
  - Entwürfe sichern alle 2 s (`DraftSaver`).
  - Nach unten wischen minimiert zu einer Leiste.
  - Gesendet wird mit 5 s Verzögerung („Gesendet · Rückgängig“).
  - Vorschläge für Adressen kommen aus bisherigen Mails, weil Kontakte keine
    E-Mail-Adresse führen.
- **Links:** `/run/mail?compose=1`, `?message=<id>`.
- **Die Handgriffe** laufen über **eine** Route (`POST /v1/mail/messages/actions`
  mit `{ids, action, role}`, bis 100 Nachrichten): je Postfach eine Verbindung,
  je Ordner ein SELECT und ein UID-Set.
- **Grenzen:**
  - Suche auf dem Server (IMAP SEARCH), eigene Ordner, Anhänge beim Senden und
    Weiterleiten, HTML beim Senden und eine Signatur gibt es nicht. Die
    Oberfläche sagt es, wo es auffällt. Outlook/Hotmail/Live/Microsoft 365 nur mit
  OAuth (`oauth_required`). Gmail, Yahoo und iCloud brauchen ein App-Passwort,
  GMX und web.de eingeschaltetes IMAP. Ohne Zugriffstoken liest jeder, der Port
  8090 erreicht, die abgeholten Mails — nur für die Entwicklung.

## Die Bilder (`scripts/icons.js`)

Alle Logos sind **echte PNGs**, erzeugt aus dem, was im Code steht: Farbe aus
`theme/modules.ts`, Symbol aus `mocks/modules.ts` und `ui/Icon.tsx` (Ionicons,
MIT), die Apps aus `app/identity.ts`. Ein Logo ist ein abgerundetes Quadrat
mit Farbverlauf, einem Lichtbogen und weissem Symbol.

```
packages/core/src/assets/modules/<id>.png, <id>-mono.png   je Funktion, 256 px
packages/core/src/assets/apps/<app>.png, <app>-mono.png     je App, 256 px
packages/core/src/assets/index.ts                           die require()-Tabelle
apps/<app>/assets/                                          Store-Icon 1024 px,
                                                            Android-Ebenen, Splash, Favicon
```

`ui/ModuleIcon.tsx` und `ui/AppIcon.tsx` zeigen diese Bilder (in
„schwarzweiss“ die graue Fassung) und zeichnen die Form nur dann selbst, wenn es
zu einer Id kein Bild gibt. Grössen: `sm` 28 in Listen, `md` 44 auf Karten,
`lg` 64 im Raster, `xl` 88 auf der Startseite.

Farbe oder Symbol ändern heisst: im Code ändern, `node scripts/icons.js`
laufen lassen, die Bilder mit einchecken. Nie ein Bild von Hand in `assets/`
legen.

**Hintergründe** erzeugt `node scripts/backdrops.js` prozedural (ohne Download,
wiederholbar byte-gleich): `assets/backgrounds/<key>.jpg` (1080 × 1920) und
`<key>-thumb.jpg` für die Auswahl — hell `mist`, `lake`, `forest`, `dunes`,
`snow`, `bloom`, `paper`, dunkel `dusk`, `moon`, `aurora`, `night`, `ink`.
`paper` und `ink` sind schlicht Weiss und Schwarz, für alle, die hinter der App
gar kein Motiv wollen. Die Tabelle steht in `theme/backdrops.ts`. Metro sieht
neue Bilddateien manchmal erst, wenn man sie einmal neu schreibt.

## Intro, Anmelden und Einrichten (`features/intro/`, `features/onboarding/`)

Ein Avatar führt durch alles (`ClubAvatar.tsx`): 44 Stücke fliegen aus
berechneten Startpunkten zusammen, er dreht sich, schwebt und blinzelt; bei
reduzierter Bewegung wird er nur eingeblendet. Farben aus dem Theme.

`progress` ist dabei eine Bahn mit **drei** Punkten: 0 verstreut, 1 am Platz,
2 im Ziel. Zusammensetzen läuft 0 → 1, Zerfallen 1 → 2 — dieselbe Zahl in zwei
Richtungen. `gazeOnly` lässt nur den Blick wandern, ohne den Körper zu bewegen.

**Den Avatar wählt man selbst** (`features/avatar/`, am Konto
`assistantAvatar` = `{ kind, color, eyes, accessory }`):

- **Figur:** Roboter (Vorgabe), Knuddel, Katze, Eule, Geist — je Figur eine
  Datei in `kinds/`, alle aus denselben Stücken, damit Zusammensetzen, Drehen,
  Blinzeln und Zerfallen überall gleich laufen.
- **Farbe:** „Wie die App“ (folgt dem Akzent) und sieben feste Töne; jede geht
  durch die Kontrast-Helfer (`tones.ts`, getestet über alle Modi, Akzente und
  Voreinstellungen). In Schwarzweiss ist jede Farbe Tinte.
- **Augen** (rund, fröhlich, müde, funkelnd) und **Accessoire** (keins,
  Antenne, Hut, Brille, Schleife; die Antenne nicht bei Katze und Eule).
- **Wo:** Einstellungen → Assistent → „Avatar“ (Blatt mit grosser Vorschau,
  speichert bei jedem Tipp) und beim Einrichten der Schritt nach dem Namen.
  Vor dem Anmelden steht immer der Roboter.
- **Prüfung:** `normalizeAvatar` liest tolerant; der Dienst
  (`services/api/avatar.js`) nimmt nur genau diese vier Felder mit bekannten
  Werten, sonst `400 avatar_invalid`. Die erlaubten Werte stehen doppelt, ein
  Test merkt, wenn sie auseinanderlaufen.

Im **leeren Assistenten** steht er über dem Gespräch
(`features/assistant/AssistantAvatar.tsx`) und schaut umher; sobald man etwas
abschickt, zerfällt er wellenförmig und fliegt in die eigene Nachricht. Bei
reduzierter Bewegung blendet er nur aus.

**Er redet laut mit** (`features/intro/narration.ts`, `narrator.ts`,
`NarrationButton.tsx`): auf dem Startbildschirm, beim Anmelden und
Registrieren, beim Einrichten und bei „Kennst du dich schon aus?“ sagt er, was
in seiner Blase steht — einmal je Satz, nie beim Tippen, eine Drittelsekunde
nach dem Erscheinen. Vor dem ersten Tipp auf der Seite erlauben Browser keinen
Ton (`navigator.userActivation`); solange bittet der Startbildschirm darum
(„Antippen, dann rede ich mit dir“). Der Lautsprecher neben der Blase schaltet
ihn stumm, und das bleibt so (`AsyncStorage`). Ohne Konto spricht die beste
Stimme des Browsers, mit Konto `assistantVoice`.

- **Erstes Öffnen (alle Apps, `StartScreen`):** „Bist du schon Mitglied im
  Better-Club?“ — darunter die Pille zum Einloggen, der zweite Weg zum
  Registrieren, eine „oder“-Linie und zwei runde Anbieter-Knöpfe (Apple und
  Google sagen ehrlich, dass sie mit den Store-Apps kommen). Anmelden und
  Registrieren teilen sich `features/auth/AuthShell.tsx` und zeigen den kleinen
  Avatar mit eigener Sprechblase.
- **Registrieren (`features/auth/SignUpForm.tsx`):** E-Mail, **Benutzername**,
  Passwort, Passwort wiederholen. Der Benutzername steht also schon hier fest;
  die Form prüft `^[a-z0-9][a-z0-9._-]{2,23}$` (dieselbe Regel in
  `auth/accounts.ts` und im Dienst), und ob er frei ist, sagt beim Tippen
  `fetchByUsername`. Das letzte Wort hat der Dienst: `username_taken` → 409,
  `username_invalid` → 400, beim Anlegen **und** beim späteren Ändern.
- **Nach dem Einloggen:** `IntroLayer` in `RootShell` — der Avatar dreht sich
  weg, die App fliegt an, dann „Kennst du dich mit der App schon aus?“ (Ja /
  Tutorial). Nur wenn nach dem Laden ein Konto dazukommt, nie beim Neustart.
- **Nach dem Registrieren (GetBetter):** ein Gespräch in Schritten
  (`SetupScreen.tsx`), das er auch laut spricht. Darum zuerst seine **Stimme** (`assistantVoice`, ein `voiceURI` aus
  `speechSynthesis` — der Schritt fällt weg, wo es nichts zu wählen gibt), dann
  der **Spitzname** (`firstName` — nur, wie die App dich anspricht, nicht der
  Benutzername), der **Name des Assistenten** (`assistantName`), sein
  **Avatar** (Figur und Farbe), Personalisieren (Modus, Akzent, Voreinstellung, Hintergrund), „Kennst du dich
  schon aus?“ — dann `completeOnboarding`. Sobald man einmal weiter ist, stehen
  die Schritte fest, auch wenn der Browser die Stimmen erst später nachreicht.
  Die anderen Apps laufen beim Registrieren wie beim Einloggen. Alles davon
  ändert man später in den Einstellungen.
- **Tutorial (`Tutorial.tsx`):** wischbare Karten — in GetBetter Heute,
  Schnellzugriff, Bereiche & Favoriten, Mitteilungen, E-Mail, Wischen und der
  Assistent mit seinem Namen.

## Einstellungen und Aussehen

`/settings` (`screens/SettingsScreen.tsx`, aus dem Profil, in jeder App) ist die
**eine** Stelle, an der sich alles ändern lässt. `/appearance` gibt es nur noch
als Weiterleitung dorthin — zwei Oberflächen fürs selbe wären zwei Wahrheiten.

| Bereich      | Was darin steht                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| Konto        | Spitzname, Benutzername, E-Mail (fest), Sprache, Mitglied seit                   |
| Darstellung  | Modus, Voreinstellung, Akzentfarbe, Hintergrund                                   |
| Assistent    | sein Name (`assistantName`), seine Stimme und sein Avatar, in BetterAi ausgeblendet |
| Haushalt     | nur in BetterFamily: der aktive Haushalt und Beitreten                            |
| App          | Version und Abmelden                                                              |

Der Aufbau: oben eine **Profilkarte** (Bild, Spitzname, `@name` und E-Mail, dazu
„Profil bearbeiten“), darunter je Thema eine Karte mit Zeilen — jede mit ihrem
Zeichen links und ihrem Wert rechts, ganz unten **Abmelden** in Rot. Ein Tipp
auf eine Zeile öffnet das Blatt dazu: ein Feld
(`features/personalize/AccountFieldSheet.tsx`), eine Auswahl, der `StylePicker`
oder der `BackdropPicker`. Die Bausteine stehen in `SettingsList.tsx`
(`SettingsProfile`, `SettingsGroup`, `SettingsList`, `SettingsRow`) und werden
auch vom Profil genutzt.

**Spitzname und Benutzername sind zwei Dinge.** Der Spitzname (`firstName`) ist
nur, wie die App dich anspricht. Der Benutzername (`username`) ist die Kennung,
unter der andere dich finden — er muss einmalig sein, und darüber entscheidet
der Dienst: `changeUsername` (`auth/accounts.ts`) schreibt **erst** dorthin und
nur bei einem Ja in die Abschrift. Sonst stünde in der App ein Name, den es beim
Dienst nicht gibt. `checkUsername` fragt vorher, damit die Maske früh etwas sagt.

Die drei Regler des Aussehens liegen am Konto und gelten damit in allen Apps:

|                |                                                                      |
| -------------- | -------------------------------------------------------------------- |
| Modus          | Hell, Dunkel oder dem Gerät folgen                                   |
| Voreinstellung | `clean` ruhig, `colorful` jede App in ihrer Farbe, `mono` ohne Farbe |
| Akzentfarbe    | Die Töne aus `ACCENTS`, in Schwarzweiss ohne Wirkung                 |
| Hintergrund    | App-Bild, eines aus `BACKDROPS` oder ein eigenes (`upload:<id>`)     |

`ui/Screen.tsx` nimmt den Hintergrund vom Konto — in allen Apps gleich —, mit
einem Verlauf in der Papierfarbe darüber, damit Text lesbar bleibt. Wie viel
Papier es sein muss, ist **gemessen**, nicht geschätzt (`theme/backdrops.ts`:
`veil` je Bild, `APP_BACKDROP_VEILS`, `MISMATCH_VEIL`, `UPLOAD_VEIL`, fünf
Stufen von oben nach unten): an den schlechtesten 2 % der Bildpunkte jeder
Höhe erreicht `textMuted` 4.5:1 und `textFaint` 3:1 — überall, weil der Inhalt
über das stehende Bild rollt. Wer ein Bild tauscht, misst neu. Ein eigenes
Bild wird im Browser per Canvas auf 1280 px verkleinert und an `/v1/uploads`
geschickt; am Handy fehlt dafür noch `expo-image-picker`
(`features/personalize/pickImage.ts` sagt das ehrlich).

Jedes Modul hat eine eigene Farbe (`theme/modules.ts`); `moduleTint(theme, id)`
und `hueTint(theme, hue)` machen daraus die gezeichnete Fassung eines Logos.

## Veröffentlichen

Jede App ist für den Store vorbereitet:

- `app.json` — Name, `version` 1.0.0, `ios.bundleIdentifier` und
  `android.package` `ch.better.<slug>`, Splash in der App-Farbe, adaptive
  Android-Icons, Favicon. `buildNumber` / `versionCode` je Release erhöhen.
- `eas.json` — Profile `development`, `preview`, `production`.
- `EXPO_PUBLIC_API_URL` beim Bauen setzen: das ist die eine Stelle, an der aus
  dem Entwicklungsdienst der echte wird.
- Sobald eine App im Store ist, ihren `packageName` in `APPS` eintragen — dann
  führt der Installieren-Knopf in GetBetter dorthin.

```bash
cd apps/getbetter
EXPO_PUBLIC_API_URL=https://api.example.ch eas build --profile production
```

## Regeln

- **Keine rohen Zahlen.** Abstand, Schriftgrösse, Farbe und Radius kommen aus
  `useTheme()`.
- **Genug Kontrast, in jeder Kombination.** Schrift mindestens 4.5:1, Ringe,
  Punkte, Balken und Umrandungen 3:1 — über hell/dunkel, alle Akzente und alle
  Voreinstellungen, dazu Bereichs- und Terminfarben. `theme/contrast.test.ts`
  rechnet jede Kombination durch; `ensureContrast` und `readableOn` aus
  `@/theme` ziehen neue Farben nach.
  - `accent` ist nur **Fläche**, mit `textOnAccent` darauf.
  - Zeigt die Farbe allein etwas an (heute, gewählt, erledigt, Fortschritt,
    Schalter, ungelesen), gilt `accentMark` — beim hellen Signalgrün ein
    kräftigeres Grün, sonst der Akzent selbst.
  - Schrift in Akzentfarbe auf Papier ist `accentStrong` (`tone="accent"`).
  - Auf `inverse` steht nur `onInverse`.
  - Umrandungen von Bedienelementen (Kreis, Häkchen) sind `textFaint`, nicht
    `borderStrong`.
  - Wo nur Farbe unterscheidet, kommt eine Form dazu, etwa der Punkt unter
    „heute“ im Wochenstreifen.
- **Kein Text im Code.** Jeder sichtbare String geht durch `t('key')` — auch
  Name, Kurztext und Beschreibung einer Funktion (`module.<id>.name` in
  `i18n/de-modules.ts`, gelesen über `moduleName(t, id)` aus
  `mocks/moduleText.ts`). Grosse Funktionen führen ihre Texte in eigenen
  Dateien (`i18n/de-mail.ts`, `de-news.ts`, `de-quick.ts`, `de-intro.ts`,
  `de-personalize.ts`, `de-voice.ts` …), die `de.ts` per Spread einsammelt.
- **Vier Sprachen, alle vollständig.** Deutsch, Englisch, Französisch und
  Italienisch. `en.ts`, `fr.ts` und `it.ts` setzen sich aus Teilen zusammen
  (`en-a.ts`, `en-b.ts`, `en-c.ts`, `en-voice.ts` …) und sind als
  `Record<TranslationKey, string>` getippt: ein neuer deutscher Schlüssel
  ohne Übersetzung ist ein Typfehler, und `i18n/catalogue.test.ts` prüft
  zusätzlich, dass kein Schlüssel fehlt oder zu viel ist und Platzhalter wie
  `{name}` überall gleich stehen. Wer die Sprache wechselt, sieht die ganze App
  sofort in der neuen. Du-Form: `tu` auf Französisch und Italienisch.
  Umlaute ausschreiben — „Ämtli“, nicht „Aemtli“.
- **Datum und Zahlen über `Intl`.** Helfer in `i18n/format.ts`, Schweizer Locale.
- **Daten kommen aus `db/repositories.ts`** (und `db/gym.ts`, `db/households.ts`,
  …), gelesen über `useLiveQuery`.
- **Kein Bildschirm greift direkt auf den Speicher zu** — immer über ein
  Repository.
- **Was alle Apps teilen, gehört in den Kern.** In `apps/<name>/app` steht nur,
  was an dieser App wirklich anders ist.
- **Blätter rollen.** `Sheet` legt seinen Inhalt in eine `ScrollView` und im
  Browser in den Telefonrahmen. Dort nie `flex: 0` schreiben, wo eine Höhe
  gelten soll — daraus wird `flex-basis: 0%`, und das Blatt fällt zusammen.
- **Kein leerer Bildschirm.** Wo nichts ist, steht ein `EmptyState`.
- **Kein Knopf im Knopf.** Eine drückbare `Card` enthält keinen `Button`.
- **Im Web ohne Warnungen.** `boxShadow` statt `shadow*`, `pointerEvents` im
  Stil statt als Prop.
- **Unveränderlich.** Zustand wird kopiert, nie mutiert.
- **TypeScript strict**, inklusive `noUncheckedIndexedAccess`. `npm run typecheck`
  und `npm run lint` müssen sauber sein, bevor etwas als fertig gilt.
- **`services/api/data/` bleibt draussen.** Die Datei enthält Passwort-Hashes
  und gehört nie ins Git.
