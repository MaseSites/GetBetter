import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { HIT_TARGET, Text } from '@/ui';

/** Kopf eines Blatts: Titel links, „Sichern“ rechts — aktiv, sobald es etwas zu sichern gibt. */
export function SheetHeader({
  title,
  saveLabel,
  canSave,
  onSave,
}: {
  title: string;
  saveLabel: string;
  canSave: boolean;
  onSave: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing.md, minHeight: HIT_TARGET }]}>
      <Text variant="title" numberOfLines={1} style={styles.grow}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saveLabel}
        accessibilityState={{ disabled: !canSave }}
        disabled={!canSave}
        onPress={onSave}
        hitSlop={theme.spacing.md}
        style={({ pressed }) => [styles.save, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Text
          variant="body"
          style={{
            fontWeight: theme.fontWeight.semibold,
            color: canSave ? theme.colors.accentStrong : theme.colors.disabledText,
          }}
        >
          {saveLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  save: { minHeight: HIT_TARGET, justifyContent: 'center' },
});
