import { View } from 'react-native';

import { contacts as contactRepo, type BirthdayReminders, type ContactRow } from '@/db';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Sheet, Text } from '@/ui';

import { remindersOf } from './birthdays';
import { SwitchRow } from './SwitchRow';

/**
 * Die Erinnerungen einer Person. Gespeichert wird schon jetzt; zugestellt
 * wird erst, wenn die App Mitteilungen schicken kann — das sagt ein Satz.
 */
export function RemindersSheet({
  visible,
  contact,
  onClose,
}: {
  visible: boolean;
  contact: ContactRow;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const reminders = remindersOf(contact);

  function change(patch: Partial<BirthdayReminders>) {
    void contactRepo.update(contact.id, { birthdayReminders: { ...reminders, ...patch } });
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('birthdays.reminders')}>
      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
        <SwitchRow
          label={t('birthdays.reminders.weekBefore')}
          value={reminders.weekBefore}
          onChange={(value) => change({ weekBefore: value })}
        />
        <SwitchRow
          label={t('birthdays.reminders.dayOf')}
          value={reminders.dayOf}
          onChange={(value) => change({ dayOf: value })}
        />
        <SwitchRow
          label={t('birthdays.reminders.close')}
          value={contact.close === true}
          onChange={(value) => void contactRepo.update(contact.id, { close: value })}
        />
        <Text variant="caption" tone="faint">
          {t('birthdays.reminders.pending')}
        </Text>
      </View>
    </Sheet>
  );
}
