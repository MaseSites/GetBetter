import { tasks as taskRepo } from '@/db/repositories';
import type { MailAddress } from '@/db/types';
import { useTranslate } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useUndo } from '@/ui';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';

import { taskFromMail } from './toTask';

/**
 * „Als Aufgabe“: legt aus einer Mail eine Aufgabe für heute an — über das
 * Aufgaben-Repository wie jede andere —, feiert kurz und bietet „Rückgängig“.
 * Die Aufgabe steht danach sofort unter dem Zeitstrahl.
 */
export function useMailToTask(): (message: {
  id: string;
  subject: string;
  from: MailAddress;
}) => Promise<void> {
  const t = useTranslate();
  const account = useAccount();
  const undo = useUndo();
  const celebrate = useCelebrate();

  return async (message) => {
    const draft = taskFromMail(message, new Date(), {
      title: t('orgplus.mail.taskTitle', { subject: '{subject}' }),
      noSubject: t('mail.noSubject'),
      from: t('orgplus.mail.taskFrom', { sender: '{sender}' }),
    });
    const row = await taskRepo.create({
      accountId: account.id,
      householdId: null,
      title: draft.title,
      notes: draft.notes,
      dueAt: draft.dueAt,
    });
    celebrate('task');
    undo.show({
      message: t('orgplus.mail.taskCreated'),
      onUndo: () => void taskRepo.remove(row.id),
    });
  };
}
