# Better Life — Prototyp

Expo-App, im Browser als Handy und auf einem echten Geraet ueber Expo Go.
Anmeldung und Datenspeicher sind echt, liegen aber nur auf dem Geraet —
es gibt noch keinen Server.

Der **Kalender** hat Tages-, Wochen- und Monatsansicht, Termine mit Farbe,
Ort und Notiz, und legt beim Antippen einer freien Stunde gleich einen an.
Ebenfalls ausgebaut: Aufgaben, Notizen, Einkaufsliste, Wecker. Die uebrigen
Module zeigen einen Platzhalter, der das sagt.

**Haushalte**: anlegen oder mit einem sechsstelligen Code beitreten, Rollen
Verwalter und Mitglied. Im Haushalt teilen sich alle die Einkaufsliste, den
Familienkalender und die Aemtli samt Zuteilung. Persoenliche Termine lassen
sich als privat markieren — die sieht dann niemand sonst.

Ein neues Konto startet leer.

```bash
npm install
npm run web
```

Dann im Browser: Konto erstellen, durchs Onboarding, in die vier Tabs —
Startseite, Module, Assistent, Profil. Alle Module sind von Anfang an da,
im Module-Tab nach Bereich sortiert.

Der **Assistent** in der Mitte ist eingebaut und verwaltet quer ueber deine
Module. Das Modul **KI-Chat** daneben ist eine ganz normale KI zum Fragen und
Schreiben, im Abo enthalten und ohne Zugriff auf deine Daten.

| Befehl              | Zweck                                   |
| ------------------- | --------------------------------------- |
| `npm run web`       | Prototyp im Browser, mit Telefon-Rahmen |
| `npm start`         | QR-Code fuer Expo Go auf dem Handy      |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm run lint`      | ESLint                                  |
| `npm run format`    | Prettier                                |

`/ui-kit` im Browser zeigt jeden Baustein in allen Zustaenden.

Konventionen und Ordnerstruktur stehen in [CLAUDE.md](CLAUDE.md),
der Plan mit allen Tickets in [docs/plan-prototyp-hauptapp.md](docs/plan-prototyp-hauptapp.md).
