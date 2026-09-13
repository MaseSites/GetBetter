import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, Text } from '@/ui';

/**
 * Der minimierte Entwurf: eine Leiste am unteren Rand, „Entwurf: Offerte
 * Maler“. Ein Tipp holt das Blatt zurueck.
 */
export function DraftBar({
  subject,
  bottom,
  onOpen,
}: {
  subject: string;
  /** Abstand vom unteren Rand — ueber dem, was dort schon steht. */
  bottom: number;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const label = t('mailui.draftBar', {
    subject: subject.trim() || t('mailui.compose.new'),
  });

  return (
    <View style={[styles.host, { bottom, left: theme.spacing.lg, right: theme.spacing.lg }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.bar,
          theme.elevation.raised,
          {
            minHeight: HIT_TARGET,
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surface,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon name="note" size={18} color={theme.colors.textMuted} />
        <Text variant="label" numberOfLines={1} style={styles.grow}>
          {label}
        </Text>
        <View style={styles.flip}>
          <Icon name="down" size={16} color={theme.colors.textMuted} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute' },
  bar: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  flip: { transform: [{ rotate: '180deg' }] },
});
