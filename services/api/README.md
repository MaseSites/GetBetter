# Kontodienst

Alle Better-Apps melden sich hier an. Damit gilt dieselbe Anmeldung überall,
statt dass jede App ihr eigenes Konto führt.

```bash
npm run server      # aus dem Projektstamm, Port 8090
```

| Route                          |                                              |
| ------------------------------ | -------------------------------------------- |
| `POST /v1/accounts`            | Registrieren — `{ email, password }`         |
| `POST /v1/sessions`            | Anmelden — `{ email, password }`             |
| `GET /v1/accounts/:id`         | Konto lesen                                  |
| `GET /v1/accounts/by-username/:name` | Konto über den Benutzernamen finden    |
| `PATCH /v1/accounts/:id`       | Vorname, Sprache, Benutzername, Aussehen     |
| `GET /v1/health`               | Läuft er?                                    |

Die Daten liegen in `data/accounts.json`. Passwörter als scrypt über Salt +
Passwort; Salt und Hash verlassen den Dienst nie.

## Was hier bewusst fehlt

Das ist ein Dienst für die Entwicklung, kein Betrieb:

- kein HTTPS — die Passwörter gehen im Klartext über die Verbindung, das ist
  nur auf dem eigenen Rechner vertretbar
- keine Sitzungs-Token, keine Ablauffristen — die Apps merken sich das Konto
  selbst
- keine Bremse gegen zu viele Anmeldeversuche
- CORS steht auf `*`, damit die fünf Ports im Browser drankommen
- die Daten der Apps (Termine, Listen, Haushalte) liegen weiter je App auf dem
  Gerät. Hier stehen nur die Konten.
