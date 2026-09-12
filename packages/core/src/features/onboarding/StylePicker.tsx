import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BackdropPicker } from '@/features/personalize/BackdropPicker';
import { useTranslate } from '@/i18n';
import { useApp, type Appearance } from '@/state/AppContext';
import {
  ACCENTS,
  ACCENT_KEYS,
  THEME_PRESETS,
  createPalette,
  hueTint,
  useTheme,
  type AccentKey,
  type ThemePreset,
} from '@/theme';
import { Icon, Segmented, Text } from '@/ui';

const MODES: readonly Appearance['mode'][] = ['light', 'dark', 'system'];
/** Drei Bereichsfarben zeigen, wie viel Farbe eine Voreinstellung zulaesst. */
const PREVIEW_HUES = ['organisation', 'health', 'money'] as const;
/** Alle acht Farben in einer Reihe, auch auf einem schmalen Telefon. */
const SWATCH = 32;
const PREVIEW_DOT = 14;
const MONO_DIM = 0.4;

/**
 * Personalisieren mit dem Avatar: Modus, Akzentfarbe, Voreinstellung und der
 * Hintergrund. Alles wirkt sofort — auch auf den Avatar oben.
 */
export function StylePicker() {
  const t = useTranslate();
  const theme = useTheme();
  const { appearance, setAppearance } = useApp();
  const mono = appearance.preset === 'mono';

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Section title={t('intro.setup.style.mode')}>
        <Segmented
          accessibilityLabel={t('intro.setup.style.mode')}
          value={appearance.mode}
          onChange={(mode) => void setAppearance({ mode })}
          options={MODES.map((mode) => ({
            value: mode,
            label: t(`intro.setup.style.mode.${mode}`),
          }))}
        />
      </Section>

      <Section
        title={t('intro.setup.style.accent')}
        hint={mono ? t('intro.setup.style.accentMono') : undefined}
      >
        <View style={[styles.swatches, { opacity: mono ? MONO_DIM : 1 }]}>
          {ACCENT_KEYS.map((key) => (
            <Swatch
              key={key}
              accent={key}
              selected={appearance.accent === key}
              onPress={() => void setAppearance({ accent: key })}
            />
          ))}
        </View>
      </Section>

      <Section title={t('intro.setup.style.preset')}>
        <View style={{ gap: theme.spacing.sm }}>
          {THEME_PRESETS.map((preset) => (
            <PresetRow
              key={preset}
              preset={preset}
              selected={appearance.preset === preset}
              onPress={() => void setAppearance({ preset })}
            />
          ))}
        </View>
      </Section>

      <Section title={t('intro.setup.style.backdrop')}>
        <BackdropPicker />
      </Section>
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="section" tone="muted">
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" tone="faint">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Swatch({
  accent,
  selected,
  onPress,
}: {
  accent: AccentKey;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const tone = ACCENTS[accent][theme.scheme];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={t(`intro.accent.${accent}`)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.swatch,
        styles.center,
        {
          borderRadius: theme.radii.pill,
          backgroundColor: tone.base,
          borderColor: selected ? theme.colors.text : 'transparent',
          transform: [{ scale: pressed ? theme.motion.pressScale.button : 1 }],
        },
      ]}
    >
      {selected ? <Icon name="check" size={16} color={tone.on} /> : null}
    </Pressable>
  );
}

function PresetRow({
  preset,
  selected,
  onPress,
}: {
  preset: ThemePreset;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const { appearance } = useApp();
  // So saehe die App mit dieser Voreinstellung aus — im selben Modus, mit demselben Akzent.
  const look = {
    scheme: theme.scheme,
    preset,
    colors: createPalette(theme.scheme, appearance.accent, preset),
  };

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={t(`appearance.preset.${preset}`)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        theme.elevation.card,
        {
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderWidth: 1.5,
          borderColor: selected ? theme.colors.text : 'transparent',
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.row, { gap: theme.spacing.xs }]}>
        {PREVIEW_HUES.map((hue) => (
          <View
            key={hue}
            style={{
              width: PREVIEW_DOT,
              height: PREVIEW_DOT,
              borderRadius: theme.radii.pill,
              backgroundColor: hueTint(look, hue).gradient[0],
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
            }}
          />
        ))}
      </View>
      <View style={styles.grow}>
        <Text variant="body">{t(`appearance.preset.${preset}`)}</Text>
        <Text variant="caption" tone="faint">
          {t(`appearance.preset.${preset}.hint`)}
        </Text>
      </View>
      <Icon
        name={selected ? 'checkCircle' : 'circle'}
        size={22}
        color={selected ? theme.colors.text : theme.colors.borderStrong}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, gap: 2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  swatch: { width: SWATCH, height: SWATCH, borderWidth: 2 },
});
