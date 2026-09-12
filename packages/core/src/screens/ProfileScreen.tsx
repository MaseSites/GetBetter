import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsGroup } from '@/features/personalize/SettingsList';
import { formatMonth, useI18n, type TranslationKey } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { createPalette, lightPalette, useTheme } from '@/theme';
import { Avatar, Card, Screen, Text, usePressScale } from '@/ui';

const MODES = ['light', 'dark', 'system'] as const;
const darkPalette = createPalette('dark');

/**
 * Das Profil: oben wer du bist, darunter der Weg in die Einstellungen — dort
 * wird alles geaendert. Hier bleibt nur der schnelle Griff zu hell und dunkel.
 */
export function ProfileScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const router = useRouter();
  const { appearance, setAppearance } = useApp();

  const handle = account.username ? `@${account.username}` : account.email;
  const since = t('profile.since', { date: formatMonth(language, new Date(account.createdAt)) });

  return (
    <Screen gap={theme.spacing.lg}>
      <View
        style={[styles.me, { gap: theme.spacing.md, paddingTop: insets.top + theme.spacing.xl }]}
      >
        <Avatar name={account.firstName || account.email} size={60} />
        <View style={styles.grow}>
          <Text
            variant="display"
            numberOfLines={1}
            style={{ fontSize: theme.fontSize.xl - 2, lineHeight: theme.lineHeight.xl - 4 }}
          >
            {account.firstName || t('profile.noName')}
          </Text>
          <Text variant="label" tone="faint" numberOfLines={1}>
            {`${handle} · ${since}`}
          </Text>
        </View>
      </View>

      <Card
        title={t('settings.title')}
        subtitle={t('settings.card.hint')}
        onPress={() => router.push('/settings')}
      />

      <SettingsGroup title={t('profile.appearance')}>
        <View style={[styles.tiles, { gap: theme.spacing.sm }]}>
          {MODES.map((mode) => (
            <ModeTile
              key={mode}
              mode={mode}
              label={t(`appearance.mode.${mode}` as TranslationKey)}
              selected={appearance.mode === mode}
              onPress={() => void setAppearance({ mode })}
            />
          ))}
        </View>
      </SettingsGroup>
    </Screen>
  );
}

/** Hell, Dunkel, Geraet — jede Kachel zeigt eine kleine Vorschau ihrer selbst. */
function ModeTile({
  mode,
  label,
  selected,
  onPress,
}: {
  mode: (typeof MODES)[number];
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
  me: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  tiles: { flexDirection: 'row' },
  tileCell: { flex: 1, minWidth: 0 },
  preview: { height: 56, borderWidth: 1, overflow: 'hidden' },
  bar: { position: 'absolute', left: 9, height: 5, borderRadius: 999 },
});
