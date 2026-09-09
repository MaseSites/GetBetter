# GetBetter und die Better-Apps

Fünf eigenständige Expo-Apps in einem Arbeitsbereich. Im Browser laufen sie als
Handy, auf einem echten Gerät über Expo Go. Anmeldung und Datenspeicher sind
echt, liegen aber je App nur auf dem Gerät — es gibt noch keinen Server.

| App              | Was drin ist                                                                              | Web  |
| ---------------- | ----------------------------------------------------------------------------------------- | ---- |
| **GetBetter**    | Kalender, Aufgaben, Notizen, Wecker und der Assistent — dazu die Übersicht über alle Apps | 8081 |
| **BetterFamily** | Einkaufsliste, Ämtli, Haushalt                                                            | 8082 |
| **BetterGym**    | Training, Menüplan, Schlaf, Trinken                                                       | 8083 |
| **BetterAi**     | Das KI-Gespräch                                                                           | 8084 |
| **BetterMoney**  | Budget, Rechnungen, Abos, Sparziele                                                       | 8085 |

```bash
npm install
npm run server     # Kontodienst, Port 8090
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

**Ein Login für alle.** Die Konten liegen in einem kleinen Kontodienst, den du
mitstartest:

```bash
npm run server     # Port 8090
```

Damit meldest du dich in jeder App mit denselben Daten an. Verbunden ist die
Person — Vorname, Sprache und Aussehen wandern mit. Die Daten der Apps
(Termine, Listen, Haushalte) liegen weiter je App auf dem Gerät.

GetBetter kann den anderen Apps ausserdem etwas **auftragen**:

> „pack mir 2 Bananen auf die Einkaufsliste“

Der Assistent erkennt das, öffnet BetterFamily über einen Tiefenlink
(`betterfamily://befehl/einkauf?text=2%20Bananen`) und die trägt es ein. Das
wirkt nur, wenn die andere App auf demselben Gerät installiert ist, und geht nur
in eine Richtung: GetBetter erfährt nicht, was daraus wurde. Echte gemeinsame
Daten gibt es erst mit einem Server.

Ein neues Konto startet leer.

Die Konventionen und der genaue Aufbau stehen in [CLAUDE.md](CLAUDE.md).
