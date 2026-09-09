import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { IconButton, ProgressBar, Text } from '@/ui';

export { ProgressBar };

/** Der Papierkorb rechts in einer Zeile, die selbst nicht drueckbar ist. */
export function RemoveButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return <IconButton icon="trash" label={t('common.remove')} onPress={onPress} />;
}

/** Betrag und, wenn gewuenscht, der Papierkorb daneben. */
export function AmountCell({ amount, onRemove }: { amount: string; onRemove?: () => void }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Text variant="label" tone="muted">
        {amount}
      </Text>
      {onRemove ? <RemoveButton onPress={onRemove} /> : null}
    </View>
  );
}
