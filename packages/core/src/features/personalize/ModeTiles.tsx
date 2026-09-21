import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useApp, type Appearance } from '@/state/AppContext';
import { createPalette, lightPalette, useTheme } from '@/theme';
import { Text, usePressScale } from '@/ui';

const MODES: readonly Appearance['mode'][] = ['light', 'dark', 'system'];
const darkPalette = createPalette('dark');

/**
 * Hell, Dunkel, Automatisch — drei Kacheln, jede mit einer kleinen Vorschau
 * ihrer selbst. Sie stehen im `StylePicker`, also dort, wo das ganze Aussehen
 * gemacht wird: in den Einstellungen und beim Einrichten, sonst nirgends.
 */
export function ModeTiles() {
  const t = useTranslate();
  const theme = useTheme();
  const { appearance, setAppearance } = useApp();

  return (
    <View style={[styles.tiles, { gap: theme.spacing.sm }]}>
      {MODES.map((mode) => (
        <ModeTile
          key={mode}
          mode={mode}
          label={t(`intro.setup.style.mode.${mode}`)}
          selected={appearance.mode === mode}
          onPress={() => void setAppearance({ mode })}
        />
      ))}
    </View>
  );
}

function ModeTile({
  mode,
  label,
  selected,
  onPress,
}: {
  mode: Appearance['mode'];
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const palette = mode === 'dark' ? darkPalette : lightPalette;

  const bars = (
    <>
      <View
        style={[
          styles.bar,
          {
            top: 9,
            width: 34,
            backgroundColor: mode === 'system' ? lightPalette.textFaint : palette.text,
          },
        ]}
      />
      <View
        style={[
          styles.bar,
          {
            top: 19,
            width: 22,
            backgroundColor: mode === 'system' ? lightPalette.textFaint : palette.borderStrong,
          },
        ]}
      />
      <View style={[styles.bar, { top: 29, width: 28, backgroundColor: lightPalette.accent }]} />
      <View
        style={[
          styles.bar,
          {
            top: 39,
            width: 18,
            backgroundColor: mode === 'system' ? lightPalette.textFaint : palette.borderStrong,
          },
        ]}
      />
    </>
  );

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.tileCell}
    >
      <Animated.View
        style={[
          theme.elevation.card,
          {
            padding: theme.spacing.sm,
            borderRadius: theme.radii.item,
            backgroundColor: theme.colors.surface,
            transform: [{ scale: press.scale }],
          },
          selected ? { boxShadow: `0 0 0 2px ${theme.colors.text}` } : null,
        ]}
      >
        {mode === 'system' ? (
          <LinearGradient
            colors={[
              lightPalette.background,
              lightPalette.background,
              darkPalette.background,
              darkPalette.background,
            ]}
            locations={[0, 0.5, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.2 }}
            style={[
              styles.preview,
              { borderRadius: theme.radii.xs, borderColor: lightPalette.border },
            ]}
          >
            {bars}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.preview,
              {
                borderRadius: theme.radii.xs,
                backgroundColor: palette.background,
                borderColor: mode === 'light' ? lightPalette.border : darkPalette.background,
              },
            ]}
          >
            {bars}
          </View>
        )}
        <Text
          variant="caption"
          align="center"
          numberOfLines={1}
          style={{
            marginTop: theme.spacing.sm,
            fontSize: theme.fontSize.caption,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row' },
  tileCell: { flex: 1, minWidth: 0 },
  preview: { height: 56, borderWidth: 1, overflow: 'hidden' },
  bar: { position: 'absolute', left: 9, height: 5, borderRadius: 999 },
});
