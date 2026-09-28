/**
 * Die Schweizer QR-Rechnung als Text lesen — nach den Implementation
 * Guidelines von SIX (QR-Rechnung v2.x, Datenversion `0200`). Was im QR-Code
 * steht, ist eine Zeile je Feld, getrennt mit CR+LF oder LF:
 *
 *  1 `SPC` · 2 Version `0200` · 3 Codierung `1` · 4 IBAN oder QR-IBAN (CH/LI)
 *  5–11 Zahlungsempfaenger (Adresstyp `S` oder `K`, Name, Adresse, Land)
 *  12–18 endgueltiger Empfaenger (leer) · 19 Betrag (leer erlaubt) · 20 Waehrung
 *  21–27 Zahlungspflichtiger · 28 Referenztyp `QRR`/`SCOR`/`NON` · 29 Referenz
 *  30 unstrukturierte Mitteilung · 31 `EPD` · 32 Rechnungsinformationen
 *  (`//S1/…`, Swico) · 33–34 alternative Verfahren
 *
 * Bezahlt wird im E-Banking — hier wird nur gelesen, was man sich merken will.
 */

export type QrReferenceType = 'QRR' | 'SCOR' | 'NON';
export type QrCurrency = 'CHF' | 'EUR';

export type QrAddress = {
  kind: 'S' | 'K';
  name: string;
  /** Strasse bzw. Adresszeile 1. */
  line1: string;
  /** Hausnummer bzw. Adresszeile 2. */
  line2: string;
  postalCode: string;
  town: string;
  country: string;
};

/** Was aus `//S1/…` gelesen wird. */
export type QrBillInfo = {
  invoiceNumber: string | null;
  /** Rechnungsdatum `YYYY-MM-DD` (aus `/11/JJMMTT`). */
  documentDay: string | null;
  /** Zahlungsfrist in Tagen ohne Skonto (`/40/0:<Tage>`). */
  paymentDays: number | null;
  /** Rechnungsdatum plus Frist — `null`, wenn eins davon fehlt. */
  dueDay: string | null;
};

export type QrBill = {
  /** Ohne Leerzeichen, gross. */
  iban: string;
  /** QR-IBAN (Institut 30000–31999): dann ist die Referenz immer `QRR`. */
  qrIban: boolean;
  creditor: QrAddress;
  debtor: QrAddress | null;
  /** `null`, wenn der Betrag offen ist (der Zahler traegt ihn ein). */
  amount: number | null;
  currency: QrCurrency;
  referenceType: QrReferenceType;
  reference: string | null;
  message: string | null;
  billInfo: QrBillInfo | null;
};

export type QrBillError =
  'not_swiss_qr' | 'bad_iban' | 'bad_amount' | 'bad_currency' | 'bad_reference' | 'bad_checksum';

export type QrBillResult = { ok: true; bill: QrBill } | { ok: false; reason: QrBillError };

/** Die Tabelle fuer Modulo 10 rekursiv (Referenz der QR-Rechnung, frueher ESR). */
const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5] as const;

/** Die Pruefziffer nach Modulo 10 rekursiv zu einer Ziffernfolge. */
export function mod10Recursive(digits: string): number {
  let carry = 0;
  for (const char of digits) carry = MOD10_TABLE[(carry + Number(char)) % 10] ?? 0;
  return (10 - carry) % 10;
}

/** Rest nach Modulo 97 fuer einen Text aus Ziffern und Buchstaben (A = 10 … Z = 35). */
function mod97(text: string): number {
  let rest = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    const value = code >= 65 ? String(code - 55) : char;
    for (const digit of value) rest = (rest * 10 + Number(digit)) % 97;
  }
  return rest;
}

/** Eine IBAN der Schweiz oder Liechtensteins, 21 Zeichen, Pruefsumme stimmt. */
export function isValidSwissIban(iban: string): boolean {
  if (!/^(CH|LI)\d{2}[0-9A-Z]{17}$/.test(iban)) return false;
  return mod97(iban.slice(4) + iban.slice(0, 4)) === 1;
}

/** QR-IBAN: die Instituts-Identifikation (Stellen 5–9) liegt zwischen 30000 und 31999. */
export function isQrIban(iban: string): boolean {
  const iid = Number(iban.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}

/** QR-Referenz: 27 Ziffern, die letzte ist die Pruefziffer nach Modulo 10 rekursiv. */
export function isValidQrReference(reference: string): boolean {
  if (!/^\d{27}$/.test(reference)) return false;
  return mod10Recursive(reference.slice(0, 26)) === Number(reference[26]);
}

/** Creditor Reference nach ISO 11649: `RF`, zwei Pruefziffern, bis 21 Zeichen, Modulo 97 = 1. */
export function isValidCreditorReference(reference: string): boolean {
  if (!/^RF\d{2}[0-9A-Z]{1,21}$/.test(reference)) return false;
  return mod97(reference.slice(4) + reference.slice(0, 4)) === 1;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** `JJMMTT` → `YYYY-MM-DD` (Jahre 2000–2099), oder null bei einem krummen Datum. */
function dayOfYymmdd(text: string): string | null {
  if (!/^\d{6}$/.test(text)) return null;
  const year = 2000 + Number(text.slice(0, 2));
  const month = Number(text.slice(2, 4));
  const day = Number(text.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Rechnungsinformationen nach Swico (`//S1/10/…/11/…/40/…`). Ein `/` im Wert
 * steht als `\/`. Unbekanntes wird uebergangen; anderes als `//S1/` gibt null.
 */
export function parseBillInfo(text: string): QrBillInfo | null {
  if (!text.startsWith('//S1/')) return null;
  // In Stuecke an jedem `/`, das nicht mit `\` geschuetzt ist.
  const parts: string[] = [];
  let current = '';
  const body = text.slice('//S1/'.length);
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '\\' && body[index + 1] === '/') {
      current += '/';
      index += 1;
    } else if (char === '/') {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);

  const values = new Map<string, string>();
  for (let index = 0; index + 1 < parts.length; index += 2) {
    const tag = parts[index] ?? '';
    if (/^\d{2}$/.test(tag) && !values.has(tag)) values.set(tag, parts[index + 1] ?? '');
  }

  const documentDay = dayOfYymmdd(values.get('11') ?? '');
  // `/40/2:10;0:30` — 2 % Skonto in 10 Tagen, netto in 30. Zaehlt die ohne Skonto.
  const netto = (values.get('40') ?? '')
    .split(';')
    .map((entry) => /^0(?:\.0+)?:(\d{1,3})$/.exec(entry.trim())?.[1])
    .find((days) => days !== undefined);
  const paymentDays = netto !== undefined ? Number(netto) : null;
  return {
    invoiceNumber: values.get('10') || null,
    documentDay,
    paymentDays,
    dueDay: documentDay && paymentDays !== null ? addDays(documentDay, paymentDays) : null,
  };
}

function addressAt(lines: readonly string[], start: number): QrAddress | null {
  const kind = lines[start] ?? '';
  const name = lines[start + 1] ?? '';
  if (kind !== 'S' && kind !== 'K') return null;
  return {
    kind,
    name,
    line1: lines[start + 2] ?? '',
    line2: lines[start + 3] ?? '',
    postalCode: lines[start + 4] ?? '',
    town: lines[start + 5] ?? '',
    country: lines[start + 6] ?? '',
  };
}

/** Der hoechste Betrag, den eine QR-Rechnung tragen darf. */
const MAX_AMOUNT = 999_999_999.99;

/** Den Text aus dem QR-Code lesen. */
export function parseQrBill(text: string): QrBillResult {
  const lines = text
    .replace(/^\s*/u, '')
    .split(/\r\n|\n|\r/u)
    .map((line) => line.trim());
  // Leere Zeilen am Ende (etwa vom Einfuegen) zaehlen nicht.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  if (lines[0] !== 'SPC' || !/^02\d{2}$/.test(lines[1] ?? '') || lines[2] !== '1') {
    return { ok: false, reason: 'not_swiss_qr' };
  }
  if (lines.length < 31 || lines.length > 34 || lines[30] !== 'EPD') {
    return { ok: false, reason: 'not_swiss_qr' };
  }

  const iban = (lines[3] ?? '').replace(/\s+/gu, '').toUpperCase();
  if (!isValidSwissIban(iban)) return { ok: false, reason: 'bad_iban' };

  const creditor = addressAt(lines, 4);
  if (!creditor || creditor.name.length === 0) return { ok: false, reason: 'not_swiss_qr' };

  const rawAmount = lines[18] ?? '';
  let amount: number | null = null;
  if (rawAmount.length > 0) {
    if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(rawAmount)) return { ok: false, reason: 'bad_amount' };
    amount = Number(rawAmount);
    if (amount < 0.01 || amount > MAX_AMOUNT) return { ok: false, reason: 'bad_amount' };
  }

  const currency = lines[19] ?? '';
  if (currency !== 'CHF' && currency !== 'EUR') return { ok: false, reason: 'bad_currency' };

  const debtor = (lines[20] ?? '') === '' ? null : addressAt(lines, 20);

  const referenceType = lines[27] ?? '';
  const reference = (lines[28] ?? '').replace(/\s+/gu, '').toUpperCase();
  const qrIban = isQrIban(iban);
  if (referenceType === 'QRR') {
    // Eine QR-Referenz nur mit QR-IBAN — und eine QR-IBAN nur mit QR-Referenz.
    if (!qrIban || !/^\d{27}$/.test(reference)) return { ok: false, reason: 'bad_reference' };
    if (!isValidQrReference(reference)) return { ok: false, reason: 'bad_checksum' };
  } else if (referenceType === 'SCOR') {
    if (qrIban || !/^RF\d{2}[0-9A-Z]{1,21}$/.test(reference)) {
      return { ok: false, reason: 'bad_reference' };
    }
    if (!isValidCreditorReference(reference)) return { ok: false, reason: 'bad_checksum' };
  } else if (referenceType === 'NON') {
    if (qrIban || reference.length > 0) return { ok: false, reason: 'bad_reference' };
  } else {
    return { ok: false, reason: 'bad_reference' };
  }

  const message = lines[29] ?? '';
  const info = lines[31] ?? '';
  return {
    ok: true,
    bill: {
      iban,
      qrIban,
      creditor,
      debtor,
      amount,
      currency,
      referenceType,
      reference: reference.length > 0 ? reference : null,
      message: message.length > 0 ? message : null,
      billInfo: info.length > 0 ? parseBillInfo(info) : null,
    },
  };
}
