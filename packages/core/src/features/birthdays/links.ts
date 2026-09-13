/**
 * Die Adressen hinter „Nachricht“, „Anrufen“ und einem Geschenk-Link — ohne
 * `Linking`, damit sie sich unter Node pruefen lassen.
 */

/** Nur Ziffern und ein fuehrendes Plus: „+41 79 123 45 67“ → „+41791234567“. */
export function phoneDigits(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

export function telUrl(phone: string): string {
  return `tel:${phoneDigits(phone)}`;
}

/**
 * Eine SMS mit vorbereitetem Text. iOS trennt den Text mit `&`, alle anderen
 * mit `?` — mit dem falschen Zeichen landet der Text in der Nummer.
 */
export function smsUrl(phone: string, body: string | null, os: string): string {
  const base = `sms:${phoneDigits(phone)}`;
  if (!body) return base;
  const separator = os === 'ios' ? '&' : '?';
  return `${base}${separator}body=${encodeURIComponent(body)}`;
}

/**
 * Ein Link, den man gefahrlos oeffnen kann: nur http und https. Fehlt das
 * Schema bei etwas, das nach Adresse aussieht („galaxus.ch/…“), kommt https
 * davor. Alles andere ist kein Link.
 */
export function openableUrl(text: string | null | undefined): string | null {
  const value = text?.trim() ?? '';
  if (value.length === 0 || /\s/.test(value)) return null;
  if (/^https?:\/\/[^/]+\.[^/]+/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return /^[^/]+\.[a-z]{2,}(\/|$)/i.test(value) ? `https://${value}` : null;
}

/** Die Adresse ohne Schema und ohne www, fuer die Zeile: „galaxus.ch“. */
export function linkHost(url: string): string {
  return (
    url
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0] ?? url
  );
}
