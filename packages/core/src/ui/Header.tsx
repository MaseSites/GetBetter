import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';

import { useHeaderCrumb } from './HeaderCrumb';
import { Icon, type IconName } from './Icon';
import { Menu, measureAnchor, type MenuAnchor, type MenuEntry } from './Menu';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

export type HeaderAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Hebt den Knopf hervor, z.B. ein gesetzter Favoritenstern. */
  active?: boolean;
  /** Ein roter Punkt am Knopf: dahinter wartet etwas auf eine Antwort. */
  badge?: boolean;
};

export type HeaderProps = {
  /**
   * Kleine Marke ueber dem Titel: Datum, Bereich, Rubrik. Sie ordnet den
   * Bildschirm ein, ohne dem Titel Gewicht wegzunehmen.
   */
  overline?: string;
  /**
   * Haengt sich an die Marke und macht die ganze Zeile drueckbar — auf der
   * Startseite steht so das Wetter neben dem Datum und fuehrt ins Modul.
   */
  overlineAction?: { icon?: IconName; text: string; label: string; onPress: () => void };
  title?: string;
  /**
   * Macht den Titel zum Umschalter: daneben steht ein Pfeil, ein Tipp oeffnet
   * dieses Menue — fuer Listen, Ordner, Postfaecher. Oben links bleibt Zurueck.
   */
  titleMenu?: readonly MenuEntry[];
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: readonly HeaderAction[];
  /** Beliebiger Inhalt rechts, z.B. ein Umschalter. */
  right?: ReactNode;
  large?: boolean;
  /**
   * Bereichsmarke ohne Zurueck-Knopf — fuer die Startseiten von BetterGym,
   * BetterFamily und BetterMoney. Vollansichten einer Funktion zeigen keine
   * Marke mehr: der Titel reicht.
   */
  crumb?: { label: string } | null | undefined;
  children?: ReactNode;
};

/**
 * Zwei Formen:
 *
 * - **Uebersicht** (Heute, Bereiche, Profil) — Titel links, Knoepfe rechts.
 * - **Vollansicht** (mit Zurueck) — oben eine Zeile mit rundem Zurueck-Knopf,
 *   darunter gross der Titel.
 */
export function Header({
  overline,
  overlineAction,
  title,
  titleMenu,
  subtitle,
  showBack = false,
  onBack,
  actions = [],
  right,
  large = false,
  crumb,
  children,
}: HeaderProps) {
  const theme = useTheme();
  const t = useTranslate();
  const insets = useSafeAreaInsets();
  // Die Funktion setzt ihre Bereichsmarke noch; sie macht daraus eine
  // Vollansicht, gezeigt wird die Marke aber nicht mehr.
  const insideModule = Boolean(useHeaderCrumb());
  const full = showBack || Boolean(crumb) || insideModule;

  const titleNode = useRef<View>(null);
  const [titleMenuState, setTitleMenuState] = useState<{
    anchor: MenuAnchor;
    open: boolean;
  } | null>(null);

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

  async function openTitleMenu() {
    const anchor = await measureAnchor(titleNode.current);
    if (anchor) setTitleMenuState({ anchor, open: true });
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
            badge={action.badge}
            onPress={action.onPress}
          />
        ))}
      </View>
    ) : null;

  const titleText = title ? (
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
            {overline && overlineAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={overlineAction.label}
                onPress={overlineAction.onPress}
                style={({ pressed }) => [
                  styles.row,
                  styles.overlineRow,
                  { gap: theme.spacing.xs, opacity: pressed ? 0.5 : 1 },
                ]}
              >
                <Text
                  variant="overline"
                  tone="faint"
                  numberOfLines={1}
                  style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
                >
                  {overline} ·
                </Text>
                {overlineAction.icon ? (
                  <Icon name={overlineAction.icon} size={14} color={theme.colors.textMuted} />
                ) : null}
                <Text
                  variant="overline"
                  tone="muted"
                  numberOfLines={1}
                  style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
                >
                  {overlineAction.text}
                </Text>
              </Pressable>
            ) : overline ? (
              <Text
                variant="overline"
                tone="faint"
                numberOfLines={1}
                style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
              >
                {overline}
              </Text>
            ) : null}
            {title && titleMenu && titleMenu.length > 0 ? (
              <Pressable
                ref={titleNode}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityHint={t('ui.menu.open')}
                accessibilityState={{ expanded: titleMenuState?.open ?? false }}
                onPress={() => void openTitleMenu()}
                style={({ pressed }) => [
                  styles.row,
                  styles.titleButton,
                  { gap: theme.spacing.xs, opacity: pressed ? 0.5 : 1 },
                ]}
              >
                <View style={styles.shrink}>{titleText}</View>
                <Icon name="down" size={20} color={theme.colors.textMuted} />
              </Pressable>
            ) : (
              titleText
            )}
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

      {titleMenu && titleMenu.length > 0 ? (
        <Menu
          visible={titleMenuState?.open ?? false}
          anchor={titleMenuState?.anchor ?? null}
          items={titleMenu}
          accessibilityLabel={title}
          onClose={() =>
            setTitleMenuState((current) => (current ? { ...current, open: false } : null))
          }
        />
      ) : null}
    </View>
  );
}

/** Runder Knopf auf Papier: Zurueck, Zahnrad, Stern. */
function RoundButton({
  icon,
  label,
  active = false,
  badge = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  badge?: boolean | undefined;
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
        {badge ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.danger, borderColor: theme.colors.surface },
            ]}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  titles: { flex: 1, gap: 3 },
  overlineRow: { alignSelf: 'flex-start' },
  titleButton: { alignSelf: 'flex-start', maxWidth: '100%' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  round: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
