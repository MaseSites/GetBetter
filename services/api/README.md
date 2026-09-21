# Datenbank-Dienst

Alle Better-Apps sprechen mit diesem Dienst: Konten, die Daten aller Apps,
Mitteilungen, eigene Bilder und verbundene E-Mail-Postfächer. Node ohne
Fremdbibliotheken.

```bash
npm run server      # aus dem Projektstamm, Port 8090
npm test            # prüft auch services/api/**/*.test.js
```

| Umgebungsvariable         | Standard            | Wofür                                                                 |
| ------------------------- | ------------------- | --------------------------------------------------------------------- |
| `PORT`                    | `8090`              | Port des Dienstes                                                     |
| `BETTER_DATA_DIR`         | `services/api/data` | Datenbank, Bilder, Mail-Tresor und Abgleich-Zustand                   |
| `BETTER_MAIL_SYNC_MS`     | `120000`            | Takt des Mail-Abgleichs, `0` schaltet ihn ab                          |
| `BETTER_MAIL_ALLOW_PLAIN` | —                   | Nur für Tests: `1` erlaubt unverschlüsselte Verbindungen zu 127.0.0.1 |
| `ELEVENLABS_API_KEY`      | —                   | Schlüssel für echt klingende Stimmen (sonst `elevenlabs.key`)         |
| `BETTER_SPEECH_MODEL`     | `eleven_multilingual_v2` | Modell von ElevenLabs, z.B. `eleven_flash_v2_5` (schneller, günstiger) |
| `BETTER_ELEVENLABS_URL`   | —                   | Nur für Tests: ein nachgebauter Dienst auf `http://127.0.0.1:<port>`  |
| `BETTER_SPEECH_CACHE_FILES` | `2000`            | Höchstens so viele gesprochene Sätze im Zwischenspeicher (Proben zählen nicht) |
| `BETTER_SPEECH_CACHE_MB`  | `200`               | und höchstens so viele Megabytes                                      |
| `BETTER_SPEECH_MONTHLY_CREDITS` | `10000`       | Kontingent von ElevenLabs im Monat, für den Admin (Gratis-Plan: 10’000) |
| `SAFESWISSCLOUD_API_KEY`  | —                   | Schlüssel für die KI bei Safe Swiss Cloud (sonst `safeswisscloud.key`) |
| `SAFESWISSCLOUD_API_URL`  | —                   | Eigene Basisadresse, `https://…/v1` (sonst `safeswisscloud.url`)      |
| `BETTER_AI_MODEL_CHEAP`   | `gemma4-31b`        | Modell der günstigen Stufe                                            |
| `BETTER_AI_MODEL_CHAT`    | `gpt-oss-120b`      | Modell für Gespräche und Coaching                                     |
| `BETTER_AI_MODEL_REASONING` | `deepseek-v4-flash` | Modell für Pläne und Analysen (BetterAi, BetterGym)                 |
| `BETTER_AI_MODEL_VISION`  | `gemma4-31b`        | Modell für Fragen mit Bild                                            |
| `BETTER_AI_TEST_URL`      | —                   | Nur für Tests: ein nachgebauter Anbieter auf `http://127.0.0.1:<port>` |
| `BETTER_ADMIN_PORT`       | `8091`              | Port des Admins, nur auf `127.0.0.1`; `0` schaltet ihn ab             |
| `BETTER_AI_MONTHLY_MINIMUM_CHF` | `95`          | Mindestbetrag im Monat bei Safe Swiss Cloud, für die Kosten im Admin  |
| `BETTER_PRICE_<APP>_CHF`  | GetBetter `1`, BetterFamily `3`, BetterGym `5`, BetterAi `8`, BetterMoney — | Abo im Monat inkl. MwSt, z.B. `BETTER_PRICE_BETTERMONEY_CHF=4`; nur Zahlen über 0 |
| `BETTER_VAT`              | `0.081`             | Mehrwertsteuer als Anteil                                             |
| `BETTER_STORE_FEE`        | `0.15`              | Gebühr von App Store / Google Play als Anteil                         |
| `BETTER_USER_SHARE`       | `0.75`              | Anteil der Nettoeinnahmen, den ein zahlendes Konto verbrauchen darf   |
| `BETTER_TRIAL_BUDGET_CHF` | `0.10`              | Gratis-Kontingent je App und Monat ohne Abo                           |
| `BETTER_SPEECH_USD_PER_1K_CHARS` | `0.10`       | Was 1000 Credits von ElevenLabs höchstens kosten (bewusst zu hoch)    |
| `BETTER_USD_CHF`          | `0.92`              | Wechselkurs für die Stimmen                                           |
| `BETTER_SPEECH_MONTHLY_FIXED_USD` | `0`         | Monatsgebühr des ElevenLabs-Plans, für die Marge im Admin             |

Im Datenordner (nie ins Git):

```
db.json            alle Sammlungen
uploads/<id>.<ext> eigene Bilder
mail.key           32 Zufallsbytes, der Schlüssel des Tresors
mail-vault.json    die Mail-Passwörter, verschlüsselt
mail-state.json    je Postfach und Ordner UIDVALIDITY und letzte UID
mail-cache/        Text und HTML geöffneter Mails (<id>.json), höchstens 400 Dateien
mail-drafts.json   Griffe der gesicherten Entwürfe: Ordner, UID, Message-ID
mail-outbox.json   verzögerte Mails, bis sie hinaus sind (fertig gebaut, ohne Passwort)
elevenlabs.key     der Schlüssel für ElevenLabs, eine Zeile (optional)
speech-cache/      gesprochene Sätze als MP3 (<id>.mp3), höchstens 2000 Dateien / 200 MB
speech-cache/index.json   je Datei Hits, zuletzt gespielt, Zeichen, Bytes, Zweck — nie ein Text
speech-cache/samples/     die Proben der Stimmen, werden nie aufgeräumt
speech-usage.jsonl Verbrauch der Stimmen, eine JSON-Zeile je Wiedergabe oder Erzeugung
speech-usage.1.jsonl die vorige Fassung, sobald speech-usage.jsonl über 5 MB wuchs
safeswisscloud.key der Schlüssel für die KI bei Safe Swiss Cloud, eine Zeile (optional)
safeswisscloud.url die eigene Basisadresse dort, eine Zeile, z.B. https://…/v1 (optional)
ai-usage.jsonl     Verbrauch und Kosten jeder KI-Anfrage, eine JSON-Zeile je Anfrage
ai-usage.1.jsonl   die vorige Fassung, sobald ai-usage.jsonl über 5 MB wuchs
activity.jsonl     was mit den Konten geschah (Anmelden, Profil, Änderungen), eine JSON-Zeile je Ereignis
activity.1.jsonl   die vorige Fassung, sobald activity.jsonl über 5 MB wuchs
```

## Routen

Antworten sind JSON, Fehler `{ "error": "<schlüssel>" }`. Jede Änderung erhöht
die Revision, damit die Apps neu laden.

| Route                                  |                                                                  |
| -------------------------------------- | ---------------------------------------------------------------- |
| `GET /v1/health`                       | Läuft er?                                                        |
| `GET /v1/db`                           | Alles, ohne Passwort-Hashes                                      |
| `GET /v1/revision`                     | Hat sich etwas geändert?                                         |
| `PUT /v1/db/:collection`               | Eine Sammlung ersetzen — nicht die vier des Dienstes (`403`)     |
| `POST /v1/accounts`                    | Registrieren — `{ email, password, username? }`                  |
| `POST /v1/sessions`                    | Anmelden — `{ email, password }`; gesperrt → `403 account_disabled` |
| `GET /v1/accounts/:id`                 | Konto lesen                                                      |
| `GET /v1/accounts/by-username/:name`   | Konto über den Benutzernamen finden                              |
| `PATCH /v1/accounts/:id`               | Spitzname, Sprache, Benutzername, Aussehen, Assistent, Hintergrund — ohne Abo nur der Modus (`403 plan_required`) |
| `POST /v1/notifications`               | Mitteilung anlegen                                               |
| `POST /v1/notifications/:id/read`      | Als gelesen markieren                                            |
| `DELETE /v1/notifications/:id`         | Löschen                                                          |
| `POST /v1/notifications/remove-by-ref` | Alle mit `ref[key] === value` löschen                            |
| `POST /v1/uploads`                     | Bild hochladen (data-URL)                                        |
| `GET /v1/uploads/:id`                  | Bild ausliefern                                                  |
| `DELETE /v1/uploads/:id`               | Bild löschen                                                     |
| `GET /v1/mail/providers?email=`        | Servereinstellungen zu einer Adresse                             |
| `POST /v1/mail/accounts`               | Postfach verbinden (prüft die Anmeldung live)                    |
| `DELETE /v1/mail/accounts/:id`         | Postfach trennen, samt Nachrichten, Mitteilungen, Passwort       |
| `POST /v1/mail/sync`                   | Alle Postfächer eines Kontos abgleichen                          |
| `POST /v1/mail/messages/:id/seen`      | Gelesen/ungelesen, auch auf dem Server                           |
| `POST /v1/mail/messages/:id/delete`    | In den Papierkorb des Postfachs                                  |
| `POST /v1/mail/messages/actions`       | `{ ids, action, role }` — gelesen, Fahne, verschieben, löschen   |
| `GET /v1/mail/messages/:id/body?images=0\|1` | `{ html, text, remoteImages, inlineAttachments }` — gesäubert |
| `GET /v1/mail/messages/:id/attachments/:index` | ein Anhang als Bytes, höchstens 25 MB                    |
| `POST /v1/mail/send`                   | senden: sofort, verzögert, als Antwort oder Weiterleitung        |
| `POST /v1/mail/send/:sendId/cancel`    | verzögerte Mail aufhalten                                        |
| `GET /v1/mail/send/:sendId`            | `{ sendId, state, sendAt, error }`                               |
| `POST /v1/mail/drafts`                 | Entwurf sichern oder ersetzen → `{ draftId }`                    |
| `DELETE /v1/mail/drafts/:id`           | Entwurf endgültig löschen                                        |
| `POST /v1/view/redeem`                 | `{ ticket }` → `{ account, app }` — genau einmal, sonst `404 not_found` |
| `GET /v1/speech/status?accountId=&app=` | `{ provider, configured, lastError, allowed, plan, reason }` — nie der Schlüssel |
| `GET /v1/speech/voices?language=`      | Stimmen des ElevenLabs-Kontos, wer die Sprache spricht zuerst    |
| `POST /v1/speech`                      | `{ text, voice, language, accountId?, app? }` → `{ id, url }`    |
| `POST /v1/speech/sample`               | `{ voice, language, accountId?, app? }` → `{ id, url }` — der Satz kommt vom Dienst |
| `GET /v1/speech/<id>.mp3?play=<ticket>` | das Audio, im Strom oder aus dem Zwischenspeicher               |
| `GET /v1/ai/status`                    | `{ provider, configured, models, lastError }` — nie Schlüssel oder Adresse |
| `POST /v1/ai/reply`                    | `{ accountId, app, messages, voice?, imageUploadId? }` → Antwort der günstigsten passenden Stufe |
| `GET /v1/ai/budget?accountId=&app=`    | `{ plan, budgetChf, spentChf, remainingShare, resetsOn, priceChf }` |
| `GET /v1/plans?accountId=&app=`        | `{ app, priceChf, plan, canPersonalize, request: 'pending'\|null, pricedApps }` |
| `POST /v1/plans/requests`              | `{ accountId, app }` → `201 { request }`, offen schon da → `200` dieselbe |

Den genauen Vertrag (Felder, Fehlerschlüssel) halten die Zeilentypen in
`packages/core/src/db/types.ts` fest.

## Mitteilungen, Bilder, Profil

- `notifications`, `mailAccounts`, `mailMessages` und `planRequests` gehören
  dem Dienst. Apps lesen sie über `GET /v1/db` und schreiben nur über die Routen
  oben.
- `title` und `body` einer Mitteilung sind Daten (Name, Betreff), keine Sätze.
  `kind` ist `calendarShare`, `calendarInvite`, `householdInvite`, `mail`,
  `system`, `planApproved` oder `planDeclined` (die letzten zwei legt der Admin
  an: `title` ist der Name der App, `ref` `{ app, requestId }`); `ref` hält nur
  Texte.
- Bilder: `data:image/jpeg|png|webp;base64,…`, höchstens 5 MB. Die ersten Bytes
  müssen zum Typ passen. Fehler: `bad_request`, `unsupported_type`,
  `too_large` (413), `not_found` für ein unbekanntes Konto.
- Anfragen dürfen bis 10 MB gross sein.

## E-Mail

Postfächer werden über IMAP gelesen und über SMTP beschickt — beides von Hand
in `mail/` gebaut:

```
mail/connection.js  TLS, STARTTLS, Zeitlimit (20 s), Fehler -> Schlüssel
mail/imap.js        IMAP4rev1-Client mit Literalen, MOVE oder COPY+EXPUNGE, APPEND
mail/smtp.js        465 TLS oder 587 STARTTLS, AUTH PLAIN/LOGIN, Nachricht bauen
mail/mime.js        Header, RFC 2047, multipart, base64, quoted-printable, HTML zu Text
mail/providers.js   Vorlagen der Anbieter
mail/vault.js       AES-256-GCM-Tresor für Passwörter
mail/folders.js     Ordnerrollen über SPECIAL-USE, sonst über den Namen
mail/structure.js   BODYSTRUCTURE lesen: Teile mit Nummer, Anhänge mit Name, Typ, Grösse, Content-ID
mail/threads.js     Unterhaltungen: threadId aus References, In-Reply-To, sonst Betreff
mail/sync.js        Abgleich je Postfach und Ordner
mail/sanitize.js    HTML säubern: Liste erlaubter Tags und Attribute, eigener Tokenizer
mail/transfer.js    base64 und quoted-printable im Strom entschlüsseln
mail/bodies.js      HTML auf Nachfrage samt Zwischenspeicher, Anhänge ausliefern
mail/compose.js     References einer Antwort, Betreff und Zitat einer Weiterleitung
mail/drafts.js      Entwürfe ablegen, ersetzen, löschen
mail/outbox.js      verzögertes Senden, übersteht einen Neustart
mail/service.js     die Routen
```

**Verbinden.** Die Anmeldung wird sofort geprüft. Fehler: `bad_request`,
`already_connected`, `auth_failed`, `unreachable`, `tls_failed`, `timeout`,
`oauth_required`. Bei `auth_failed` kommt für Anbieter mit Hinweis zusätzlich
`note` mit (`app_password` oder `enable_imap`). Danach läuft im Hintergrund der
erste Abgleich.

**Abgleich** (alle Ordner mit Rolle): der Posteingang holt 50 und behält 100,
Gesendet, Entwürfe, Spam, Papierkorb und Archiv je 25 und 40. Zustand —
UIDVALIDITY und letzte UID — steht je **Ordner** in `mail-state.json`. Danach
neue UIDs, frische Flags (gelesen, `\Flagged`, `\Answered`), auf dem Server
Gelöschtes fällt weg; wechselt UIDVALIDITY, wird dieser Ordner neu aufgebaut.
Ein Ordner, den der Server ablehnt, bleibt stehen, statt zu verschwinden. Text
ohne HTML und auf 20 000 Zeichen gekürzt (abgerufen werden höchstens 200 KB je
Mail); Anhänge nur als Kopfdaten, nie ihr Inhalt. Nur neue ungelesene Mails im
**Posteingang** werden zu Mitteilungen, höchstens 20 je Lauf — Spam meldet sich
nicht. `lastSyncAt`, `lastError` und `folders` stehen am Postfach. Ein Lauf ohne
Änderung erhöht die Revision nicht.

Je Nachricht stehen zusätzlich `inReplyTo` (Message-ID oder `null`),
`references` (höchstens 20: die Wurzel und die jüngsten), `bcc` (nur in
Entwürfen und eigenen Kopien) und `threadId`; je Anhang `part` (IMAP-Nummer
wie `1.2`) und `contentId` (ohne `<>`). Zeilen einer älteren Fassung holt der
Abgleich einmal nach — nur Kopfzeilen und BODYSTRUCTURE, die Ids bleiben.
Mitteilungen zu neuen Mails tragen `threadId` in `ref`.

**Unterhaltungen** (`threads.js`). `threadId` ist `th_` und 24 Hex-Zeichen aus
der Wurzel: erst `references[0]`, sonst die Kette der `inReplyTo` durch die
bekannten Mails, sonst die eigene Message-ID. Eine Antwort ohne diese Kopfzeilen
gehört zur ältesten bekannten Mail mit gleichem Betreff (ohne
`Re:`/`AW:`/`Fwd:`/`Fw:`/`WG:`/`TR:`) und einer gemeinsamen fremden Adresse;
sonst ist die Id ein Hash aus Betreff und sortierten Adressen. Berechnet wird
über alle Postfächer eines Kontos — die eigene Antwort unter „Gesendet“ landet
in derselben Unterhaltung. Nach jedem Abgleich neu, darum kann eine Id wechseln,
wenn eine fehlende Mail der Kette auftaucht.

**Inhalt.** `GET /v1/mail/messages/:id/body` holt Text- und HTML-Teil per
`BODY.PEEK` (die Mail bleibt ungelesen; je Teil höchstens 300 KB) und legt sie
roh unter `mail-cache/<id>.json` ab — höchstens 400 Dateien, die am längsten
nicht geöffneten gehen zuerst. Gesäubert wird bei jeder Anfrage
(`sanitize.js`): erlaubt ist nur eine Liste von Tags und Attributen; `script`,
`style`, `iframe`, `object`, `svg`, `math`, `template` samt Inhalt raus, `form`,
`button`, `input`, `link`, `meta`, `base`, `embed` ohne Inhalt; keine
`on…`-Attribute; `style` nur ohne `url(`, `expression`, andere Funktionen als
`rgb`/`hsl`/`calc`/`min`/`max`/`clamp` und ohne `position` ausser
`static`/`relative`; Links nur `http(s):`, `mailto:`, `tel:`, immer mit
`target="_blank" rel="noopener noreferrer"`; `data:` nur für PNG, JPEG, GIF,
WebP. Entfernte Bilder zählen in `remoteImages` und werden ohne `images=1` zu
einem durchsichtigen GIF mit `data-remote-image="1"`; `cid:`-Bilder zeigen auf
`/v1/mail/messages/:id/attachments/:index` (root-relativ), ihre Nummern stehen in
`inlineAttachments`. Was sich nicht lesen lässt, wird als Text maskiert.
Fehler: `not_found` (404, auch wenn die Mail auf dem Server fehlt oder
UIDVALIDITY wechselte), `auth_failed`, `unreachable`, `tls_failed`, `timeout`
(400).

**Anhänge.** `GET /v1/mail/messages/:id/attachments/:index` — `index` wie in
`attachments` — fliesst entschlüsselt vom Mailserver durch, ohne ganz im
Speicher zu liegen. PNG, JPEG, GIF, WebP und PDF kommen `inline`, alles andere
als `attachment`; HTML, SVG, XML und JavaScript nie mit ihrem Typ, sondern als
`application/octet-stream`. Immer `X-Content-Type-Options: nosniff`, ausser bei
PDF eine `Content-Security-Policy` mit `sandbox`, der Dateiname ohne Pfad und
Steuerzeichen (`filename` ASCII, `filename*` UTF-8). Fehler: `not_found` (404),
`too_large` (413, über 25 MB), sonst wie beim Inhalt; bricht der Mailserver
mittendrin ab, endet die Antwort ohne Fehlermeldung.

**Senden.** Reiner Text in UTF-8 (quoted-printable), Betreff und Namen nach
RFC 2047, Zeilenumbrüche in Headern werden entfernt. `POST /v1/mail/send`
nimmt `{ mailAccountId, to, cc?, bcc?, subject, text, inReplyTo?, forwardOf?,
draftId?, delayMs? }`. Antworten (`inReplyTo`: Id der Zeile) tragen
`In-Reply-To` und `References` = deren `references` plus ihre Message-ID.
Weiterleiten (`forwardOf`, nie zusammen mit `inReplyTo`): leerer Betreff wird
`Fwd: <Betreff>`, unter den eigenen Text kommen Kopf und Text der Mail mit `> `.
**Anhänge werden nicht weitergeleitet**, nur der Text. `bcc` geht an SMTP, steht
aber nur in der Kopie unter „Gesendet“, die der Dienst ablegt — ausser bei
Gmail, das macht es selbst. Mit `draftId` wird der Entwurf gelöscht, sobald die
Mail hinaus ist.

`delayMs` 0 (Standard) sendet sofort: `200 { ok: true }`. 1–20 000: die Mail
wartet im Dienst (`mail-outbox.json`, übersteht einen Neustart) und die Antwort
ist `202 { sendId, sendAt }`. `POST /v1/mail/send/:sendId/cancel` → `200
{ cancelled: true }` solange sie wartet (auch ein zweites Mal), `409
already_sent` wenn sie unterwegs oder hinaus ist, `404 not_found` für
Unbekanntes. `GET /v1/mail/send/:sendId` → `{ sendId, state, sendAt, error }`
mit `state` `pending`, `sending`, `sent`, `failed` oder `cancelled`, zehn Minuten
lang. Scheitert eine verzögerte Mail — oder war sie beim Absturz gerade
unterwegs —, sichert der Dienst sie als Entwurf und legt eine Mitteilung
`kind: 'system'` an: `title` Betreff, `body` Empfänger, `ref` `{ reason:
'mailSendFailed', sendId, mailAccountId, error, draftId? }`. Fehler beim Senden:
`bad_request`, `not_found`, `auth_failed`, `unreachable`, `tls_failed`,
`timeout`, `send_failed` (400).

**Entwürfe.** `POST /v1/mail/drafts` `{ accountId, mailAccountId, to, cc?, bcc?,
subject, text, inReplyTo?, draftId? }` legt die Mail per APPEND mit
`\Draft \Seen` in den Ordner mit Rolle `drafts` und antwortet `{ draftId }`.
Mit `draftId` — einem Griff von vorher oder der Id einer Zeile im
Entwurfsordner — wird erst die neue Fassung abgelegt, dann die alte per UID
gelöscht und expunged; ein Griff behält seine Id. Die UID kommt aus APPENDUID,
sonst aus `UID SEARCH HEADER Message-ID`. Eine unbekannte `draftId` legt einfach
neu an. `DELETE /v1/mail/drafts/:id` löscht endgültig. Nach dem nächsten
Abgleich stehen Entwürfe als gewöhnliche Zeilen mit `folderRole: 'drafts'`.
Fehler: `bad_request` (400), `not_found` (404), `folder_missing`, `auth_failed`,
`unreachable`, `tls_failed`, `timeout` (400).

| Anbieter                             | IMAP                    | SMTP                          | Hinweis        |
| ------------------------------------ | ----------------------- | ----------------------------- | -------------- |
| GMX (.ch .net .de .at .com)          | imap.gmx.net:993        | mail.gmx.net:465              | `enable_imap`  |
| WEB.DE                               | imap.web.de:993         | smtp.web.de:587 STARTTLS      | `enable_imap`  |
| Gmail, Googlemail                    | imap.gmail.com:993      | smtp.gmail.com:465            | `app_password` |
| Yahoo                                | imap.mail.yahoo.com:993 | smtp.mail.yahoo.com:465       | `app_password` |
| iCloud (icloud.com, me.com, mac.com) | imap.mail.me.com:993    | smtp.mail.me.com:587 STARTTLS | `app_password` |
| Outlook, Hotmail, Live, MSN          | —                       | —                             | `oauth_only`   |
| Bluewin                              | imaps.bluewin.ch:993    | smtps.bluewin.ch:465          |                |
| Sunrise                              | imap.sunrise.ch:993     | smtp.sunrise.ch:587 STARTTLS  |                |
| Posteo                               | posteo.de:993           | posteo.de:465                 |                |
| mail.ch                              | imap.mail.ch:993        | smtp.mail.ch:465              |                |
| alles andere                         | imap.&lt;domain&gt;:993 | smtp.&lt;domain&gt;:465       |                |

Verbindungen gehen immer über TLS oder STARTTLS mit Zertifikatsprüfung. Wer
eigene Server angibt, kann Hosts, Ports und `imapSecure`/`smtpSecure`
übersteuern.

### Passwörter

Mail-Passwörter liegen AES-256-GCM-verschlüsselt in `mail-vault.json`, der
Schlüssel in `mail.key` (beim ersten Gebrauch erzeugt). Sie stehen nie in
`db.json`, nie in einer Antwort und nie im Log. Geht `mail.key` verloren,
lassen sich die Passwörter nicht mehr lesen — dann die Postfächer neu
verbinden. Wer Datenordner und Schlüssel zusammen hat, hat auch die
Passwörter: der Tresor schützt vor einem Blick in `db.json`, nicht vor
jemandem mit Zugriff auf den Rechner.

## Stimmen (ElevenLabs)

`speech/service.js` spricht mit `api.elevenlabs.io`; die Apps sehen den
Schlüssel nie. Er kommt aus `ELEVENLABS_API_KEY` oder aus
`<datenordner>/elevenlabs.key` und wird bei jeder Anfrage neu gelesen — ein
neuer Schlüssel braucht keinen Neustart. Im Konto bei ElevenLabs braucht er die
Rechte **Text to Speech** und **Voices (lesen)**.

**Ablauf.** `POST /v1/speech` prüft Text (1–1000 Zeichen), Stimme und Sprache
(`de`, `fr`, `it`, `en`) und merkt sich den Auftrag fünf Minuten; die Id ist ein
Hash aus Modell, Stimme, Sprache und Text. `GET /v1/speech/<id>.mp3` holt das
Audio über den Streaming-Endpunkt (`mp3_44100_128`) und reicht es weiter,
während es ankommt — der Text steht nie in einer Adresse. Fertiges Audio kommt
nach `speech-cache/`; derselbe Satz wird danach von dort geliefert.
`language_code` geht nur an Modelle, die ihn kennen (Flash, Turbo, v3).

**Fehler** (502, im Status als `lastError`): `auth_failed`, `quota_exceeded`,
`rate_limited`, `voice_not_found`, `not_allowed`, `too_long`, `unreachable`,
`speech_failed`. Ohne Schlüssel `503 not_configured`.

**Wer spricht.** `accountId` (1–100 Zeichen, eine Angabe, keine Anmeldung) und
`app` (eine der fünf Apps) sind freiwillig; alles andere wird `null`. Die
Antwort-Adresse trägt ein Einmal-Ticket (`?play=`, 24 Hex-Zeichen, fünf Minuten
gültig): nur die erste Wiedergabe damit zählt als Hit und kommt ins Protokoll.

**Proben.** `POST /v1/speech/sample` nimmt nur Stimme und Sprache (unbekannt →
`de`); der Satz steht im Dienst (`SAMPLE_TEXT`: „Hallo, so klinge ich.“,
„Hi, this is how I sound.“, „Salut, voici ma voix.“, „Ciao, ecco come
suono.“ — nie mit Namen, dieselben wie `assistant.voice.sampleAnon` in der
App), ein mitgeschickter `text` zählt nicht. Die Id hat ein eigenes Zeichen
und trifft nie denselben Wortlaut als gewöhnlichen Satz. Erzeugt wird beim
ersten Anhören, danach liegt die Probe in `speech-cache/samples/` und kostet
niemanden mehr etwas — auch nach einem Neustart.

**Zwischenspeicher** (`speech/cache.js`). Die Id ist ein Hash aus Modell,
Stimme, Sprache und dem Satz; für den Hash werden Leerraum (auch geschützte
Leerzeichen), typografische Anführungszeichen („“ „ « » ‘ ’), Apostrophe und
Striche (– — −) vereinheitlicht und NFC normalisiert. Gross/klein und
Satzzeichen bleiben; zu ElevenLabs geht der Satz, wie er kam. `index.json`
hält je Datei `{ hits, lastPlayedAt, characters, bytes, purpose }` und wird
nacheinander und atomar geschrieben (unter Windows mit kurzen Wiederholungen,
falls gerade jemand liest). Über `BETTER_SPEECH_CACHE_FILES` oder
`BETTER_SPEECH_CACHE_MB` fallen die gewöhnlichen Sätze mit den wenigsten Hits
zuerst, bei Gleichstand die am längsten nicht gespielten — nie der eben
erzeugte, nie eine Probe. Fehlt der Index oder ist er kaputt, entsteht er aus
den Dateien neu (hits 0, `lastPlayedAt` = Änderungszeit).

**Verbrauch** (`speech/usage.js`). Jede Erzeugung und jede Wiedergabe mit
gültigem Ticket wird eine Zeile in `speech-usage.jsonl`:

```json
{ "at": "2026-09-14T08:00:00.000Z", "accountId": "acc_…", "app": "getbetter",
  "purpose": "speech", "model": "eleven_multilingual_v2", "voiceId": "…",
  "characters": 32, "credits": 32, "cached": false, "ok": true, "error": null }
```

`credits` = Zeichen × 1 (Flash und Turbo × 0.5); aus dem Zwischenspeicher
`cached: true, credits: 0`, abgelehnt 0, abgebrochen nachdem ElevenLabs schon
lieferte `ok: false` mit den Credits. Nie der Text, der Schlüssel oder eine
Adresse. Über 5 MB wird die Datei zu `speech-usage.1.jsonl`. Lesen:
`readSpeechUsage(dataDir, { from?, to?, accountId?, app? })`,
`summarizeSpeech(entries)` → `{ total, byApp, byAccount, byDay }` mit je
`{ requests, errors, cached, characters, credits, savedCredits, samples,
sampleCredits }` (`characters` nur erzeugte, `savedCredits` was die Sätze aus
dem Speicher sonst gekostet hätten).

## KI (Safe Swiss Cloud)

`ai/service.js` spricht mit „Private AI“ von Safe Swiss Cloud — Modelle in der
Schweiz, OpenAI-kompatibel: `POST <basisadresse>/chat/completions` mit
`Authorization: Bearer <schlüssel>`. Jede Kundin bekommt eine eigene
Basisadresse und einen eigenen Schlüssel. Beide kommen aus
`SAFESWISSCLOUD_API_KEY` / `SAFESWISSCLOUD_API_URL` oder aus
`safeswisscloud.key` / `safeswisscloud.url` im Datenordner und werden bei jeder
Anfrage neu gelesen. Die Adresse muss `https://` sein (ohne Zugangsdaten,
Abfrage oder Anker; ein `/` am Ende stört nicht). Beide stehen nie in einer
Antwort, im Log oder in `ai-usage.jsonl`. `configured` heisst: Schlüssel **und**
Adresse sind da.

**Routen** (`ai/router.js`, ohne Modellaufruf — das Routen kostet nichts). Aus
der letzten Nachricht wird eine Absicht, daraus die günstigste Stufe:

| Absicht        | Woran erkannt (de/ch, en, fr, it)                 | Stufe                                             |
| -------------- | ------------------------------------------------- | ------------------------------------------------- |
| `vision`       | ein Bild ist dabei                                 | `vision_model`                                    |
| `command`      | kurzer Auftrag: „trag … ein“, „zeig“, „add“, „ajoute“, „aggiungi“ | `cheap_model`                     |
| `simple_query` | Kalorien, Rechnen, „wann/wo/wer …?“               | `cheap_model`                                     |
| `coaching`     | Tipps, Motivation, besser werden                  | `chat_model`                                      |
| `planning`     | Plan, Analyse, Vergleich, Schritt für Schritt; in BetterAi/BetterGym auch Eingaben über 600 Zeichen | `reasoning_model` in BetterAi und BetterGym, sonst `chat_model` |
| `conversation` | alles andere                                      | `chat_model`; in GetBetter, BetterFamily, BetterMoney `cheap_model`, bis der Text über 280 Zeichen oder der Verlauf über 6 Züge hat |

Höchstlänge der Antwort in Zeichen (ohne / mit Stimme): günstig 600 / 300,
Chat 1500 / 600, Bild 1200 / 600, Denken 3000 / 900. `max_tokens` ist ein
Drittel davon (mindestens 64), `temperature` 0.4 (Denken 0.2), Zeitlimit 30 s
(Denken 60 s).

| Stufe             | Standardmodell      | CHF je Mio. Tokens (ein / aus) |
| ----------------- | ------------------- | ------------------------------ |
| `cheap_model`     | `gemma4-31b`        | 0.136 / 0.374                  |
| `chat_model`      | `gpt-oss-120b`      | 0.133 / 0.531                  |
| `reasoning_model` | `deepseek-v4-flash` | 0.168 / 0.451                  |
| `vision_model`    | `gemma4-31b`        | 0.136 / 0.374                  |

Tauschbar mit `BETTER_AI_MODEL_CHEAP`, `…_CHAT`, `…_REASONING`, `…_VISION`.
Safe Swiss Cloud verlangt mindestens CHF 95 im Monat.

**`POST /v1/ai/reply`** nimmt `{ accountId, app, messages, voice?,
imageUploadId? }`: `app` ist eine der fünf Apps, `messages` 1–20 Züge
`{ role: 'user' | 'assistant', text }` (1–4000 Zeichen), der letzte von der
Person. Mitgeschickt werden ein Systemtext (Sprache der letzten Nachricht,
„du“/„tu“, Höchstlänge; mit Stimme nur gesprochene Sätze; in den App-Assistenten
nie behaupten, etwas getan zu haben) und die letzten 12 Züge — beginnend mit
der Person, zwei Züge derselben Rolle werden einer. `imageUploadId` ist ein
Bild aus `/v1/uploads`; es geht als data-URL an das Vision-Modell.

Antwort `200 { selected_model, model, intent, response, voice_text?,
estimated_cost_level }`. `response` ist ohne `<think>…</think>` und
`reasoning_content`, gekürzt am letzten Satzende vor der Höchstlänge (sonst an
einer Wortgrenze mit „…“). `voice_text` gibt es nur mit `voice: true`: ohne
Markdown, Listen, Links und Emojis, höchstens so lang wie `response` und 1000
Zeichen (die Grenze von `/v1/speech`). `estimated_cost_level` ist `low`,
`medium` oder `high`.

**Fehler:** `400 bad_request`, `404 account_not_found`, `404
upload_not_found`, `503 not_configured`, `502 auth_failed` (401/403 beim
Anbieter), `429 rate_limited`, `504 timeout`, `502 unreachable`, `502
upstream_failed` (alles andere, auch eine leere Antwort), `402
budget_exhausted` und `403 plan_required` (siehe „Abo und Kontingent“, beide mit
`{ error, plan, resetsOn, priceChf }`). Fehler des Anbieters stehen als
`lastError` im Status.

**Verbrauch** (`ai/usage.js`). Jede Anfrage an `/v1/ai/reply` — auch eine
gescheiterte — wird eine Zeile in `ai-usage.jsonl`:

```json
{ "at": "2026-09-14T08:00:00.000Z", "accountId": "acc_…", "app": "getbetter",
  "tier": "cheap_model", "model": "gemma4-31b", "intent": "command",
  "voice": false, "ok": true, "error": null, "promptTokens": 1000,
  "completionTokens": 500, "costChf": 0.000323, "durationMs": 840 }
```

Tokens kommen aus `usage` der Antwort des Anbieters; `costChf` rechnet
`PRICES` (CHF je Mio. Tokens, auf sechs Stellen), unbekannte Modelle oder
fehlende Tokens geben `null`. `tier`, `model` und `intent` sind `null`, wenn
es nie bis zum Routen kam. Nie ein Nachrichtentext, der Schlüssel oder die
Adresse. Über 5 MB wird die Datei zu `ai-usage.1.jsonl` (die vorige fällt weg).
Lesen: `readUsage(dataDir, { from?, to?, accountId?, app? })` (`from`
einschliesslich, `to` ausschliesslich, kaputte Zeilen fallen weg),
`summarizeUsage(entries)` → `{ total, byApp, byAccount, byTier, byDay }` mit
je `{ requests, errors, promptTokens, completionTokens, tokens, costChf }`
(Tage in UTC). Zu sehen ist das im Admin unter `/api/costs` und `/api/overview`.

## Abo und Kontingent

`billing/` begrenzt, was KI und Stimmen je **Konto, App und Monat** kosten
dürfen — damit der Betreiber nie draufzahlt. Der Monat ist der Kalendermonat in
Zürich (`billing/month.js`; `2026-09-30T22:30Z` zählt schon zum Oktober).

```
billing/plans.js    Preise, MwSt, Storegebühr, Anteil, Gratis-Kontingent; planOf, budgetOf (rein)
billing/month.js    Monat in Zürich, wann er wieder voll ist (rein)
billing/costs.js    Kosten je Zeile, schlimmster Fall einer KI-Anfrage, Summen je App und Konto (rein)
billing/ledger.js   Kassenbuch im Speicher: aus den Protokollen gebaut, wächst mit jeder Zeile, Reservierungen
billing/service.js  Stand eines Kontos, GET /v1/ai/budget
billing/entitlement.js  Was ohne Abo gesperrt ist: lockedChangesOf, keepLockedFields (rein)
billing/requests.js     Abo-Anfragen: GET /v1/plans, POST /v1/plans/requests, Entscheid im Admin
```

**Budget.** Zahlend: `preis / 1.081 × 0.85 × 0.75` — BetterAi 8.– → 4.72,
BetterGym 5.– → 2.95, BetterFamily 3.– → 1.77, GetBetter 1.– → 0.59 CHF (auf
sechs Stellen abgerundet). Übrig bleiben immer mindestens 25 % der
Nettoeinnahmen. Ohne Abo 0.10 CHF je App. BetterMoney hat noch keinen Preis und
ist darum immer Gratis.

**Wer zahlt.** `paidApps` (App-Ids) am Konto setzt nur der Admin — `PUT
/v1/db/accounts` behält den gespeicherten Wert, `PATCH /v1/accounts/:id`
übergeht ihn. Später soll ein Kaufbeleg aus dem Store es setzen; die Prüfung
steht an einer Stelle (`planOf`).

**Personalisieren.** Ein Abo irgendeiner App mit Preis genügt
(`canPersonalize` in `billing/plans.js`; `pricedApps` sind die Apps mit Preis).
Ohne Abo sind `accentKey`, `themePreset`, `backdrop`, `assistantAvatar`,
`assistantName` und `assistantVoice` gesperrt (`billing/entitlement.js`),
`themeMode` nie: `PATCH /v1/accounts/:id` mit einem gesperrten Feld, das sich
wirklich ändert, antwortet `403 { error: 'plan_required', fields }` und schreibt
nichts aus der Anfrage. `PUT /v1/db/accounts` behält für solche Konten die
gespeicherten Werte der gesperrten Felder und wirft Mitgeschicktes weg — ein
neues Konto bringt keine mit. Gespeichertes wird nie gelöscht; mit einem Abo
gilt es wieder.

**Abo anfragen** (bis es den Kauf im Store gibt). Sammlung `planRequests`,
Zeile `{ id: 'plr_…', accountId, app, status: 'pending'|'approved'|'declined',
createdAt, decidedAt }`, dem Dienst (`PUT` → `403 server_owned`).

- `GET /v1/plans?accountId=&app=` → `{ app, priceChf, plan, canPersonalize,
  request, pricedApps }`; `400 bad_request`, `404 account_not_found`.
- `POST /v1/plans/requests { accountId, app }` (keine weiteren Felder) →
  `201 { request: { id, app, status, createdAt, decidedAt } }`; eine offene
  Anfrage gibt es je Konto und App nur einmal (`200` mit derselben). `400
  bad_request`, `400 plan_unavailable` (App ohne Preis), `404
  account_not_found`, `409 already_paid`. Im Verlauf `plan.requested { app }`.
  Im Nur-Lesen-Modus `403 read_only` wie jede Änderung.
- Entschieden wird im Admin (`POST /api/plan-requests/:id/approve|decline`).

**Kosten.** KI: `costChf` aus `ai-usage.jsonl` (fehlt er, aber es gibt Tokens:
der teuerste bekannte Preis). Stimme: `credits × BETTER_SPEECH_USD_PER_1K_CHARS /
1000 × BETTER_USD_CHF`, aus dem Zwischenspeicher 0. Das Kassenbuch liest beim
ersten Gebrauch den laufenden Monat aus beiden Protokollen (so stimmt es nach
einem Neustart) und bucht danach jede neue Zeile im Speicher dazu.

**KI** (`POST /v1/ai/reply`), vor jedem Aufruf bei Safe Swiss Cloud:

- Ohne Abo antwortet immer die günstige Stufe (Nachdenken und Chat werden
  `cheap_model`, mit dessen Höchstlänge); ein Bild gibt `403 plan_required`.
- Kein Rest mehr → `402 budget_exhausted`, ohne Aufruf.
- Sonst der schlimmste Fall: Eingabe-Tokens geschätzt (Zeichen ÷ 2, je
  Nachricht 8, je Bild 2000) plus `max_tokens` × Ausgabepreis. `max_tokens`
  (bei denkenden Modellen samt Denkzuschlag) wird so klein, dass das
  hineinpasst; unter 150 Ausgabe-Tokens (denkend 150 + 1024) → `402`.
- Der schlimmste Fall wird vor dem Aufruf **reserviert** und nach dem Buchen der
  echten Zeile freigegeben — parallele Anfragen überschreiten das Budget so nie.
  Läuft eine Anfrage ins Zeitlimit, bleibt der Betrag bis zum Neustart gebucht.

**Stimmen** (`POST /v1/speech`, `POST /v1/speech/sample`): ohne Abo für diese
App — oder ohne Konto, etwa vor dem Anmelden — `403 plan_required`, auch aus dem
Zwischenspeicher. Mit Abo kostet ein Satz aus dem Speicher nichts und geht
immer; ein neuer nur, wenn er ins Budget passt, sonst `402 budget_exhausted`.
Der Betrag wird mit dem Ticket reserviert und nach der Wiedergabe verrechnet.
Erzeugt wird nur mit gültigem Ticket. `GET /v1/speech/status?accountId=&app=`
sagt `allowed` und `reason` (`plan_required`, `budget_exhausted`), damit die App
dann die Stimme des Browsers nimmt.

`accountId` ist weiterhin eine Angabe, keine Anmeldung (siehe unten).

## Nur ansehen

Der Admin öffnet eine App mit den Daten eines Kontos, nur zum Lesen
(`viewTickets.js`): `POST /api/accounts/:id/view { app }` im Admin stellt ein
Einmal-Ticket aus (32 Zufallsbytes, 60 Sekunden, nur im Speicher des Prozesses),
die App lädt `http://localhost:<port>/?view=<ticket>` und löst es mit `POST
/v1/view/redeem` ein. Danach schickt sie bei jeder Anfrage `X-Better-View: 1`;
der Dienst lehnt dann alles ausser `GET`/`HEAD` (und dem Einlösen) mit `403
read_only` ab. Das ist eine zweite Sicherung — keine Anmeldung: wer den Port
erreicht, kann ohne diese Kopfzeile ohnehin alles.

## Admin

`admin/server.js` ist eine Seite mit kleiner JSON-Schnittstelle für die
Entwicklung: Konten sperren, Apps wegnehmen, Passwort neu setzen, Konten
löschen, Aktivität und KI-Kosten ansehen. Er läuft **im Prozess des Dienstes** auf
`http://127.0.0.1:8091` (`BETTER_ADMIN_PORT`, `0` = aus) und schreibt über
`store.js` — die Apps sehen jede Änderung mit der nächsten Revision. Nach
Änderungen am Dienst **neu starten**, sonst gibt es den Admin nicht. Ist der
Port belegt, startet nur der Admin nicht; die Datenbank läuft weiter.

```
admin/server.js    HTTP, Sicherheit, Ändern
admin/queries.js   Übersicht, Konten, Aktivität, Kosten (nur lesen)
admin/catalog.js   Apps, Funktionen je App und ihre Sammlungen (spiegelt identity.ts)
admin/deletion.js  Konto löschen als reiner Plan: was wegfällt, was sich ändert, welche Bilder frei werden
admin/public/      index.html und die .js/.css der Seite — fehlt index.html, antwortet `/` mit 503
activity.js        activity.jsonl schreiben, lesen, Änderungen je Konto zählen
auth.js            Passwort-Hash, Benutzernamen — für Dienst und Admin
```

**Sicherheit.** Es gibt **keine Anmeldung**: wer an diesen Rechner kommt, kann
den Admin benutzen — nur für die Entwicklung.

- lauscht nur auf `127.0.0.1`, nie im Netz
- `Host` muss genau `127.0.0.1:<port>` oder `localhost:<port>` sein, sonst `403`
  (gegen DNS-Rebinding)
- jede Anfrage ausser GET braucht `Origin: http://127.0.0.1:<port>` oder
  `http://localhost:<port>` **und** `Content-Type: application/json`, sonst
  `403` — eine fremde Seite im Browser kommt so nicht durch
- keine CORS-Kopfzeilen, Anfragen bis 100 KB
- immer `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`; jede Datei der Seite
  zusätzlich mit `Content-Security-Policy: default-src 'self'; img-src 'self'
  data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-src
  http://localhost:8081 … http://localhost:8085; frame-ancestors 'none';
  base-uri 'none'; form-action 'self'` — `frame-src` genau für die fünf Apps
  („App ansehen“)
- ausgeliefert werden nur `/` (index.html) und Dateien direkt in
  `admin/public/`, deren Name `^[a-z0-9][a-z0-9-]*\.(js|css)$` entspricht —
  keine Unterordner, aufgelöst über `path.basename` und geprüft, dass sie im
  Ordner bleiben; `.js` als `text/javascript` (für ES-Module), `.css` als
  `text/css`. Alles andere `404`, jede `/api/*`-Antwort ist JSON

**Gesperrt und weggenommen.** `disabled` (ganzes Konto) und `blockedApps`
(App-Ids) am Konto ändert nur der Admin. `GET /v1/db` und `GET
/v1/accounts/:id` liefern sie mit; `PUT /v1/db/accounts` behält die
gespeicherten Werte und wirft mitgeschickte weg, `PATCH /v1/accounts/:id`
übergeht sie. Ein gesperrtes Konto bekommt beim Anmelden mit richtigem Passwort
`403 account_disabled` (falsches Passwort bleibt `401 wrong_password`).

| Route                                  |                                                                  |
| -------------------------------------- | ---------------------------------------------------------------- |
| `GET /api/overview`                    | `{ generatedAt, accounts, apps, modules, ai, speech, margin, planRequests, storage }` |
| `POST /api/plan-requests/:id/approve`  | `{}` → `{ request, account }` — App in `paidApps`, Mitteilung `planApproved`, `admin.planApproved` |
| `POST /api/plan-requests/:id/decline`  | `{}` → `{ request, account }` — Mitteilung `planDeclined`, `admin.planDeclined` |
| `GET /api/accounts`                    | `{ accounts: [{ id, email, username, firstName, language, createdAt, lastSeenAt, disabled, blockedApps, apps, items, costChfMonth, usage }] }` |
| `GET /api/accounts/:id`                | `{ account, counts, activity, ai }` — `404 not_found`            |
| `PATCH /api/accounts/:id`              | `{ firstName?, username?, language?, disabled?, blockedApps?, paidApps? }` → `{ account }` |
| `POST /api/accounts/:id/view`          | `{ app }` → `{ url, expiresAt }` — Einmal-Ticket für „App ansehen“, `admin.viewed` im Verlauf |
| `POST /api/accounts/:id/password`      | `{ password }` → `{ ok: true }`                                  |
| `DELETE /api/accounts/:id`             | `{ confirm: "<E-Mail des Kontos>" }` → `{ ok: true, removed: { sammlung: Anzahl } }` — `400 confirm_mismatch`, `404 not_found` |
| `GET /api/activity?accountId=&kind=&limit=&before=` | `{ entries: [{ at, accountId, email, kind, detail }] }` |
| `GET /api/costs?month=YYYY-MM`         | `{ month, totalChf, monthlyMinimumChf, billableChf, byApp, byAccount, byTier, byDay, prices, speech, margin }` |

- **Übersicht:** Nutzer einer App = Konten mit einer Zeile in `appAccess`;
  aktiv = `lastSeenAt` in den letzten 7 bzw. 30 Tagen (das späteste über alle
  Apps); `newThisWeek` = angelegt in den letzten 7 Tagen. `modules` zählt die
  Zeilen je Funktion (`catalog.js`: der private Kalender sind Termine ohne
  `calendar: 'family'`, Geburtstage Kontakte mit `birthday`, Wetter speichert
  nichts). `ai.byDay` sind die letzten 30 Tage in UTC, auch leere;
  `cheapShare30` der Anteil `cheap_model` (0–1).
- **Konten:** `items` = Zeilen des Kontos über alle Sammlungen der Funktionen
  (Besitzer `accountId`, sonst `ownerId`, sonst `createdBy`; Ämtli über
  `assignedTo`). `costChfMonth` = KI-Kosten im laufenden UTC-Monat. `usage` =
  `{ last30, total }` mit je `ai: { requests, promptTokens, completionTokens,
  tokens, costChf }` und `speech` (die Summe aus `summarizeSpeech`); die letzten
  30 Tage in UTC, heute eingeschlossen. Nie Salt oder Hash. Die Einzelansicht hat zusätzlich Aussehen, Assistent,
  `onboarded`, `householdId`, die Zahlen je Funktion, die letzten 200 Ereignisse
  und die KI (Summen, je App, die letzten 50 Anfragen).
- **Abo und Marge:** Die Einzelansicht hat `account.paidApps` und
  `account.billing` — je App `{ app, plan, priceChf, budgetChf, aiChf,
  speechChf, spentChf, usedShare, resetsOn }` für den laufenden Monat in Zürich.
  `overview.margin` (laufender Monat) und `costs.margin` (gewählter Monat) haben
  je App `{ priceChf, paidAccounts, netRevenueChf, aiChf, speechChf,
  paidCostChf, trialCostChf, variableCostChf, marginChf, marginShare }` und
  `totals` mit `marginWithFixedChf`: Nettoeinnahmen minus variable Kosten minus
  Fixkosten (was die Mindestgebühr von Safe Swiss Cloud über dem KI-Verbrauch
  kostet, dazu `BETTER_SPEECH_MONTHLY_FIXED_USD`). Zahlende Konten nach heutigem
  `paidApps`, auch für frühere Monate.
- **Abo-Anfragen:** `overview.planRequests` sind die offenen, die älteste zuerst
  (`{ id, accountId, email, username, firstName, app, createdAt }`, ohne Konten,
  die es nicht mehr gibt); die Einzelansicht hat `account.planRequests`
  (`{ id, app, createdAt }`). Freischalten und Ablehnen nehmen nur `{}`
  (`400 bad_request`), unbekannt oder das Konto weg → `404 not_found`, schon
  entschieden → `409 already_decided`, ohne Preis → `409 plan_unavailable`.
  Schaltet `PATCH /api/accounts/:id` eine App in `paidApps` ein, werden offene
  Anfragen dieser App freigeschaltet — mit Mitteilung und `admin.planApproved`.
- **Ändern:** unbekannte Felder → `400 bad_request`; `language` ist `de`, `en`,
  `fr` oder `it`; `blockedApps` und `paidApps` eindeutige, bekannte App-Ids; der Benutzername
  wie beim Registrieren (`400 username_invalid`, `409 username_taken`). Das
  Passwort braucht 8 Zeichen (`400 password_too_short`) und bekommt neuen Salt.
- **Löschen:** `confirm` muss die E-Mail des Kontos sein (Gross/klein egal),
  sonst `400 confirm_mismatch`. Was wegfällt, rechnet `planAccountDeletion`
  in `admin/deletion.js` (rein, getestet):
  - das Konto und jede Zeile mit seiner `accountId`, in jeder Sammlung — ausser
    sie trägt eine `householdId` und in dem Haushalt hat noch jemand anderes
    zugesagt: dann bleibt sie unverändert beim Haushalt. Kinder (`petEvents`,
    `packingItems`, `habitTicks`, `workoutSets`, `medTakes`, `chatMessages`,
    `mailMessages`) folgen der Zeile, an der sie hängen;
  - die eigenen `householdMembers`. Hat in einem Haushalt sonst niemand
    zugesagt (offene Einladungen zählen nicht), fällt er weg — mit allem, was
    seine `householdId` trägt, den offenen Einladungen und deren Mitteilungen.
    War das Konto der letzte Verwalter, wird das am längsten dabei gebliebene
    Mitglied Verwalter;
  - eigene `calendars` mit ihren `calendarMembers` und Terminen, die eigenen
    Mitgliedschaften in fremden Kalendern, `calendarShares` in beide Richtungen
    und Mitteilungen anderer, die darauf zeigen;
  - die `notifications` des Kontos und jedes Postfach über
    `mail.removeAccount` (Tresor, Nachrichten, Cache, Postausgang);
  - Bilder in `uploads/`, auf die danach keine Zeile mehr zeigt (`backdrop:
    upload:<id>`, `attachmentIds`, `photoUploadId`, Bildblöcke in Notizen).

  Vorher schreibt der Admin alles, was wegfällt, und die geänderten Zeilen im
  alten Stand nach `<datenordner>/deleted-accounts/<konto>-<zeit>.json` — ohne
  Salt, Hash und Mail-Passwörter, zum Wiederherstellen von Hand. Die Bilder
  selbst sind nicht darin, nur ihre Ids. `activity.jsonl` und `ai-usage.jsonl`
  bleiben, wie sie sind. Schreibt eine App gerade eine Sammlung mit altem Stand
  zurück, kann sie gelöschte Zeilen wieder hereinholen — dann nochmal löschen.
  Eine offene Sitzung des Kontos meldet sich beim nächsten Abgleich ab.
- **Aktivität:** `limit` 1–500 (Standard 100), `before` ein Zeitpunkt
  (ausschliesslich), `kind` genau oder als Anfang (`session` passt auf
  `session.failed`). Zusammen mit den KI-Anfragen als `ai.reply` (`detail:
  { app, tier, model, costChf, ok, error }`), neueste zuerst.
- **Kosten:** Monat in UTC, Standard der laufende. `billableChf` =
  `max(totalChf, monthlyMinimumChf)`, sobald Kosten anfallen oder die KI
  eingerichtet ist, sonst 0. `byDay` hat jeden Tag des Monats.
- **Stimmen:** `overview.speech` = `{ configured, requests30, cached30,
  credits30, savedCredits30, creditsMonth, charactersMonth, sampleCreditsMonth,
  monthlyCredits, cache }`; `costs.speech` = die Summe des Monats mit
  `monthlyCredits`, `byApp`, `byAccount` (nach Credits) und `cache`. `cache` =
  `{ entries, samples, bytes, replays, maxFiles, maxBytes, top }`, `top` die
  zehn meistgespielten als `{ purpose, characters, hits, bytes, lastPlayedAt }`
  — nie ein Satz, nie eine Id. `monthlyCredits` aus
  `BETTER_SPEECH_MONTHLY_CREDITS` (Standard 10’000).

**Ereignisse** (`activity.jsonl`, `{ at, accountId, kind, detail }`). Nie ein
Passwort, ein Nachrichtentext, der Inhalt einer Notiz oder Mail oder eine
Adresse ohne Konto. Über 5 MB wird die Datei zu `activity.1.jsonl`. Scheitert
das Schreiben, läuft die Anfrage trotzdem.

| `kind`               | Wann                                                    | `detail`                                  |
| -------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `account.created`    | `POST /v1/accounts`                                     | `{}`                                      |
| `session.created`    | Anmelden geglückt                                       | `{}`                                      |
| `session.failed`     | falsches Passwort zu einem bestehenden Konto            | `{}`                                      |
| `session.blocked`    | richtiges Passwort, Konto gesperrt                      | `{}`                                      |
| `profile.updated`    | `PATCH /v1/accounts/:id`                                | `{ fields }`                              |
| `collection.changed` | `PUT /v1/db/:collection`, je Konto mit geänderten Zeilen | `{ collection, added, updated, removed }` |
| `admin.updated`      | `PATCH /api/accounts/:id`                               | `{ fields }`                              |
| `admin.password`     | `POST /api/accounts/:id/password`                       | `{}`                                      |
| `admin.deleted`      | `DELETE /api/accounts/:id`                              | `{ username }`                            |
| `admin.viewed`       | `POST /api/accounts/:id/view`                           | `{ app }` — nie das Ticket                |

Eine unbekannte Adresse beim Anmelden hinterlässt nichts. `collection.changed`
vergleicht die Zeilen über ihre Id (Reihenfolge der Felder zählt nicht, bei
Konten Salt und Hash nicht); Zeilen ohne Besitzer zählen niemandem.

## Was hier bewusst fehlt

Das ist ein Dienst für die Entwicklung, kein Betrieb:

- kein HTTPS — Konto- und Mail-Passwörter gehen im Klartext über die
  Verbindung, das ist nur auf dem eigenen Rechner vertretbar
- **keine Zugriffstoken** — wer den Port erreicht, liest alle Daten samt
  abgeholter Mails und kann über verbundene Postfächer Mails senden. Der
  Dienst lauscht auf allen Netzwerkschnittstellen, damit Geräte im WLAN
  drankommen; also nur in einem vertrauenswürdigen Netz laufen lassen
- keine Bremse gegen zu viele Anmeldeversuche — und wer den Port erreicht,
  kann über `/v1/speech` Guthaben bei ElevenLabs verbrauchen — und über
  `/v1/ai/reply` Guthaben bei Safe Swiss Cloud. Die KI ist darum nur für die
  Entwicklung gedacht; `accountId` ist eine Angabe, keine Anmeldung
- CORS steht auf `*`, damit die fünf Ports im Browser drankommen
- der Admin hat keine Anmeldung: er lauscht nur auf 127.0.0.1 und prüft Host
  und Origin, aber jede Person und jedes Programm auf diesem Rechner kann ihn
  benutzen
- Outlook, Hotmail, Live und Microsoft 365 nehmen seit 2022 kein Passwort mehr
  an; dafür bräuchte es eine Anmeldung per OAuth, die hier fehlt
- kein HTML und keine Anhänge beim Senden; Weiterleiten nimmt nur den Text mit
- keine Suche auf dem Server (IMAP SEARCH), keine eigenen Ordner
- abgeholte Mails, Entwürfe und der Postausgang liegen unverschlüsselt im
  Datenordner (`db.json`, `mail-cache/`, `mail-outbox.json`)
