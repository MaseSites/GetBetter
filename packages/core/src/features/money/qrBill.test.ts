import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isQrIban,
  isValidCreditorReference,
  isValidQrReference,
  isValidSwissIban,
  mod10Recursive,
  parseBillInfo,
  parseQrBill,
} from './qrBill';

/**
 * Die Beispiele aus den Implementation Guidelines QR-Rechnung von SIX
 * (Anhang, erfundene Namen wie „Max Muster & Söhne“) — Feld fuer Feld.
 */
const CREDITOR = ['S', 'Max Muster & Söhne', 'Musterstrasse', '123', '8000', 'Seldwyla', 'CH'];
const ULTIMATE = ['', '', '', '', '', '', ''];
const DEBTOR = ['S', 'Simon Muster', 'Musterstrasse', '1', '8000', 'Seldwyla', 'CH'];

function payload(fields: {
  iban?: string;
  amount?: string;
  currency?: string;
  debtor?: readonly string[];
  referenceType?: string;
  reference?: string;
  message?: string;
  trailer?: readonly string[];
}): string[] {
  return [
    'SPC',
    '0200',
    '1',
    fields.iban ?? 'CH4431999123000889012',
    ...CREDITOR,
    ...ULTIMATE,
    fields.amount ?? '1949.75',
    fields.currency ?? 'CHF',
    ...(fields.debtor ?? DEBTOR),
    fields.referenceType ?? 'QRR',
    fields.reference ?? '210000000003139471430009017',
    fields.message ?? 'Auftrag vom 15.10.2020',
    'EPD',
    ...(fields.trailer ?? []),
  ];
}

/** Beispiel 1: QR-IBAN mit QR-Referenz, Betrag, Rechnungsinformationen und zwei Verfahren. */
const EXAMPLE_QRR = payload({
  trailer: [
    '//S1/10/10201409/11/201021/30/102673386/32/7.7/40/0:30',
    'Name AV1: UV;UltraPay005;12345',
    'Name AV2: XY;XYService;54321',
  ],
});

/** Beispiel 3: IBAN mit Creditor Reference (SCOR). */
const EXAMPLE_SCOR = payload({
  iban: 'CH5800791123000889012',
  amount: '199.95',
  debtor: ['S', 'Sarah Beispiel', 'Mustergasse', '1', '3600', 'Thun', 'CH'],
  referenceType: 'SCOR',
  reference: 'RF18539007547034',
  message: '',
});

/** Beispiel 4: ohne Referenz, ohne Betrag und ohne Zahler — etwa eine Spende. */
const EXAMPLE_NON = payload({
  iban: 'CH5204835012345671000',
  amount: '',
  debtor: ['', '', '', '', '', '', ''],
  referenceType: 'NON',
  reference: '',
  message: 'Spende',
});

test('Modulo 10 rekursiv: die Pruefziffer der Beispielreferenz ist 7', () => {
  assert.equal(mod10Recursive('21000000000313947143000901'), 7);
  assert.equal(mod10Recursive('00000000000000000000000000'), 0);
  assert.equal(isValidQrReference('210000000003139471430009017'), true);
  assert.equal(isValidQrReference('210000000003139471430009018'), false);
  assert.equal(isValidQrReference('21000000000313947143000901'), false);
});

test('ISO 11649: RF18 5390 0754 7034 ist gueltig, mit falschen Pruefziffern nicht', () => {
  assert.equal(isValidCreditorReference('RF18539007547034'), true);
  assert.equal(isValidCreditorReference('RF18000000000539007547034'), true);
  assert.equal(isValidCreditorReference('RF48539007547034'), false);
  assert.equal(isValidCreditorReference('RF18'), false);
});

test('IBAN: CH und LI mit Pruefsumme, QR-IBAN an der Instituts-Id', () => {
  assert.equal(isValidSwissIban('CH4431999123000889012'), true);
  assert.equal(isValidSwissIban('CH4431999123000889013'), false);
  assert.equal(isValidSwissIban('DE89370400440532013000'), false);
  assert.equal(isQrIban('CH4431999123000889012'), true);
  assert.equal(isQrIban('CH5800791123000889012'), false);
});

test('Beispiel QRR mit CR+LF: alles gelesen', () => {
  const result = parseQrBill(EXAMPLE_QRR.join('\r\n'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const { bill } = result;
  assert.equal(bill.iban, 'CH4431999123000889012');
  assert.equal(bill.qrIban, true);
  assert.equal(bill.creditor.name, 'Max Muster & Söhne');
  assert.equal(bill.creditor.town, 'Seldwyla');
  assert.equal(bill.debtor?.name, 'Simon Muster');
  assert.equal(bill.amount, 1949.75);
  assert.equal(bill.currency, 'CHF');
  assert.equal(bill.referenceType, 'QRR');
  assert.equal(bill.reference, '210000000003139471430009017');
  assert.equal(bill.message, 'Auftrag vom 15.10.2020');
  assert.deepEqual(bill.billInfo, {
    invoiceNumber: '10201409',
    documentDay: '2020-10-21',
    paymentDays: 30,
    dueDay: '2020-11-20',
  });
});

test('dasselbe mit LF und mit Leerzeilen am Ende', () => {
  const lf = parseQrBill(EXAMPLE_QRR.join('\n'));
  const trailing = parseQrBill(`${EXAMPLE_QRR.join('\n')}\n\n`);
  assert.equal(lf.ok && lf.bill.amount, 1949.75);
  assert.equal(trailing.ok && trailing.bill.billInfo?.dueDay, '2020-11-20');
  // Byte Order Mark und Leerraum vorne, wie beim Einfuegen aus einer Datei.
  const bom = parseQrBill(`﻿ \n${EXAMPLE_QRR.join('\r\n')}`);
  assert.equal(bom.ok && bom.bill.iban, 'CH4431999123000889012');
});

test('Beispiel SCOR: Referenz nach ISO 11649, ohne Mitteilung', () => {
  const result = parseQrBill(EXAMPLE_SCOR.join('\r\n'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.bill.qrIban, false);
  assert.equal(result.bill.referenceType, 'SCOR');
  assert.equal(result.bill.reference, 'RF18539007547034');
  assert.equal(result.bill.amount, 199.95);
  assert.equal(result.bill.message, null);
  assert.equal(result.bill.billInfo, null);
});

test('Beispiel NON: ohne Betrag und ohne Zahler', () => {
  const result = parseQrBill(EXAMPLE_NON.join('\n'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.bill.amount, null);
  assert.equal(result.bill.debtor, null);
  assert.equal(result.bill.referenceType, 'NON');
  assert.equal(result.bill.reference, null);
  assert.equal(result.bill.message, 'Spende');
});

test('EUR wird gelesen und als EUR gemeldet', () => {
  const result = parseQrBill(payload({ currency: 'EUR' }).join('\n'));
  assert.equal(result.ok && result.bill.currency, 'EUR');
});

test('falsche Pruefziffer der QR-Referenz', () => {
  const result = parseQrBill(payload({ reference: '210000000003139471430009018' }).join('\n'));
  assert.deepEqual(result, { ok: false, reason: 'bad_checksum' });
});

test('falsche Pruefziffer der Creditor Reference', () => {
  const result = parseQrBill(
    payload({
      iban: 'CH5800791123000889012',
      referenceType: 'SCOR',
      reference: 'RF48539007547034',
    }).join('\n'),
  );
  assert.deepEqual(result, { ok: false, reason: 'bad_checksum' });
});

test('QR-IBAN verlangt QRR, eine gewoehnliche IBAN verbietet QRR', () => {
  assert.deepEqual(parseQrBill(payload({ referenceType: 'NON', reference: '' }).join('\n')), {
    ok: false,
    reason: 'bad_reference',
  });
  assert.deepEqual(parseQrBill(payload({ iban: 'CH5800791123000889012' }).join('\n')), {
    ok: false,
    reason: 'bad_reference',
  });
  // NON mit Referenz ist krumm.
  assert.deepEqual(
    parseQrBill(
      payload({
        iban: 'CH5800791123000889012',
        referenceType: 'NON',
        reference: 'RF18539007547034',
      }).join('\n'),
    ),
    { ok: false, reason: 'bad_reference' },
  );
});

test('falsche IBAN, Betrag und Waehrung', () => {
  assert.deepEqual(parseQrBill(payload({ iban: 'CH4431999123000889013' }).join('\n')), {
    ok: false,
    reason: 'bad_iban',
  });
  assert.deepEqual(parseQrBill(payload({ iban: 'DE89370400440532013000' }).join('\n')), {
    ok: false,
    reason: 'bad_iban',
  });
  assert.deepEqual(parseQrBill(payload({ amount: '12,50' }).join('\n')), {
    ok: false,
    reason: 'bad_amount',
  });
  assert.deepEqual(parseQrBill(payload({ amount: '0.00' }).join('\n')), {
    ok: false,
    reason: 'bad_amount',
  });
  assert.deepEqual(parseQrBill(payload({ amount: '1000000000.00' }).join('\n')), {
    ok: false,
    reason: 'bad_amount',
  });
  assert.deepEqual(parseQrBill(payload({ currency: 'USD' }).join('\n')), {
    ok: false,
    reason: 'bad_currency',
  });
});

test('kein QR-Rechnungstext', () => {
  assert.deepEqual(parseQrBill('https://example.ch'), { ok: false, reason: 'not_swiss_qr' });
  assert.deepEqual(parseQrBill(''), { ok: false, reason: 'not_swiss_qr' });
  // Falsche Version, fehlendes EPD, zu kurz
  const wrongVersion = [...EXAMPLE_QRR];
  wrongVersion[1] = '0100';
  assert.deepEqual(parseQrBill(wrongVersion.join('\n')), { ok: false, reason: 'not_swiss_qr' });
  assert.deepEqual(parseQrBill(EXAMPLE_QRR.slice(0, 30).join('\n')), {
    ok: false,
    reason: 'not_swiss_qr',
  });
});

test('Rechnungsinformationen: Skonto zuerst, zaehlt die Frist ohne Skonto', () => {
  assert.deepEqual(
    parseBillInfo(
      '//S1/10/10201409/11/190512/20/1400.000-53/30/106017086/31/180508180331/32/7.7/40/2:10;0:30',
    ),
    {
      invoiceNumber: '10201409',
      documentDay: '2019-05-12',
      paymentDays: 30,
      dueDay: '2019-06-11',
    },
  );
});

test('Rechnungsinformationen: geschuetzter Schraegstrich und fehlende Frist', () => {
  const info = parseBillInfo('//S1/10/X.66711\\/8824/11/200712');
  assert.equal(info?.invoiceNumber, 'X.66711/8824');
  assert.equal(info?.documentDay, '2020-07-12');
  assert.equal(info?.paymentDays, null);
  assert.equal(info?.dueDay, null);
});

test('Rechnungsinformationen: ueber das Monatsende und krummes Datum', () => {
  assert.equal(parseBillInfo('//S1/11/260131/40/0:30')?.dueDay, '2026-03-02');
  assert.equal(parseBillInfo('//S1/11/261231/40/0:10')?.dueDay, '2027-01-10');
  assert.equal(parseBillInfo('//S1/11/260230/40/0:30')?.dueDay, null);
  assert.equal(parseBillInfo('//XY/irgendwas'), null);
});
