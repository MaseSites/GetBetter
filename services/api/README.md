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
speech-cache/      gesprochene Sätze als MP3, höchstens 400 Dateien
```

## Routen

Antworten sind JSON, Fehler `{ "error": "<schlüssel>" }`. Jede Änderung erhöht
die Revision, damit die Apps neu laden.

| Route                                  |                                                                  |
| -------------------------------------- | ---------------------------------------------------------------- |
| `GET /v1/health`                       | Läuft er?                                                        |
| `GET /v1/db`                           | Alles, ohne Passwort-Hashes                                      |
| `GET /v1/revision`                     | Hat sich etwas geändert?                                         |
| `PUT /v1/db/:collection`               | Eine Sammlung ersetzen — nicht die drei des Dienstes (`403`)     |
| `POST /v1/accounts`                    | Registrieren — `{ email, password, username? }`                  |
| `POST /v1/sessions`                    | Anmelden — `{ email, password }`                                 |
| `GET /v1/accounts/:id`                 | Konto lesen                                                      |
| `GET /v1/accounts/by-username/:name`   | Konto über den Benutzernamen finden                              |
| `PATCH /v1/accounts/:id`               | Spitzname, Sprache, Benutzername, Aussehen, Assistent, Hintergrund |
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
| `GET /v1/speech/status`                | `{ provider, configured, lastError }` — nie der Schlüssel        |
| `GET /v1/speech/voices?language=`      | Stimmen des ElevenLabs-Kontos, wer die Sprache spricht zuerst    |
| `POST /v1/speech`                      | `{ text, voice, language }` → `{ id, url }`                      |
| `GET /v1/speech/<id>.mp3`              | das Audio, im Strom oder aus dem Zwischenspeicher                |

Den genauen Vertrag (Felder, Fehlerschlüssel) halten die Zeilentypen in
`packages/core/src/db/types.ts` fest.

## Mitteilungen, Bilder, Profil

- `notifications`, `mailAccounts` und `mailMessages` gehören dem Dienst. Apps
  lesen sie über `GET /v1/db` und schreiben nur über die Routen oben.
- `title` und `body` einer Mitteilung sind Daten (Name, Betreff), keine Sätze.
  `kind` ist `calendarShare`, `calendarInvite`, `householdInvite`, `mail` oder
  `system`; `ref` hält nur Texte.
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

## Was hier bewusst fehlt

Das ist ein Dienst für die Entwicklung, kein Betrieb:

- kein HTTPS — Konto- und Mail-Passwörter gehen im Klartext über die
  Verbindung, das ist nur auf dem eigenen Rechner vertretbar
- **keine Zugriffstoken** — wer den Port erreicht, liest alle Daten samt
  abgeholter Mails und kann über verbundene Postfächer Mails senden. Der
  Dienst lauscht auf allen Netzwerkschnittstellen, damit Geräte im WLAN
  drankommen; also nur in einem vertrauenswürdigen Netz laufen lassen
- keine Bremse gegen zu viele Anmeldeversuche — und wer den Port erreicht,
  kann über `/v1/speech` Guthaben bei ElevenLabs verbrauchen
- CORS steht auf `*`, damit die fünf Ports im Browser drankommen
- Outlook, Hotmail, Live und Microsoft 365 nehmen seit 2022 kein Passwort mehr
  an; dafür bräuchte es eine Anmeldung per OAuth, die hier fehlt
- kein HTML und keine Anhänge beim Senden; Weiterleiten nimmt nur den Text mit
- keine Suche auf dem Server (IMAP SEARCH), keine eigenen Ordner
- abgeholte Mails, Entwürfe und der Postausgang liegen unverschlüsselt im
  Datenordner (`db.json`, `mail-cache/`, `mail-outbox.json`)
