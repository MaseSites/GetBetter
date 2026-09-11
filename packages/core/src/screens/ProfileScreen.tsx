import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APPS_WITH_HOUSEHOLD, currentApp } from '@/app/identity';
import {
  LANGUAGES,
  LANGUAGE_LABEL,
  formatMonth,
  useI18n,
  type Language,
  type TranslationKey,
} from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { createPalette, lightPalette, useTheme } from '@/theme';
import { Avatar, Button, Icon, Screen, Sheet, Text, usePressScale } from '@/ui';

const MODES = ['light', 'dark', 'system'] as const;
const darkPalette = createPalette('dark');

/**
 * Das Profil, wie im Entwurf: oben wer du bist, darunter Aussehen, Farbe,
 * Konto und Haushalte als kurze Abschnitte — und ganz unten Abmelden.
 * Die Sprache ist eine Zeile im Konto; ein Tipp oeffnet die Auswahl.
 */
export function ProfileScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const router = useRouter();
  const { household, role, setLanguage, signOut, appearance, setAppearance } = useApp();
  const hasHousehold = APPS_WITH_HOUSEHOLD.includes(currentApp().id);
  const calm = appearance.preset === 'mono';
  const [choosingLanguage, setChoosingLanguage] = useState(false);

  const handle = account.username ? `@${account.username}` : account.email;
  const since = t('profile.since', { date: formatMonth(language, new Date(account.createdAt)) });

  return (
    <Screen gap={theme.spacing.lg}>
      <View style={[styles.me, { gap: theme.spacing.md, paddingTop: insets.top + theme.spacing.xl }]}>
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

      <Group title={t('profile.appearance')}>
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
      </Group>

      <Group title={t('profile.color')}>
        <View style={[styles.tiles, { gap: theme.spacing.sm }]}>
          <ColorTile
            dot={lightPalette.accent === theme.colors.accent ? theme.colors.accent : lightPalette.accent}
            label={t('profile.color.signal')}
            hint={t('profile.color.signal.hint')}
            selected={!calm}
            onPress={() => void setAppearance({ preset: 'clean', accent: 'signal' })}
          />
          <ColorTile
            dot={theme.colors.inverse}
            label={t('profile.color.calm')}
            hint={t('profile.color.calm.hint')}
            selected={calm}
            onPress={() => void setAppearance({ preset: 'mono' })}
          />
        </View>
      </Group>

      <Group title={t('profile.account')}>
        <List>
          <Row first label={t('profile.firstName')} value={account.firstName || t('profile.noName')} />
          <Row label={t('profile.username')} value={account.username || account.email} />
          <Row
            label={t('profile.languageSection')}
            value={LANGUAGE_LABEL[language]}
            chevron
            onPress={() => setChoosingLanguage(true)}
          />
          <Row label={t('profile.moreAppearance')} chevron onPress={() => router.push('/appearance')} />
        </List>
      </Group>

      {hasHousehold ? (
        <Group title={t('profile.households')}>
          <List>
            <Row
              first
              label={household ? household.name : t('profile.household.none')}
              value={
                household
                  ? role === 'admin'
                    ? t('household.role.admin')
                    : t('household.role.member')
                  : undefined
              }
              chevron
              onPress={() => router.push('/manage-household')}
            />
            <Row
              label={t('profile.joinHousehold')}
              muted
              chevron
              onPress={() => router.push('/join-household')}
            />
          </List>
        </Group>
      ) : null}

      <Button
        label={t('auth.signOut')}
        variant="secondary"
        onPress={() => {
          void signOut();
        }}
      />

      <Sheet
        visible={choosingLanguage}
        onClose={() => setChoosingLanguage(false)}
        title={t('profile.languageSection')}
      >
        <List>
          {LANGUAGES.map((code: Language, index) => (
            <Row
              key={code}
              first={index === 0}
              label={LANGUAGE_LABEL[code]}
              selected={language === code}
              onPress={() => {
                void setLanguage(code);
                setChoosingLanguage(false);
              }}
            />
          ))}
        </List>
      </Sheet>
    </Screen>
  );
}

/** Kleine Ueberschrift, darunter der Inhalt. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="section" style={[styles.groupTitle, { letterSpacing: theme.tracking.tag }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Eine weisse Karte, in der Zeilen durch Haarlinien getrennt stehen. */
function List({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.list,
        theme.elevation.card,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
      ]}
    >
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  first = false,
  chevron = false,
  muted = false,
  selected,
  onPress,
}: {
  label: string;
  value?: string;
  first?: boolean;
  chevron?: boolean;
  /** Leiser Titel — fuer Zeilen, die etwas anbieten statt etwas zeigen. */
  muted?: boolean;
  /** Fuer Auswahllisten: zeigt den Haken. */
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);

  const body = (
    <Animated.View
      style={[
        styles.row,
        {
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.md,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          transform: onPress ? [{ scale: press.scale }] : [],
        },
      ]}
    >
      <Text
        variant="label"
        tone={muted ? 'muted' : 'default'}
        numberOfLines={1}
        style={[styles.grow, { fontSize: theme.fontSize.md }]}
      >
        {label}
      </Text>
      {value ? (
        <Text variant="label" tone="muted" numberOfLines={1} style={{ fontSize: theme.fontSize.lede }}>
          {value}
        </Text>
      ) : null}
      {selected ? <Icon name="check" size={18} color={theme.colors.accentStrong} /> : null}
      {chevron ? <Icon name="forward" size={15} color={theme.colors.borderStrong} /> : null}
    </Animated.View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      {body}
    </Pressable>
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
      <View style={[styles.bar, { top: 9, width: 34, backgroundColor: mode === 'system' ? lightPalette.textFaint : palette.text }]} />
      <View style={[styles.bar, { top: 19, width: 22, backgroundColor: mode === 'system' ? lightPalette.textFaint : palette.borderStrong }]} />
      <View style={[styles.bar, { top: 29, width: 28, backgroundColor: lightPalette.accent }]} />
      <View style={[styles.bar, { top: 39, width: 18, backgroundColor: mode === 'system' ? lightPalette.textFaint : palette.borderStrong }]} />
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
            colors={[lightPalette.background, lightPalette.background, darkPalette.background, darkPalette.background]}
            locations={[0, 0.5, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.2 }}
            style={[styles.preview, { borderRadius: theme.radii.xs, borderColor: lightPalette.border }]}
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
          style={{ marginTop: theme.spacing.sm, fontSize: theme.fontSize.caption, fontWeight: theme.fontWeight.semibold }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Signal oder Ruhig — ein Punkt, ein Name, ein Satz. */
function ColorTile({
  dot,
  label,
  hint,
  selected,
  onPress,
}: {
  dot: string;
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();

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
          styles.colorTile,
          theme.elevation.card,
          {
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radii.item,
            backgroundColor: theme.colors.surface,
            transform: [{ scale: press.scale }],
          },
          selected ? { boxShadow: `0 0 0 2px ${theme.colors.text}` } : null,
        ]}
      >
        <View style={[styles.dot, { backgroundColor: dot, borderRadius: theme.radii.pill }]} />
        <View style={styles.grow}>
          <Text variant="label" style={{ fontSize: theme.fontSize.lede, fontWeight: theme.fontWeight.semibold }}>
            {label}
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={2}>
            {hint}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  groupTitle: { textTransform: 'uppercase', paddingHorizontal: 2 },
  list: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 50 },
  tiles: { flexDirection: 'row' },
  tileCell: { flex: 1, minWidth: 0 },
  preview: { height: 56, borderWidth: 1, overflow: 'hidden' },
  bar: { position: 'absolute', left: 9, height: 5, borderRadius: 999 },
  colorTile: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 26, height: 26 },
});
