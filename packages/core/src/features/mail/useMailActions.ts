import { mail, type MailError, type MailMessage } from '@/db/mail';
import type { MailFolderRole } from '@/db/types';
import { useI18n, type TranslationKey } from '@/i18n';
import { useUndo } from '@/ui';

import { FOLDER_LABEL_KEYS, mailErrorKey } from './format';
import { findMoved, movedOf, type MovedMail } from './threads';

export type MailActions = {
  setSeen: (messages: readonly MailMessage[], seen: boolean) => Promise<boolean>;
  setFlag: (messages: readonly MailMessage[], flagged: boolean) => Promise<boolean>;
  /** Archivieren, Spam, Verschieben — mit „Rückgängig“. */
  moveTo: (messages: readonly MailMessage[], role: MailFolderRole) => Promise<boolean>;
  /** In den Papierkorb — mit „Rückgängig“. */
  remove: (messages: readonly MailMessage[]) => Promise<boolean>;
  /** Aus dem Papierkorb endgueltig — ohne Rückgängig, die Rueckfrage kommt vorher. */
  purge: (messages: readonly MailMessage[]) => Promise<boolean>;
};

const TOAST_BY_ROLE: Partial<Record<MailFolderRole, TranslationKey>> = {
  archive: 'mailui.toast.archived',
  junk: 'mailui.toast.spam',
  trash: 'mailui.toast.deleted',
};

/**
 * Die Handgriffe auf Nachrichten, mit Rueckmeldung unten mittig. Rückgängig
 * verschiebt zurueck: dafuer wird erst abgeglichen, denn eine verschobene Mail
 * hat im Zielordner eine neue Id.
 */
export function useMailActions(accountId: string): MailActions {
  const { t } = useI18n();
  const undo = useUndo();

  function fail(error: MailError) {
    undo.show({ message: t(mailErrorKey(error)) });
  }

  async function restore(moved: readonly MovedMail[]) {
    await mail.sync(accountId);
    const groups = findMoved(await mail.messages(accountId), moved);
    if (groups.length === 0) {
      undo.show({ message: t('mailui.toast.undoFailed') });
      return;
    }
    for (const group of groups) {
      const result = await mail.act({ ids: group.ids, action: 'move', role: group.role });
      if (!result.ok) {
        fail(result.error);
        return;
      }
    }
  }

  async function flagLike(
    messages: readonly MailMessage[],
    action: 'seen' | 'unseen' | 'flag' | 'unflag',
  ) {
    if (messages.length === 0) return true;
    const result = await mail.act({ ids: messages.map((message) => message.id), action });
    if (!result.ok) fail(result.error);
    return result.ok;
  }

  async function leave(messages: readonly MailMessage[], role: MailFolderRole) {
    const moving = messages.filter((message) => message.folderRole !== role);
    if (moving.length === 0) return true;
    const moved = movedOf(moving, role);
    const ids = moving.map((message) => message.id);
    const result =
      role === 'trash'
        ? await mail.act({ ids, action: 'delete' })
        : await mail.act({ ids, action: 'move', role });
    if (!result.ok) {
      fail(result.error);
      return false;
    }
    const key = TOAST_BY_ROLE[role];
    undo.show({
      message: key ? t(key) : t('mailui.toast.moved', { folder: t(FOLDER_LABEL_KEYS[role]) }),
      onUndo: () => void restore(moved),
    });
    return true;
  }

  return {
    setSeen: (messages, seen) =>
      flagLike(
        messages.filter((message) => message.seen !== seen),
        seen ? 'seen' : 'unseen',
      ),
    setFlag: (messages, flagged) =>
      flagLike(
        messages.filter((message) => message.flagged !== flagged),
        flagged ? 'flag' : 'unflag',
      ),
    moveTo: leave,
    remove: (messages) => leave(messages, 'trash'),
    purge: async (messages) => {
      if (messages.length === 0) return true;
      const result = await mail.act({
        ids: messages.map((message) => message.id),
        action: 'delete',
      });
      if (!result.ok) {
        fail(result.error);
        return false;
      }
      undo.show({ message: t('mailui.toast.purged') });
      return true;
    },
  };
}
