import type { deMoneyPlus } from './de-moneyplus';

/** BetterMoney : rythme du budget, prochain prélèvement, coller une QR-facture. Complete: a missing key is a type error. */
export const frMoneyPlus: Readonly<Record<keyof typeof deMoneyPlus, string>> = {
  'moneyplus.pace.perDay': 'Encore {amount} par jour',
  'moneyplus.pace.ahead': '{amount} au-dessus du plan · encore {perDay} par jour',
  'moneyplus.pace.over': '{amount} au-dessus du budget',

  'moneyplus.sub.startDay': 'Prélevé le',
  'moneyplus.sub.next': '{interval} · {when}',

  'moneyplus.category.guessed': 'Reconnu dans la note',

  'moneyplus.qr.open': 'Coller une QR-facture',
  'moneyplus.qr.label': 'Texte du code QR',
  'moneyplus.qr.placeholder': 'Commence par SPC',
  'moneyplus.qr.apply': 'Reprendre',
  'moneyplus.qr.eur': 'Montant en euros – saisis-le en francs.',
  'moneyplus.qr.error.not_swiss_qr': 'Ce n’est pas le texte d’une QR-facture.',
  'moneyplus.qr.error.bad_iban': 'Le numéro de compte (IBAN) n’est pas valable.',
  'moneyplus.qr.error.bad_amount': 'Le montant de la QR-facture n’est pas valable.',
  'moneyplus.qr.error.bad_currency': 'Seuls les francs et les euros sont acceptés.',
  'moneyplus.qr.error.bad_reference': 'La référence ne correspond pas au numéro de compte.',
  'moneyplus.qr.error.bad_checksum': 'Le chiffre de contrôle est faux – copie-le encore une fois.',
  'moneyplus.bill.dueOn': 'Le {date}',
};
