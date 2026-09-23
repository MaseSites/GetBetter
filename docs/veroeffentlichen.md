# Aufs Handy: TestFlight und Google Play

Die Apps sind mit **Expo (React Native, TypeScript)** gebaut — ein Code, der
auf iOS und Android läuft. Gebaut wird in der Cloud von Expo (**EAS**), auch
von Windows aus: einen Mac braucht es nicht, auch nicht für iOS.

Fünf Apps heisst fünf Einträge im App Store und bei Google Play. Für die
ersten Tester reicht **eine** — GetBetter. Die anderen gehen genau gleich.

## Was es braucht (einmalig)

| Konto                                                       | Wofür                                | Kostet                  |
| ----------------------------------------------------------- | ------------------------------------ | ----------------------- |
| [expo.dev](https://expo.dev)                                | bauen in der Cloud                   | gratis (30 Baus/Monat)  |
| [Apple Developer Program](https://developer.apple.com)      | TestFlight, App Store                | 99 USD im Jahr          |
| [Google Play Console](https://play.google.com/console)      | interner Test, Play Store            | 25 USD einmalig         |
| ein Server mit **HTTPS** für `services/api`                 | die Datenbank, die alle Apps brauchen | ab ~5 CHF im Monat     |

Konten legst du selbst an — Apple prüft Identität und Zahlung, das dauert bis
zu zwei Tage.

```bash
npm install -g eas-cli   # einmal, ausserhalb des Projekts
eas login
```

## 1. Zuerst ohne Store: Expo Go auf dem eigenen Handy

Bevor irgendetwas gebaut wird: **Expo Go** aus dem App Store / Play Store
laden, Handy und Rechner ins selbe WLAN, dann

```bash
npm run all
```

und den QR-Code aus dem Terminal von GetBetter (Port 8081) mit Expo Go (Android)
bzw. der Kamera (iPhone) scannen. Die App auf dem Handy spricht automatisch
mit der Datenbank auf deinem Rechner (`serviceUrl()` nimmt den Rechner, von
dem Expo geladen hat). Das ist der schnellste Weg, etwas Echtes in der Hand zu
haben — für dich, nicht für Tester ohne Zugang zu deinem WLAN.

## 2. Die Datenbank ins Netz

Auf einem Handy gibt es kein `localhost`. Für Tester muss `services/api`
irgendwo laufen, wo das Internet hinkommt, **mit HTTPS** — iOS und Android
lassen die App sonst nicht verbinden — und **mit Geheimnis**, sonst liest
jeder, der die Adresse kennt, alle Konten und Mails.

Der Dienst ist ein einzelner Node-Prozess ohne Abhängigkeiten. Als Container:

```bash
docker build -t better-api services/api
docker run -d --name better-api -p 8090:8090 -v better-data:/data \
  -e BETTER_API_TOKEN="$(openssl rand -hex 32)" \
  -e BETTER_DATA_KEY="$(openssl rand -hex 32)" \
  -e BETTER_TRUST_PROXY=1 better-api
```

- `BETTER_DATA_KEY` verschlüsselt Datenbank und Sitzungen auf der Platte
  (AES-256-GCM). **Den Schlüssel sicher aufbewahren** — ohne ihn sind die
  Daten weg, und mit einem falschen startet der Dienst absichtlich nicht.
- Mit `BETTER_API_TOKEN` ist der Dienst „im Netz“: jede Anfrage braucht die
  Sitzung eines Kontos, und jedes Konto sieht nur seine eigenen Daten (plus
  Haushalt und Freigaben). Anmelden ist gebremst: zehn falsche Passwörter,
  dann 15 Minuten Pause.

- `/data` ist ein Volume: dort liegen Konten, Bilder und der Mail-Tresor.
  Ohne Volume ist nach einem Neustart alles weg.
- Der **Admin ist im Container aus** (`BETTER_ADMIN_PORT=0`) — er hat keine
  Anmeldung und gehört nie ins Netz. Zum Freischalten von Abos den Dienst
  lokal starten oder per SSH-Tunnel an den Server.
- Davor ein Reverse-Proxy mit Zertifikat (Caddy: zwei Zeilen; oder Fly.io,
  Railway, Render — die machen HTTPS selbst). Zum Prüfen:
  `curl https://api.deine-domain.ch/v1/health` muss `{"ok":true,…}` geben —
  das ist die einzige Route, die ohne Geheimnis antwortet.
- KI und Stimmen: `GROQ_API_KEY`, `SAFESWISSCLOUD_API_KEY`, `ELEVENLABS_API_KEY`
  als Umgebungsvariablen mitgeben, nie in die Datei.

Das Geheimnis (`BETTER_API_TOKEN`) merkst du dir — die App bekommt es beim
Bauen als `EXPO_PUBLIC_API_TOKEN` und schickt es bei jeder Anfrage mit. Es
steckt damit im App-Paket; wer sich Mühe gibt, findet es — es hält nur
Fremde von der Tür fern. Was wirklich schützt, ist die **Sitzung je Konto**:
ohne Anmeldung gibt der Dienst nichts heraus, und jedes Konto sieht nur seine
eigenen Daten.

## 3. Die App bei EAS anmelden

Einmal je App, im Ordner der App:

```bash
cd apps/getbetter
eas init          # legt das Projekt bei expo.dev an, schreibt extra.eas.projectId in app.json
```

Die geänderte `app.json` einchecken. `npm run release:check` (im
Projektstamm) sagt danach für jede App, was noch fehlt.

Dann die Adresse und das Geheimnis hinterlegen — **nicht in die Dateien**,
sondern bei EAS, wo sie in jeden Bau kommen:

```bash
eas env:create --scope project --name EXPO_PUBLIC_API_URL --value https://api.deine-domain.ch --visibility plaintext --environment preview --environment production
eas env:create --scope project --name EXPO_PUBLIC_API_TOKEN --value <dein Geheimnis> --visibility sensitive --environment preview --environment production
```

Vor jedem Bau läuft `scripts/release-check.js` auf den Servern von EAS
(`eas-build-pre-install`): fehlt eines davon oder fängt die Adresse nicht mit
`https://` an, bricht der Bau ab, bevor er Minuten kostet.

## 4. Bauen

```bash
cd apps/getbetter
npm run build:preview      # für Tester: iOS ad hoc + Android als APK
npm run build:production   # für TestFlight und die Stores
```

Beim ersten iOS-Bau fragt EAS nach deiner Apple-ID und legt Zertifikat und
Profil selbst an (das ist der Grund, warum es keinen Mac braucht). Bei
Android erzeugt EAS den Signierschlüssel — **den nie verlieren**, er ist an
die App im Store gebunden; EAS bewahrt ihn auf.

- **preview** — die Android-APK lässt sich als Link an jeden schicken
  („unbekannte Quellen“ erlauben). Auf iOS läuft ein ad-hoc-Bau nur auf
  Geräten, die vorher registriert sind (`eas device:create`, höchstens 100) —
  für iOS ist TestFlight darum der einfachere Weg.
- **production** — Versionsnummern zählt EAS selbst hoch
  (`appVersionSource: remote`, `autoIncrement`); `version` in `app.json`
  hebst du nur an, wenn du eine neue Version ankündigen willst.

## 5. TestFlight (iOS)

1. In [App Store Connect](https://appstoreconnect.apple.com) einmal die App
   anlegen: Name **GetBetter**, Bundle-ID `ch.better.getbetter`, SKU frei.
2. `npm run submit:ios` — lädt den letzten production-Bau hoch. Apple prüft ihn
   ein paar Minuten („Processing“). Die Frage nach der Verschlüsselung entfällt
   (`ITSAppUsesNonExemptEncryption: false` steht in `app.json`).
3. App Store Connect → TestFlight → **Interne Tests**: bis 100 Personen aus
   deinem Team, sofort, ohne Prüfung. **Externe Tests**: bis 10’000 per Link
   oder E-Mail, nach einer kurzen Prüfung durch Apple (meist ein Tag).
4. Tester installieren **TestFlight** aus dem App Store, nehmen die Einladung
   an — fertig. Ein Bau gilt 90 Tage.

## 6. Interner Test (Android)

1. In der Play Console einmal die App anlegen (Name, Paket
   `ch.better.getbetter`); dazu den Fragebogen zu Inhalten und Datenschutz.
2. Ein Dienstkonto mit Zugriff auf die Play Console anlegen und dessen
   JSON-Schlüssel herunterladen (Anleitung bei EAS: „Google Service Account“).
   Den Pfad in `eas.json` unter `submit.production.android.serviceAccountKeyPath`
   eintragen — die Datei selbst **nie** einchecken (`*.json` im App-Ordner ist
   trotzdem nicht ignoriert: ausserhalb des Repos ablegen).
3. `npm run submit:android` — landet auf der Schiene **Interner Test**
   (`track: internal`), bis 100 Tester per Link, ohne Prüfung.

## Neue Fassung

Code ändern, `npm run typecheck && npm run lint && npm test`, dann

```bash
cd apps/getbetter && npm run build:production && npm run submit:ios && npm run submit:android
```

Die Build-Nummer zählt EAS hoch; Tester bekommen das Update über TestFlight
bzw. Play automatisch.

## Was auf dem Handy anders ist

- Vorsagen und Gespräch mit dem Assistenten, Vorlesen, echte Stimmen, Bilder
  wählen, Kontakte-Import und Erinnerungen als Mitteilung gehen alle auf dem
  Handy. Zuhören braucht die Erlaubnis für Mikrofon und Spracherkennung — die
  App fragt beim ersten Mal.
- Aufträge zwischen den Apps (`betterfamily://…`) funktionieren erst, wenn
  die andere App auch installiert ist.
- Die Sitzung liegt auf dem Handy im Schlüsselbund; im Browser in dessen
  Ablage.

## Updates ohne Store

Für reine Code-Änderungen (kein neues Modul) reicht ein Update über die Luft:

```bash
cd apps/getbetter
eas update:configure        # einmal: trägt updates.url in app.json ein (einchecken)
eas update --channel production --message "Kleiner Fix"
```

Die App holt es beim nächsten Start. Ein neues Modul (etwas unter `plugins`
in `app.json`) braucht dagegen einen neuen Bau und Upload.

## Wenn etwas hakt

- `eas build` bricht sofort ab, Meldung von `release-check`: die Adresse oder
  das Geheimnis fehlt bei EAS (`eas env:list`).
- Die App startet, bleibt aber bei „Nochmal versuchen“: der Dienst antwortet
  nicht — `curl https://…/v1/health` prüfen, und ob `EXPO_PUBLIC_API_URL`
  wirklich die Adresse mit `https://` ist.
- Anmelden geht nicht, Fehler `unauthorized`: Geheimnis in der App und beim
  Dienst sind verschieden.
- Bilder oder Anhänge fehlen, alles andere geht: das Geheimnis fehlt in der
  Adresse — die App hängt es als `?token=` an (`withToken`), der Dienst nimmt
  beides.
