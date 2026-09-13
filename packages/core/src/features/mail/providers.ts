import type { MailProviderNote } from '../../db/mail';
import type { TranslationKey } from '../../i18n';

export type MailProviderKey = 'gmail' | 'icloud' | 'outlook' | 'gmx' | 'bluewin' | 'other';

/** Ein Anbieter zum Antippen, bevor es ein Postfach gibt: Beispieladresse und was er braucht. */
export type MailProviderChoice = {
  key: MailProviderKey;
  /** Fuer die Beispieladresse im Feld; `null` bei „Andere“. */
  domain: string | null;
  note: MailProviderNote | null;
};

/** Dieselben Hinweise, die der Dienst zu diesen Anbietern kennt (`mail/providers.js`). */
export const MAIL_PROVIDER_CHOICES: readonly MailProviderChoice[] = [
  { key: 'gmail', domain: 'gmail.com', note: 'app_password' },
  { key: 'icloud', domain: 'icloud.com', note: 'app_password' },
  { key: 'outlook', domain: 'outlook.com', note: 'oauth_only' },
  { key: 'gmx', domain: 'gmx.ch', note: 'enable_imap' },
  { key: 'bluewin', domain: 'bluewin.ch', note: null },
  { key: 'other', domain: null, note: null },
];

export const PROVIDER_LABEL_KEYS: Readonly<Record<MailProviderKey, TranslationKey>> = {
  gmail: 'mailui.provider.gmail',
  icloud: 'mailui.provider.icloud',
  outlook: 'mailui.provider.outlook',
  gmx: 'mailui.provider.gmx',
  bluewin: 'mailui.provider.bluewin',
  other: 'mailui.provider.other',
};

/** Was ein Anbieter braucht, als Satz mit `{name}`. */
export const MAIL_NOTE_KEYS: Readonly<Record<MailProviderNote, TranslationKey>> = {
  app_password: 'mail.add.note.appPassword',
  enable_imap: 'mail.add.note.enableImap',
  oauth_only: 'mail.add.note.oauthOnly',
};
