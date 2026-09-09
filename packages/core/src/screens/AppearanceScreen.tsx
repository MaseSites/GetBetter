import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { groupedModules } from '@/mocks/modules';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useApp } from '@/state/AppContext';
import {
  ACCENTS,
  ACCENT_KEYS,
  THEME_PRESETS,
  moduleTint,
  useTheme,
  type AccentKey,
  type ThemePreset,
} from '@/theme';
import { Card, Header, Icon, Screen, Segmented, Text } from '@/ui';

const MODE_OPTIONS = ['light', 'dark', 'system'] as const;

/** Aussehen: hell oder dunkel, Akzentfarbe, Voreinstellung. */
export function AppearanceScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { account, appearance, setAppearance } = useApp();

  if (!account) return null;

  return (
    <Screen
      header={
        <Header
          title={t('appearance.title')}
          subtitle={t('appearance.subtitle')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
        />
      }
    >
      <Card title={t('appearance.mode')} subtitle={t('appearance.mode.hint')}>
        <Segmented
          accessibilityLabel={t('appearance.mode')}
          value={appearance.mode}
          onChange={(mode) => void setAppearance({ mode })}
          options={MODE_OPTIONS.map((mode) => ({
            value: mode,
            label: t(`appearance.mode.${mode}` as TranslationKey),
          }))}
        />
      </Card>

      <Card title={t('appearance.preset')} subtitle={t('appearance.preset.hint')}>
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
      </Card>

      <Card
        title={t('appearance.accent')}
        subtitle={
          appearance.preset === 'mono' ? t('appearance.accent.mono') : t('appearance.accent.hint')
        }
      >
        <View style={[styles.row, { gap: theme.spacing.md, flexWrap: 'wrap' }]}>
          {ACCENT_KEYS.map((key) => (
            <AccentSwatch
              key={key}
              accent={key}
              selected={appearance.accent === key}
              onPress={() => void setAppearance({ accent: key })}
            />
          ))}
        </View>
      </Card>

      <Card title={t('appearance.preview')} subtitle={t('appearance.preview.hint')}>
        <View style={[styles.row, { gap: theme.spacing.lg, flexWrap: 'wrap' }]}>
          {groupedModules()
            .flatMap((group) => group.modules)
            .slice(0, 8)
            .map((module) => {
              const tint = moduleTint(theme, module.id);
              return (
                <View key={module.id} style={styles.previewTile}>
                  <View
                    style={[
                      styles.logo,
                      { borderRadius: theme.radii.lg, backgroundColor: tint.background },
                    ]}
                  >
                    <Icon name={module.icon} size={24} color={tint.foreground} />
                  </View>
                  <Text variant="caption" align="center" numberOfLines={1}>
                    {module.name}
                  </Text>
                </View>
              );
            })}
        </View>
      </Card>
    </Screen>
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

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={t(`appearance.preset.${preset}` as TranslationKey)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Icon
        name={selected ? 'checkCircle' : 'circle'}
        size={22}
        color={selected ? theme.colors.accent : theme.colors.borderStrong}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{t(`appearance.preset.${preset}` as TranslationKey)}</Text>
        <Text variant="caption" tone="faint">
          {t(`appearance.preset.${preset}.hint` as TranslationKey)}
        </Text>
      </View>
    </Pressable>
  );
}

function AccentSwatch({
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
      accessibilityLabel={t(`appearance.accent.${accent}` as TranslationKey)}
      onPress={onPress}
      style={[
        styles.swatch,
        { backgroundColor: tone.base, borderColor: selected ? theme.colors.text : 'transparent' },
      ]}
    >
      {selected ? <Icon name="check" size={18} color="#FFFFFF" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTile: { width: 64, alignItems: 'center', gap: 6 },
  logo: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
