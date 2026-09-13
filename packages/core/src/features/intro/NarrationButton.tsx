import { Pressable, StyleSheet } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, IconButton, Text } from '@/ui';

import type { Narration } from './narration';

export type NarrationButtonProps = {
  narration: Narration;
  /** `pill` sagt in Worten, dass ein Tipp ihn hoerbar macht — fuer den allerersten Bildschirm. */
  variant?: 'icon' | 'pill';
};

/**
 * Der Lautsprecher bei seiner Blase. Solange der Browser noch keinen Ton
 * erlaubt, bittet er um einen Tipp — der Tipp selbst ist die Erlaubnis, danach
 * beginnt er. Sonst schaltet er ihn stumm und wieder laut.
 */
export function NarrationButton({ narration, variant = 'icon' }: NarrationButtonProps) {
  const t = useTranslate();
  const theme = useTheme();

  if (!narration.available) return null;

  if (narration.waiting && variant === 'pill') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('intro.voice.tapToHear')}
        // Mehr braucht es nicht: mit dem Tipp erlaubt der Browser Ton.
        onPress={() => undefined}
        style={({ pressed }) => [
          styles.pill,
          {
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Icon name="volume" size={theme.fontSize.md} color={theme.colors.accentStrong} />
        <Text variant="caption" tone="muted">
          {t('intro.voice.tapToHear')}
        </Text>
      </Pressable>
    );
  }

  return (
    <IconButton
      icon={narration.muted ? 'mute' : 'volume'}
      tone={narration.waiting ? 'accent' : 'faint'}
      label={t(
        narration.waiting
          ? 'intro.voice.tapToHear'
          : narration.muted
            ? 'intro.voice.unmute'
            : 'intro.voice.mute',
      )}
      onPress={narration.waiting ? () => undefined : narration.toggle}
    />
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', borderWidth: 1 },
});
