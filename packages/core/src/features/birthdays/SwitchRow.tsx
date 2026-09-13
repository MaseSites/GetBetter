import { StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '@/theme';
import { HIT_TARGET, Text } from '@/ui';

/** Eine Zeile mit Schalter: „Jahr bekannt“, „1 Woche vorher“, „Nahestehend“. */
export function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing.md, minHeight: HIT_TARGET }]}>
      <Text variant="body" style={styles.grow}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
        thumbColor={theme.colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
