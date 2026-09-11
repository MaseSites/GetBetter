import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';

import { useHeaderCrumb } from './HeaderCrumb';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

export type HeaderAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Hebt den Knopf hervor, z.B. ein gesetzter Favoritenstern. */
  active?: boolean;
};

export type HeaderProps = {
  /**
   * Kleine Marke ueber dem Titel: Datum, Bereich, Rubrik. Sie ordnet den
   * Bildschirm ein, ohne dem Titel Gewicht wegzunehmen.
   */
  overline?: string;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: readonly HeaderAction[];
  /** Beliebiger Inhalt rechts, z.B. ein Umschalter. */
  right?: ReactNode;
  large?: boolean;
  /**
   * Bereichsmarke ohne Zurueck-Knopf — fuer die Startseiten von BetterGym,
   * BetterFamily und BetterMoney. In Vollansichten kommt sie aus dem Kontext.
   */
  crumb?: { label: string; color: string } | null | undefined;
  children?: ReactNode;
};

/**
 * Zwei Formen:
 *
 * - **Uebersicht** (Heute, Bereiche, Profil) — Titel links, Knoepfe rechts.
 * - **Vollansicht** (mit Zurueck) — oben eine Zeile mit rundem Zurueck-Knopf
 *   und der Bereichsmarke, darunter gross der Titel. So stehen Gesundheit,
 *   Haushalt, Geld und Kalender im Entwurf.
 */
export function Header({
  overline,
  title,
  subtitle,
  showBack = false,
  onBack,
  actions = [],
  right,
  large = false,
  crumb: crumbProp,
  children,
}: HeaderProps) {
  const theme = useTheme();
  const t = useTranslate();
  const insets = useSafeAreaInsets();
  const contextCrumb = useHeaderCrumb();
  const crumb = crumbProp ?? contextCrumb;
  // Mit Marke steht der Bildschirm wie eine Vollansicht: Marke oben, Titel gross.
  const full = showBack || Boolean(crumb);

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/today');
    }
  }

  const buttons =
    right || actions.length > 0 ? (
      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        {right}
        {actions.map((action) => (
          <RoundButton
            key={action.label}
            icon={action.icon}
            label={action.label}
            active={action.active}
            onPress={action.onPress}
          />
        ))}
      </View>
    ) : null;

  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.edge,
        paddingTop: theme.spacing.lg + insets.top,
        paddingBottom: theme.spacing.md,
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.background,
      }}
    >
      {full ? (
        <View style={[styles.row, { gap: theme.spacing.md, minHeight: showBack ? 40 : 30 }]}>
          {showBack ? (
            <RoundButton icon="back" label={t('common.back')} onPress={handleBack} />
          ) : null}
          {crumb ? (
            <View style={[styles.row, styles.grow, { gap: theme.spacing.sm }]}>
              <View style={[styles.swatch, { backgroundColor: crumb.color }]} />
              <Text
                variant="overline"
                tone="faint"
                numberOfLines={1}
                style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
              >
                {crumb.label}
              </Text>
            </View>
          ) : (
            <View style={styles.grow} />
          )}
          {buttons}
        </View>
      ) : null}

      {overline || title || subtitle || (!full && buttons) ? (
        <View
          style={[
            styles.row,
            {
              gap: theme.spacing.sm,
              minHeight: 32,
              // Mit Rubrik darueber gehoert der Knopf rechts nach oben, auf die
              // Hoehe der Rubrik — nicht in die Mitte des ganzen Blocks.
              alignItems: overline ? 'flex-start' : 'center',
            },
          ]}
        >
          <View style={styles.titles}>
            {overline ? (
              <Text
                variant="overline"
                tone="faint"
                numberOfLines={1}
                style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
              >
                {overline}
              </Text>
            ) : null}
            {title ? (
              <Text
                variant={large || full ? 'display' : 'title'}
                numberOfLines={1}
                style={
                  full && !large
                    ? { fontSize: theme.fontSize.title, lineHeight: theme.lineHeight.title }
                    : undefined
                }
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text variant="label" tone="muted" numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {full ? null : buttons}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Runder Knopf auf Papier: Zurueck, Zahnrad, Stern. */
function RoundButton({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={theme.spacing.xs}
    >
      <Animated.View
        style={[
          styles.round,
          theme.elevation.card,
          {
            borderRadius: theme.radii.pill,
            backgroundColor: active ? theme.colors.accentSoft : theme.colors.surface,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <Icon
          name={icon}
          size={18}
          color={active ? theme.colors.accentStrong : theme.colors.text}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  titles: { flex: 1, gap: 3 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  round: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
