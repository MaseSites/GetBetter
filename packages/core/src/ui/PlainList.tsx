import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { LONG_PRESS_MS, ROW_LEADING_WIDTH, ROW_MIN_HEIGHT } from './layout';
import { Text, type TextTone } from './Text';

/**
 * Eine durchgehende Liste mit Abschnittstiteln statt einer Karte je Abschnitt,
 * wie in Erinnerungen und Mail: Titel, Zeilen, feine Linien ab der Textspalte.
 *
 * ```tsx
 * <SectionHeader label="Heute" first />
 * <PlainList>
 *   <PlainRow leading={<Circle />} title="Offerte prüfen" subtitle="14:30" onPress={open} />
 *   <PlainRow leading={<Circle />} title="Physio anrufen" />
 * </PlainList>
 * ```
 */

export type SectionHeaderProps = {
  label: string;
  /** Text rechts, etwa „Alle 12“. Nur zusammen mit `onAction`. */
  actionLabel?: string;
  onAction?: () => void;
  /** Der erste Abschnitt braucht keinen Abstand nach oben. */
  first?: boolean;
  /** `danger` nur für einen Zustand, der Aufmerksamkeit braucht, etwa „Überfällig“. */
  tone?: Extract<TextTone, 'muted' | 'danger'>;
};

export function SectionHeader({
  label,
  actionLabel,
  onAction,
  first = false,
  tone = 'muted',
}: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="header"
      style={[
        styles.header,
        {
          paddingTop: first ? 0 : theme.spacing.xl,
          paddingBottom: theme.spacing.sm,
          gap: theme.spacing.md,
        },
      ]}
    >
      <Text variant="overline" tone={tone} numberOfLines={1} style={styles.grow}>
        {label}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={theme.spacing.md}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text variant="label" tone="accent">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type ListSeparatorProps = {
  /** Abstand von links; so beginnt die Linie unter dem Text statt unter dem Kreis. */
  inset?: number;
};

export function ListSeparator({ inset = 0 }: ListSeparatorProps) {
  const theme = useTheme();
  return (
    <View style={[styles.separator, { marginLeft: inset, backgroundColor: theme.colors.border }]} />
  );
}

export type PlainListProps = {
  children: ReactNode;
  /**
   * Wo die Linien beginnen: `text` nach der Spalte links einer `PlainRow`
   * (Standard), `none` ueber die ganze Breite, oder ein eigener Abstand.
   */
  separatorInset?: 'text' | 'none' | number;
  style?: StyleProp<ViewStyle>;
};

/** Die Zeilen ohne Kartenrahmen, mit einer Linie zwischen je zwei. */
export function PlainList({ children, separatorInset = 'text', style }: PlainListProps) {
  const theme = useTheme();
  const inset =
    separatorInset === 'none'
      ? 0
      : separatorInset === 'text'
        ? ROW_LEADING_WIDTH + theme.spacing.md
        : separatorInset;

  // `toArray` laesst `null` und `false` weg — so gibt es keine Linie ohne Zeile.
  const rows = Children.toArray(children);

  return (
    <View style={style}>
      {rows.map((row, index) => (
        <Fragment key={isValidElement(row) && row.key !== null ? row.key : String(index)}>
          {index > 0 ? <ListSeparator inset={inset} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

export type PlainRowProps = {
  title: string;
  subtitle?: string;
  /** Eine dritte, blasse Zeile. */
  meta?: string;
  /** Die Spalte links (Kreis, Bild, Symbol) — immer gleich breit, damit die Linien stimmen. */
  leading?: ReactNode;
  /** Rechts: Datum, Zahl, Stern. */
  trailing?: ReactNode;
  titleTone?: TextTone;
  /** Der Tipp auf den Text. Die Spalten links und rechts duerfen eigene Knoepfe haben. */
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Eine Zeile: 44, 60 oder 76 hoch, je nach Anzahl Textzeilen. Nur der Text ist
 * drueckbar — so bleibt der Kreis links ein eigener Knopf, ohne Knopf im Knopf.
 */
export function PlainRow({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  titleTone = 'default',
  onPress,
  onLongPress,
  accessibilityLabel,
}: PlainRowProps) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);

  const lines = 1 + (subtitle ? 1 : 0) + (meta ? 1 : 0);
  const minHeight =
    lines === 3 ? ROW_MIN_HEIGHT.three : lines === 2 ? ROW_MIN_HEIGHT.two : ROW_MIN_HEIGHT.one;
  const interactive = Boolean(onPress || onLongPress);

  const text = (
    <>
      <Text variant="body" tone={titleTone} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="label" tone="muted" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {meta ? (
        <Text variant="caption" tone="faint" numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </>
  );

  return (
    <View
      style={[
        styles.row,
        {
          minHeight,
          gap: theme.spacing.md,
          backgroundColor: pressed ? theme.colors.surfaceMuted : undefined,
        },
      ]}
    >
      {leading !== undefined ? <View style={styles.leading}>{leading}</View> : null}
      {interactive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={LONG_PRESS_MS}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={[styles.text, { paddingVertical: theme.spacing.sm }]}
        >
          {text}
        </Pressable>
      ) : (
        <View
          accessibilityLabel={accessibilityLabel}
          style={[styles.text, { paddingVertical: theme.spacing.sm }]}
        >
          {text}
        </View>
      )}
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end' },
  grow: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  leading: { width: ROW_LEADING_WIDTH, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2, justifyContent: 'center', alignSelf: 'stretch' },
});
