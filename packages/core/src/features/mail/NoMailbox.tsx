import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, PlainList, PlainRow, Text } from '@/ui';

import { MAIL_PROVIDER_CHOICES, PROVIDER_LABEL_KEYS, type MailProviderChoice } from './providers';

/**
 * Noch kein Postfach: grosse Zeilen fuer die Anbieter. Ein Tipp beginnt die
 * Anmeldung mit diesem Anbieter; darunter der eine Satz, was Gmail, iCloud und
 * GMX brauchen.
 */
export function NoMailbox({ onChoose }: { onChoose: (choice: MailProviderChoice) => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <View style={{ paddingHorizontal: theme.spacing.edge, gap: theme.spacing.md }}>
      <PlainList>
        {MAIL_PROVIDER_CHOICES.map((choice) => (
          <PlainRow
            key={choice.key}
            title={t(PROVIDER_LABEL_KEYS[choice.key])}
            subtitle={choice.domain ?? t('mailui.provider.otherHint')}
            leading={<Icon name={choice.key === 'other' ? 'at' : 'mail'} size={22} />}
            trailing={<Icon name="forward" size={16} color={theme.colors.textFaint} />}
            onPress={() => onChoose(choice)}
          />
        ))}
      </PlainList>
      <Text variant="label" tone="muted">
        {t('mailui.setup.note')}
      </Text>
    </View>
  );
}
