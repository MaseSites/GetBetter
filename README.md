# GetBetter und die Better-Apps

Fünf eigenständige Expo-Apps in einem Arbeitsbereich, die sich **eine Datenbank
teilen**. Im Browser laufen sie als Handy, auf einem echten Gerät über Expo Go.
Anmeldung und Daten sind echt und liegen im Dienst `services/api`, den du
mitstartest.

| App              | Was drin ist                                                                                | Web  |
| ---------------- | ------------------------------------------------------------------------------------------- | ---- |
| **GetBetter**    | Privater Kalender, Aufgaben, Notizen, Wecker, Assistent — dazu die Übersicht über alle Apps | 8081 |
| **BetterFamily** | Familienkalender, Einkaufsliste, Ämtli, Haushalt                                            | 8082 |
| **BetterGym**    | Training, Menüplan, Schlaf, Trinken                                                         | 8083 |
| **BetterAi**     | Das KI-Gespräch                                                                             | 8084 |
| **BetterMoney**  | Budget, Rechnungen, Abos, Sparziele                                                         | 8085 |

```bash
npm install
npm run server     # Datenbank, Port 8090
npm run web        # GetBetter
npm run family     # BetterFamily, in einem zweiten Fenster
```

Der **Kalender** in GetBetter hat Tages-, Wochen- und Monatsansicht, Termine mit
Farbe, Ort und Notiz, und legt beim Antippen einer freien Stunde gleich einen an.
Ein Termin kann in mehreren Kalendern liegen und wird trotzdem einmal angezeigt.
Ausgebaut sind ausserdem Aufgaben, Notizen, Wecker (GetBetter), Einkaufsliste und
Ämtli (BetterFamily) sowie der Chat (BetterAi). Die übrigen Module zeigen einen
Platzhalter, der das sagt.

**Haushalte**: anlegen oder mit einem sechsstelligen Code beitreten, Rollen
Verwalter und Mitglied. Im Haushalt teilen sich alle die Einkaufsliste, den
Familienkalender und die Ämtli samt Zuteilung. Persönliche Termine lassen sich
als privat markieren.

## Wie die Apps zusammenspielen

Alle Apps sprechen mit demselben Dienst. Dort liegen die Profile **und** die
Daten: du meldest dich überall mit denselben Daten an, und was die eine App
einträgt, sieht die andere. Läuft der Dienst nicht, sagen die Apps das und
schreiben nichts.

GetBetter kann den anderen Apps ausserdem etwas **auftragen**:

> „pack mir 2 Bananen auf die Einkaufsliste“

Der Assistent erkennt das und öffnet BetterFamily über einen Tiefenlink
(`betterfamily://befehl/einkauf?text=2%20Bananen`), die es dann einträgt.

**Wer was führt**: GetBetter hat den privaten Kalender, die Aufgaben, Notizen
und den Wecker. Haushalte und der Familienkalender liegen in BetterFamily.

Ein neues Konto startet leer.

Die Konventionen und der genaue Aufbau stehen in [CLAUDE.md](CLAUDE.md).
