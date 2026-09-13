import type { MailFolderRole } from '@/db/types';
import type { IconName } from '@/ui';

/** Ein Symbol je Ordner — dieselben in der Leiste, im Blatt und beim Verschieben. */
export const FOLDER_ICONS: Readonly<Record<MailFolderRole, IconName>> = {
  inbox: 'inbox',
  sent: 'send',
  drafts: 'note',
  junk: 'warning',
  trash: 'trash',
  archive: 'briefcase',
};

/**
 * Die Toene der Postfaecher, reihum vergeben. Sechs reichen: mehr Adressen
 * haelt ohnehin niemand auseinander, und die Farben sind dieselben, die die
 * Bereiche der Apps tragen.
 */
const MAILBOX_HUES = ['organisation', 'money', 'household', 'ai', 'health', 'neutral'] as const;

/** Welche Farbe das Postfach an dieser Stelle traegt. */
export function mailboxHue(index: number): string {
  return MAILBOX_HUES[index % MAILBOX_HUES.length] ?? 'neutral';
}
