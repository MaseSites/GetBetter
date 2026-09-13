import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, Text } from '@/ui';

/** Ein leiser, roter Knopf ganz unten: „Geburtstag entfernen“, „Idee löschen“. */
export function DangerAction({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { gap: theme.spacing.sm, minHeight: HIT_TARGET, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Icon name="trash" size={18} color={theme.colors.danger} />
      <Text variant="label" tone="danger">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
