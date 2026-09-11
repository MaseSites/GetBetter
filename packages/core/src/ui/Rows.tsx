import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Checkbox } from './Checkbox';
import { Text } from './Text';

const TICK_HEIGHT = 46;
const LINE_HEIGHT = 50;
const TALL_HEIGHT = 56;

/**
 * Eine Liste als Karte wie im Entwurf: weiss, eine Linie zwischen den Zeilen,
 * kein Abstand dazwischen. (`Card` legt Luft zwischen seine Kinder.)
 */
export function ListCard({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={[
        theme.elevation.card,
        styles.card,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
      ]}
    >
      {children}
    </View>
  );
}

/** Eine Zeile zum Abhaken: eckiges Haekchen, Text, leise Angabe rechts. */
export function TickRow({
  label,
  checked,
  onToggle,
  meta,
  flush = false,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  meta?: string | null | undefined;
  /** Ohne eigenen Seitenrand — fuer Zeilen in einem Block, der schon einen hat. */
  flush?: boolean | undefined;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: TICK_HEIGHT,
          gap: theme.spacing.md,
          paddingHorizontal: flush ? 0 : theme.spacing.md,
          backgroundColor: pressed && !flush ? theme.colors.surfaceMuted : 'transparent',
          opacity: pressed && flush ? 0.6 : 1,
        },
      ]}
    >
      <Checkbox checked={checked} />
      <Text
        variant="body"
        tone={checked ? 'faint' : 'default'}
        numberOfLines={1}
        style={[
          styles.grow,
          { fontWeight: theme.fontWeight.medium },
          checked ? { textDecorationLine: 'line-through' } : null,
        ]}
      >
        {label}
      </Text>
      {meta ? (
        <Text
          variant="caption"
          tone="faint"
          numberOfLines={1}
          style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
        >
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Eine Zeile mit Titel, leiser Unterzeile und etwas rechts — Betrag, Faelligkeit. */
export function LineRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  tall = false,
}: {
  title: string;
  subtitle?: string | null | undefined;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: (() => void) | undefined;
  accessibilityLabel?: string | undefined;
  tall?: boolean | undefined;
}) {
  const theme = useTheme();

  const body = (
    <>
      {leading}
      <View style={styles.grow}>
        <Text variant="body" numberOfLines={1} style={{ fontWeight: theme.fontWeight.medium }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            tone="faint"
            numberOfLines={1}
            style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  const frame = {
    minHeight: tall ? TALL_HEIGHT : LINE_HEIGHT,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  };

  if (!onPress) {
    return <View style={[styles.row, frame]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        frame,
        { backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent' },
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
});
