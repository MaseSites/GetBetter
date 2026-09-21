import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

/** Das Schloss am Ende einer gesperrten Zeile in den Einstellungen. */
export function LockMark() {
  const theme = useTheme();
  return <Icon name="lock" size={theme.fontSize.md} color={theme.colors.textMuted} />;
}

/** Neben einer Überschrift: ein Schloss und „Abo“ — hier geht es erst mit dem Abo weiter. */
export function LockBadge() {
  const t = useTranslate();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          gap: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radii.pill,
          borderColor: theme.colors.textFaint,
        },
      ]}
    >
      <Icon name="lock" size={theme.fontSize.xs} color={theme.colors.textMuted} />
      <Text variant="caption" tone="muted">
        {t('plan.locked')}
      </Text>
    </View>
  );
}

/**
 * „Mit Abo personalisierbar · Abo ansehen“ als kleine Karte. Ein Tipp öffnet
 * das Abo — die Karte steht allein, nie in einem anderen Knopf.
 */
export function PlanHint({ onPress }: { onPress: () => void }) {
  const t = useTranslate();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('plan.hint')}. ${t('plan.see')}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        theme.elevation.card,
        {
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surface,
          transform: [{ scale: pressed ? theme.motion.pressScale.row : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.badge,
          { borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentSoft },
        ]}
      >
        <Icon name="lock" size={theme.fontSize.md} color={theme.colors.accentStrong} />
      </View>
      <View style={styles.grow}>
        <Text variant="label">{t('plan.hint')}</Text>
        <Text variant="caption" tone="accent">
          {t('plan.see')}
        </Text>
      </View>
      <Icon name="forward" size={theme.fontSize.md} color={theme.colors.textFaint} />
    </Pressable>
  );
}

const BADGE = 34;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 0 },
  grow: { flex: 1, minWidth: 0 },
  badge: { width: BADGE, height: BADGE, alignItems: 'center', justifyContent: 'center' },
});
