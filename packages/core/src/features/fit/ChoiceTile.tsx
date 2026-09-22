import { ActivityIndicator, Animated, Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { Icon, Text, usePressScale, type IconName } from '@/ui';

/**
 * Eine grosse Antwort zum Antippen — beim Einrichten und bei der Wahl des
 * Studios. Ganze Zeile drueckbar (weit ueber 44 pt), Haekchen bei der Wahl,
 * damit nicht nur die Farbe sagt, was gewaehlt ist.
 *
 * Als `button` (im Plus: Foto, Suche, Wie immer) ist es eine Handlung, keine
 * Wahl: kein Haekchen, dafuer `busy` mit Kreisel, solange eingetragen wird —
 * und gesperrt, damit ein zweiter Tipp nichts doppelt anlegt.
 */
export function ChoiceTile({
  title,
  hint,
  icon,
  selected = false,
  onPress,
  role = 'radio',
  busy = false,
  disabled = false,
}: {
  title: string;
  hint?: string;
  icon?: IconName;
  selected?: boolean;
  onPress: () => void;
  /** `checkbox`, wo mehrere gehen (Allergien, Geraete); `button` fuer eine Handlung. */
  role?: 'radio' | 'checkbox' | 'button';
  busy?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const locked = busy || disabled;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={
        role === 'button' ? { busy, disabled: locked } : { checked: selected, disabled: locked }
      }
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
      disabled={locked}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          theme.elevation.card,
          {
            transform: [{ scale: press.scale }],
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radii.panel,
            backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
            borderWidth: 2,
            borderColor: selected ? theme.colors.accentMark : 'transparent',
            opacity: disabled && !busy ? 0.5 : 1,
          },
        ]}
      >
        {icon ? (
          <View
            style={{
              width: theme.spacing.xxl + theme.spacing.sm,
              height: theme.spacing.xxl + theme.spacing.sm,
              borderRadius: theme.radii.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <Icon name={icon} size={theme.fontSize.lg} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
            {title}
          </Text>
          {hint ? (
            <Text
              variant="caption"
              tone="faint"
              style={{ fontSize: theme.fontSize.sm, lineHeight: theme.lineHeight.sm }}
            >
              {hint}
            </Text>
          ) : null}
        </View>
        {busy ? (
          <ActivityIndicator color={theme.colors.textMuted} />
        ) : selected ? (
          <Icon name="checkCircle" size={theme.fontSize.lg} color={theme.colors.accentMark} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
