# Better Life — Prototyp

Expo-App, im Browser als Handy und auf einem echten Geraet ueber Expo Go.
Anmeldung und Datenspeicher sind echt, liegen aber nur auf dem Geraet —
es gibt noch keinen Server.

Ausgebaut sind Kalender, Aufgaben, Notizen, Einkaufsliste und Wecker:
anlegen, aendern, abhaken, loeschen, und alles ueberlebt einen Neustart.
Die uebrigen Module zeigen einen Platzhalter, der das sagt.

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
