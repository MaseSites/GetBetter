/**
 * Vorlagen fuer bekannte Mail-Anbieter: aus der Adresse die Server raten.
 *
 * `note` sagt der App, was der Nutzer vorher tun muss:
 * - `app_password`  das normale Passwort geht nicht, es braucht ein App-Passwort
 * - `enable_imap`   IMAP ist im Webmail zuerst einzuschalten
 * - `oauth_only`    nur mit Microsoft-Anmeldung (OAuth) — mit Passwort gar nicht
 */

const PROVIDERS = [
  {
    provider: 'gmx',
    label: 'GMX',
    domains: ['gmx.ch', 'gmx.net', 'gmx.de', 'gmx.at', 'gmx.com'],
    imap: ['imap.gmx.net', 993, true],
    smtp: ['mail.gmx.net', 465, true],
    note: 'enable_imap',
  },
  {
    provider: 'webde',
    label: 'WEB.DE',
    domains: ['web.de'],
    imap: ['imap.web.de', 993, true],
    smtp: ['smtp.web.de', 587, false],
    note: 'enable_imap',
  },
  {
    provider: 'gmail',
    label: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    imap: ['imap.gmail.com', 993, true],
    smtp: ['smtp.gmail.com', 465, true],
    note: 'app_password',
  },
  {
    provider: 'yahoo',
    label: 'Yahoo',
    domains: ['ymail.com', 'rocketmail.com'],
    match: /^yahoo\.[a-z.]+$/,
    imap: ['imap.mail.yahoo.com', 993, true],
    smtp: ['smtp.mail.yahoo.com', 465, true],
    note: 'app_password',
  },
  {
    provider: 'icloud',
    label: 'iCloud',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    imap: ['imap.mail.me.com', 993, true],
    smtp: ['smtp.mail.me.com', 587, false],
    note: 'app_password',
  },
  {
    provider: 'outlook',
    label: 'Outlook',
    domains: ['msn.com'],
    match: /^(outlook|hotmail|live)\.[a-z.]+$/,
    imap: ['outlook.office365.com', 993, true],
    smtp: ['smtp-mail.outlook.com', 587, false],
    note: 'oauth_only',
  },
  {
    provider: 'bluewin',
    label: 'Bluewin',
    domains: ['bluewin.ch'],
    imap: ['imaps.bluewin.ch', 993, true],
    smtp: ['smtps.bluewin.ch', 465, true],
    note: null,
  },
  {
    provider: 'sunrise',
    label: 'Sunrise',
    domains: ['sunrise.ch'],
    imap: ['imap.sunrise.ch', 993, true],
    smtp: ['smtp.sunrise.ch', 587, false],
    note: null,
  },
  {
    provider: 'posteo',
    label: 'Posteo',
    domains: ['posteo.de', 'posteo.net', 'posteo.ch', 'posteo.at', 'posteo.eu', 'posteo.org'],
    imap: ['posteo.de', 993, true],
    smtp: ['posteo.de', 465, true],
    note: null,
  },
  {
    provider: 'mailch',
    label: 'mail.ch',
    domains: ['mail.ch'],
    imap: ['imap.mail.ch', 993, true],
    smtp: ['smtp.mail.ch', 465, true],
    note: null,
  },
];

/** Microsofts Server nehmen seit 2022 kein Passwort mehr an — auch nicht fuer eigene Domains. */
const OAUTH_HOSTS = /(^|\.)(office365\.com|outlook\.com)$/i;

function domainOf(email) {
  const address = String(email ?? '')
    .trim()
    .toLowerCase();
  const at = address.lastIndexOf('@');
  return at === -1 ? '' : address.slice(at + 1);
}

function describe(entry) {
  return {
    provider: entry.provider,
    label: entry.label,
    imapHost: entry.imap[0],
    imapPort: entry.imap[1],
    imapSecure: entry.imap[2],
    smtpHost: entry.smtp[0],
    smtpPort: entry.smtp[1],
    smtpSecure: entry.smtp[2],
    note: entry.note,
  };
}

/** Die Vorlage zu einer Adresse; unbekannte Domains bekommen `imap.<domain>`/`smtp.<domain>`. */
function detectProvider(email) {
  const domain = domainOf(email);
  const known = PROVIDERS.find(
    (entry) => entry.domains.includes(domain) || (entry.match ? entry.match.test(domain) : false),
  );
  if (known) return describe(known);
  return describe({
    provider: 'custom',
    label: domain,
    imap: [`imap.${domain}`, 993, true],
    smtp: [`smtp.${domain}`, 465, true],
    note: null,
  });
}

function requiresOAuth(host) {
  return OAUTH_HOSTS.test(String(host ?? '').trim());
}

module.exports = { detectProvider, requiresOAuth, domainOf };
