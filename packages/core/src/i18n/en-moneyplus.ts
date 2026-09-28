import type { deMoneyPlus } from './de-moneyplus';

/** BetterMoney: budget pace, next subscription charge, paste a QR-bill. Complete: a missing key is a type error. */
export const enMoneyPlus: Readonly<Record<keyof typeof deMoneyPlus, string>> = {
  'moneyplus.pace.perDay': '{amount} a day left',
  'moneyplus.pace.ahead': '{amount} over plan · {perDay} a day left',
  'moneyplus.pace.over': '{amount} over budget',

  'moneyplus.sub.startDay': 'Charged on',
  'moneyplus.sub.next': '{interval} · {when}',

  'moneyplus.category.guessed': 'Recognised from the note',

  'moneyplus.qr.open': 'Paste QR-bill',
  'moneyplus.qr.label': 'Text from the QR code',
  'moneyplus.qr.placeholder': 'Starts with SPC',
  'moneyplus.qr.apply': 'Apply',
  'moneyplus.qr.eur': 'Amount in euros – please enter it in francs.',
  'moneyplus.qr.error.not_swiss_qr': 'This is not the text of a QR-bill.',
  'moneyplus.qr.error.bad_iban': 'The account number (IBAN) is not valid.',
  'moneyplus.qr.error.bad_amount': 'The amount in the QR-bill is not valid.',
  'moneyplus.qr.error.bad_currency': 'Only francs and euros work.',
  'moneyplus.qr.error.bad_reference': 'The reference does not match the account number.',
  'moneyplus.qr.error.bad_checksum': 'The check digit is wrong – please copy it again.',
  'moneyplus.bill.dueOn': 'On {date}',
};
