import type { ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, Text, type IconName } from '@/ui';

/** Die Zeile ganz oben: links Zurueck mit Wort („‹ Postfächer“), rechts, was der Bildschirm braucht. */
export function TopBar({
  backLabel,
  backAccessibilityLabel,
  onBack,
  left,
  right,
}: {
  backLabel?: string;
  backAccessibilityLabel: string;
  onBack?: () => void;
  /** Statt Zurueck, etwa beim Auswaehlen. */
  left?: ReactNode;
  right?: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.row,
        {
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      {left ?? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          onPress={onBack}
          style={({ pressed }) => [
            styles.row,
            styles.shrink,
            { minHeight: HIT_TARGET, paddingRight: theme.spacing.sm, opacity: pressed ? 0.5 : 1 },
          ]}
        >
          <Icon name="back" size={24} />
          {backLabel ? (
            <Text variant="body" numberOfLines={1} style={styles.shrink}>
              {backLabel}
            </Text>
          ) : null}
        </Pressable>
      )}
      <View style={styles.grow} />
      {right}
    </View>
  );
}

/** Ein Wort als Knopf in der Kopfzeile, etwa „Fertig“. */
export function TextButton({
  label,
  onPress,
  strong = false,
  disabled = false,
  ref,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
  disabled?: boolean;
  ref?: Ref<View>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.center,
        {
          minHeight: HIT_TARGET,
          paddingHorizontal: theme.spacing.sm,
          opacity: disabled ? 0.4 : pressed ? 0.5 : 1,
        },
      ]}
    >
      <Text
        variant="body"
        numberOfLines={1}
        style={strong ? { fontWeight: theme.fontWeight.semibold } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Ein runder Knopf mit Symbol, 44 gross — oder mit eigenem Inhalt wie den drei Punkten. */
export function RoundButton({
  label,
  icon,
  children,
  onPress,
  disabled = false,
  filled = false,
  flip = false,
  ref,
}: {
  label: string;
  icon?: IconName;
  children?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  /** Mit Karte darunter — fuer Knoepfe, die ueber der Liste schweben. */
  filled?: boolean;
  /** Das Symbol auf den Kopf gestellt: aus ˅ wird ˄. */
  flip?: boolean;
  ref?: Ref<View>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.center,
        filled ? theme.elevation.raised : null,
        {
          width: HIT_TARGET,
          height: HIT_TARGET,
          borderRadius: theme.radii.pill,
          backgroundColor: filled ? theme.colors.surface : undefined,
          opacity: disabled ? 0.35 : pressed ? 0.5 : 1,
        },
      ]}
    >
      {icon ? (
        <View style={flip ? styles.flip : undefined}>
          <Icon name={icon} size={22} />
        </View>
      ) : (
        children
      )}
    </Pressable>
  );
}

/** „…“ aus drei Punkten gezeichnet. */
export function Dots() {
  const theme = useTheme();
  const dot = {
    width: theme.spacing.xs,
    height: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.text,
  };
  return (
    <View style={[styles.row, { gap: theme.spacing.xs }]}>
      <View style={dot} />
      <View style={dot} />
      <View style={dot} />
    </View>
  );
}

/** Ein Knopf der Leiste unten: Symbol ueber einem kleinen Wort. */
export function BarButton({
  label,
  icon,
  onPress,
  onLongPress,
  danger = false,
  disabled = false,
  ref,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  onLongPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
  ref?: Ref<View>;
}) {
  const theme = useTheme();
  const color = disabled
    ? theme.colors.disabledText
    : danger
      ? theme.colors.danger
      : theme.colors.text;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.barButton,
        { minHeight: HIT_TARGET, gap: theme.spacing.xs, opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <Icon name={icon} size={22} color={color} />
      <Text variant="caption" numberOfLines={1} style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Eine Leiste am unteren Rand, ueber dem Sicherheitsabstand. */
export function BottomBar({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.row,
        {
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm + insets.bottom,
          paddingHorizontal: theme.spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  shrink: { flexShrink: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ rotate: '180deg' }] },
  barButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
