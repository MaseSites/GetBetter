import type { deMoneyPlus } from './de-moneyplus';

/** BetterMoney: ritmo del budget, prossimo addebito, incollare una QR-fattura. Complete: a missing key is a type error. */
export const itMoneyPlus: Readonly<Record<keyof typeof deMoneyPlus, string>> = {
  'moneyplus.pace.perDay': 'Ancora {amount} al giorno',
  'moneyplus.pace.ahead': '{amount} sopra il piano · ancora {perDay} al giorno',
  'moneyplus.pace.over': '{amount} sopra il budget',

  'moneyplus.sub.startDay': 'Addebitato il',
  'moneyplus.sub.next': '{interval} · {when}',

  'moneyplus.category.guessed': 'Riconosciuto dalla nota',

  'moneyplus.qr.open': 'Incolla QR-fattura',
  'moneyplus.qr.label': 'Testo del codice QR',
  'moneyplus.qr.placeholder': 'Inizia con SPC',
  'moneyplus.qr.apply': 'Riprendi',
  'moneyplus.qr.eur': 'Importo in euro – inseriscilo in franchi.',
  'moneyplus.qr.error.not_swiss_qr': 'Questo non è il testo di una QR-fattura.',
  'moneyplus.qr.error.bad_iban': 'Il numero di conto (IBAN) non è valido.',
  'moneyplus.qr.error.bad_amount': 'L’importo della QR-fattura non è valido.',
  'moneyplus.qr.error.bad_currency': 'Solo franchi ed euro.',
  'moneyplus.qr.error.bad_reference': 'Il riferimento non corrisponde al numero di conto.',
  'moneyplus.qr.error.bad_checksum': 'La cifra di controllo è sbagliata – copialo di nuovo.',
  'moneyplus.bill.dueOn': 'Il {date}',
};
