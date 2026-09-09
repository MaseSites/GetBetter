import { Pressable, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

/** Ein Balken, der sagt, wie viel vom Ganzen erreicht oder verbraucht ist. */
export function ProgressBar({ share, warn = false }: { share: number; warn?: boolean }) {
  const theme = useTheme();
  const width = Math.max(0, Math.min(1, share));

  return (
    <View
      style={{
        width: '100%',
        height: theme.spacing.sm,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${width * 100}%`,
          height: '100%',
          backgroundColor: warn ? theme.colors.danger : theme.colors.accent,
        }}
      />
    </View>
  );
}

/**
 * Der Papierkorb rechts in einer Zeile. Nur dort, wo die Zeile selbst nicht
 * drueckbar ist — ein Knopf im Knopf waere im Browser ungueltig.
 */
export function RemoveButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('money.remove')}
      onPress={onPress}
      hitSlop={theme.spacing.md}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: theme.spacing.xs })}
    >
      <Icon name="trash" size={18} color={theme.colors.textFaint} />
    </Pressable>
  );
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
