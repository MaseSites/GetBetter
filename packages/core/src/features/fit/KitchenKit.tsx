import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { hueTint, useTheme } from '@/theme';
import { Icon, Text, usePressScale, type IconName } from '@/ui';

/**
 * Die kleinen Bausteine der Kueche und des Coaches, wie in der Vision: runde
 * Pillen statt eckiger Knoepfe, ein weisser Block ohne Marke, die Versal-Marke
 * ueber einem Abschnitt, die Pillen-Spur fuer die vier Reiter und der Kopf mit
 * dem roten Quadrat des Bereichs.
 */

const PILL_HEIGHT = { md: 44, sm: 36 } as const;
const TAB_HEIGHT = 36;
const TAB_PAD = 4;
const SQUARE = 8;
const SQUARE_RADIUS = 2;
const BACK = 40;
/** Versalien wie in der Vision: 0.09 em Sperrung. */
export const CAPS_EM = 0.09;
/** Abstand ueber einer Versal-Marke (Vision: margin 22 0 8). */
export const SEC_TOP = 22;
/** Zeilenhoehen der Vision („normal“ bei Instrument Sans). */
export const LINE = { xs: 14, caption: 15, sm: 16, lede: 18 } as const;
const CRUMB_GAP = 7;
const NAV_BOTTOM = 6;
const TITLE_TOP = 2;
const TITLE_EM = -0.022;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PillTone = 'ink' | 'soft' | 'white';

/** Eine runde Pille: Tinte fuer das Wichtigste, Senke fuer das Zweite, weiss auf Papier. */
export function Pill({
  label,
  onPress,
  tone = 'ink',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: PillTone;
  size?: 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const inactive = disabled || loading;
  const background = {
    ink: theme.colors.inverse,
    soft: theme.colors.surfaceMuted,
    white: theme.colors.surface,
  }[tone];
  const color = inactive
    ? theme.colors.disabledText
    : tone === 'ink'
      ? theme.colors.onInverse
      : theme.colors.text;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.pill,
        tone === 'white' && !inactive ? theme.elevation.card : null,
        {
          height: PILL_HEIGHT[size],
          gap: theme.spacing.sm,
          paddingHorizontal: size === 'md' ? theme.spacing.lg : theme.spacing.md,
          borderRadius: theme.radii.pill,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          backgroundColor: inactive ? theme.colors.disabledBackground : background,
          transform: [{ scale: inactive ? 1 : press.scale }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'md' ? 18 : 16} color={color} /> : null}
          <Text
            variant="label"
            numberOfLines={1}
            style={{
              color,
              fontSize: size === 'md' ? theme.fontSize.md : theme.fontSize.sm,
              fontWeight: theme.fontWeight.semibold,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

/** Ein runder Knopf nur mit Zeichen — Stern, Plus, Senden. */
export function RoundIcon({
  icon,
  label,
  onPress,
  tone = 'soft',
  active = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: PillTone;
  active?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const background = {
    ink: theme.colors.inverse,
    soft: theme.colors.surfaceMuted,
    white: theme.colors.surface,
  }[tone];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={theme.spacing.xs}
      style={[
        styles.round,
        tone === 'white' ? theme.elevation.card : null,
        {
          borderRadius: theme.radii.pill,
          backgroundColor: background,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: disabled ? 1 : press.scale }],
        },
      ]}
    >
      <Icon
        name={icon}
        size={18}
        color={tone === 'ink' ? theme.colors.onInverse : theme.colors.text}
      />
    </AnimatedPressable>
  );
}

/** Der weisse Block der Bereichsseiten, ohne Marke. `flush` fuer Listen mit Haarlinien. */
export function Block({
  children,
  flush = false,
  style,
}: {
  children: ReactNode;
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        theme.elevation.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.panel,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: flush ? theme.spacing.xs : theme.spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Die Versal-Marke ueber einem Abschnitt, rechts ein leiser Nebenwert oder Knopf. */
export function Sec({
  title,
  more,
  first = false,
}: {
  title: string;
  more?: ReactNode;
  first?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          gap: theme.spacing.sm,
          marginTop: first ? 0 : SEC_TOP,
          marginBottom: theme.spacing.sm,
        },
      ]}
    >
      <Text
        variant="overline"
        tone="faint"
        numberOfLines={1}
        style={[styles.grow, { letterSpacing: theme.fontSize.xs * CAPS_EM }]}
      >
        {title}
      </Text>
      {typeof more === 'string' ? (
        <Text
          variant="caption"
          tone="faint"
          style={{
            fontSize: theme.fontSize.caption,
            lineHeight: LINE.caption,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {more}
        </Text>
      ) : (
        more
      )}
    </View>
  );
}

/** Eine Haarlinie zwischen zwei Zeilen im selben Block. */
export function Hairline() {
  const theme = useTheme();
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />
  );
}

/** Die vier Reiter als Pillen-Spur: vertiefte Bahn, der aktive liegt weiss darauf. */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        {
          padding: TAB_PAD,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.surfaceMuted,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.tab,
              selected ? theme.elevation.card : null,
              {
                height: TAB_HEIGHT,
                borderRadius: theme.radii.pill,
                backgroundColor: selected ? theme.colors.surface : 'transparent',
                transform: [{ scale: pressed ? theme.motion.pressScale.button : 1 }],
              },
            ]}
          >
            <Text
              variant="label"
              numberOfLines={1}
              style={{
                fontSize: theme.fontSize.lede,
                lineHeight: LINE.lede,
                fontWeight: theme.fontWeight.semibold,
                color: selected ? theme.colors.text : theme.colors.textFaint,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Der Kopf einer Vollansicht wie in der Vision: runder Zurueck-Knopf, daneben
 * die Marke „Gesundheit · Kueche“ mit dem roten Quadrat, darunter der Titel.
 */
export function AreaHeader({
  crumb,
  title,
  subtitle,
  onBack,
  right,
  onSubtitlePress,
  subtitleHint,
}: {
  crumb: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ReactNode;
  /** Macht den Untertitel drueckbar (z.B. den Tag waehlen) — ohne sichtbaren Knopf. */
  onSubtitlePress?: () => void;
  /** Was ein Tipp auf den Untertitel tut, fuer die Bedienungshilfe. */
  subtitleHint?: string;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const press = usePressScale();
  const square = hueTint(theme, 'health').base;

  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.edge,
        paddingTop: theme.spacing.lg + insets.top,
        paddingBottom: theme.spacing.md,
        backgroundColor: theme.colors.background,
      }}
    >
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          hitSlop={theme.spacing.xs}
          style={[
            styles.back,
            theme.elevation.card,
            {
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surface,
              transform: [{ scale: press.scale }],
            },
          ]}
        >
          <Icon name="back" size={18} color={theme.colors.text} />
        </AnimatedPressable>
        <View style={[styles.row, styles.grow, { gap: CRUMB_GAP }]}>
          <View
            style={{
              width: SQUARE,
              height: SQUARE,
              borderRadius: SQUARE_RADIUS,
              backgroundColor: square,
            }}
          />
          <Text
            variant="overline"
            tone="faint"
            numberOfLines={1}
            style={{
              fontSize: theme.fontSize.caption,
              lineHeight: LINE.caption,
              letterSpacing: theme.fontSize.caption * CAPS_EM,
            }}
          >
            {crumb}
          </Text>
        </View>
        {right}
      </View>
      <View style={{ gap: TITLE_TOP, marginTop: NAV_BOTTOM + TITLE_TOP }}>
        <Text
          variant="display"
          numberOfLines={1}
          style={{
            fontSize: theme.fontSize.title,
            lineHeight: theme.lineHeight.title,
            letterSpacing: theme.fontSize.title * TITLE_EM,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Pressable
            disabled={!onSubtitlePress}
            accessibilityRole={onSubtitlePress ? 'button' : 'text'}
            accessibilityLabel={subtitleHint ? `${subtitle}. ${subtitleHint}` : subtitle}
            onPress={onSubtitlePress}
            hitSlop={theme.spacing.sm}
            style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
          >
            <Text
              variant="label"
              tone="faint"
              numberOfLines={2}
              style={{
                fontSize: theme.fontSize.lede,
                lineHeight: LINE.lede,
                fontWeight: theme.fontWeight.regular,
              }}
            >
              {subtitle}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { width: BACK, height: BACK, alignItems: 'center', justifyContent: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
