/** BetterMoney: Budget-Tempo, nächste Abbuchung der Abos, QR-Rechnung einfügen. Teil von `de` per Spread. */
export const deMoneyPlus = {
  // Budget-Tempo (features/money/pace.ts)
  'moneyplus.pace.perDay': 'Noch {amount} pro Tag',
  'moneyplus.pace.ahead': '{amount} über dem Plan · noch {perDay} pro Tag',
  'moneyplus.pace.over': '{amount} über dem Budget',

  // Nächste Abbuchung (features/money/nextCharge.ts)
  'moneyplus.sub.startDay': 'Abgebucht am',
  'moneyplus.sub.next': '{interval} · {when}',

  // Kategorie aus der Notiz (features/money/categories.ts)
  'moneyplus.category.guessed': 'Aus der Notiz erkannt',

  // QR-Rechnung einfügen (features/money/qrBill.ts)
  'moneyplus.qr.open': 'QR-Rechnung einfügen',
  'moneyplus.qr.label': 'Text aus dem QR-Code',
  'moneyplus.qr.placeholder': 'Beginnt mit SPC',
  'moneyplus.qr.apply': 'Übernehmen',
  'moneyplus.qr.eur': 'Betrag in Euro – bitte in Franken eintragen.',
  'moneyplus.qr.error.not_swiss_qr': 'Das ist kein Text einer QR-Rechnung.',
  'moneyplus.qr.error.bad_iban': 'Die Kontonummer (IBAN) stimmt nicht.',
  'moneyplus.qr.error.bad_amount': 'Der Betrag in der QR-Rechnung ist ungültig.',
  'moneyplus.qr.error.bad_currency': 'Nur Franken und Euro gehen.',
  'moneyplus.qr.error.bad_reference': 'Die Referenz passt nicht zur Kontonummer.',
  'moneyplus.qr.error.bad_checksum': 'Die Prüfziffer stimmt nicht – bitte nochmals kopieren.',
  'moneyplus.bill.dueOn': 'Am {date}',
} as const;
