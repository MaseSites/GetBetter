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

Im Datenordner (nie ins Git):

```
db.json            alle Sammlungen
uploads/<id>.<ext> eigene Bilder
mail.key           32 Zufallsbytes, der Schlüssel des Tresors
mail-vault.json    die Mail-Passwörter, verschlüsselt
mail-state.json    je Postfach UIDVALIDITY und letzte UID
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
| `POST /v1/accounts`                    | Registrieren — `{ email, password }`                             |
| `POST /v1/sessions`                    | Anmelden — `{ email, password }`                                 |
| `GET /v1/accounts/:id`                 | Konto lesen                                                      |
| `GET /v1/accounts/by-username/:name`   | Konto über den Benutzernamen finden                              |
| `PATCH /v1/accounts/:id`               | Vorname, Sprache, Benutzername, Aussehen, Assistent, Hintergrund |
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
| `POST /v1/mail/send`                   | Mail senden, auch als Antwort                                    |

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
mail/sync.js        Abgleich je Postfach
mail/service.js     die Routen
```

**Verbinden.** Die Anmeldung wird sofort geprüft. Fehler: `bad_request`,
`already_connected`, `auth_failed`, `unreachable`, `tls_failed`, `timeout`,
`oauth_required`. Bei `auth_failed` kommt für Anbieter mit Hinweis zusätzlich
`note` mit (`app_password` oder `enable_imap`). Danach läuft im Hintergrund der
erste Abgleich.

**Abgleich** (nur `INBOX`): erst die letzten 50 Nachrichten, ohne Mitteilungen.
Danach neue UIDs, frische Flags, auf dem Server Gelöschtes fällt weg; wechselt
UIDVALIDITY, wird neu aufgebaut. Höchstens 100 Nachrichten je Postfach, Text
ohne HTML und auf 20 000 Zeichen gekürzt (abgerufen werden höchstens 200 KB je
Mail). Neue ungelesene Mails nach dem Verbinden werden zu Mitteilungen,
höchstens 20 je Lauf. `lastSyncAt` und `lastError` stehen am Postfach. Ein
Lauf ohne Änderung erhöht die Revision nicht.

**Senden.** Reiner Text in UTF-8 (quoted-printable), Betreff und Namen nach
RFC 2047, Zeilenumbrüche in Headern werden entfernt. Antworten tragen
`In-Reply-To` und `References`. Danach legt der Dienst eine Kopie in „Gesendet“
ab — ausser bei Gmail, das macht es selbst. Fehler: `bad_request`,
`not_found`, `auth_failed`, `unreachable`, `send_failed`.

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

## Was hier bewusst fehlt

Das ist ein Dienst für die Entwicklung, kein Betrieb:

- kein HTTPS — Konto- und Mail-Passwörter gehen im Klartext über die
  Verbindung, das ist nur auf dem eigenen Rechner vertretbar
- **keine Zugriffstoken** — wer den Port erreicht, liest alle Daten samt
  abgeholter Mails und kann über verbundene Postfächer Mails senden. Der
  Dienst lauscht auf allen Netzwerkschnittstellen, damit Geräte im WLAN
  drankommen; also nur in einem vertrauenswürdigen Netz laufen lassen
- keine Bremse gegen zu viele Anmeldeversuche
- CORS steht auf `*`, damit die fünf Ports im Browser drankommen
- Outlook, Hotmail, Live und Microsoft 365 nehmen seit 2022 kein Passwort mehr
  an; dafür bräuchte es eine Anmeldung per OAuth, die hier fehlt
- nur der Posteingang, keine Anhänge, kein HTML beim Senden
