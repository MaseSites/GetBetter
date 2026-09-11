import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useTheme } from '@/theme';

import { Text, type TextTone } from './Text';

/**
 * Die Bausteine der Bereichsseiten — Gesundheit, Haushalt, Geld — so, wie sie
 * im Entwurf stehen: ein Block mit kleiner Marke und Nebenwert, die eine grosse
 * Zahl, ein geteilter Balken mit Legende, der Abschnittskopf ueber einer Liste.
 */

const BAR_HEIGHT = 9;
const BAR_GAP = 3;
const SWATCH = 7;
const TREND_HEIGHT = 36;
const TREND_LINE = 2;
const TREND_DOT = 8;
const ROW_HEIGHT = 50;
const PILL_Y = 3;
const SWATCH_RADIUS = 2;
const TRACK_HEIGHT = 8;

type Theme = ReturnType<typeof useTheme>;

export type PanelProps = {
  label: string;
  /** Nebenwert rechts in der Kopfzeile, z.B. "1.2 von 2.0 l". */
  more?: string | undefined;
  /** Mit Handler fuehrt der Nebenwert in die volle Ansicht. */
  onMore?: (() => void) | undefined;
  children?: ReactNode;
};

export function Panel({ label, more, onMore, children }: PanelProps) {
  const theme = useTheme();

  const moreText = more ? (
    <Text
      variant="caption"
      tone="faint"
      numberOfLines={1}
      style={{
        fontSize: theme.fontSize.caption,
        lineHeight: theme.lineHeight.caption,
        fontWeight: theme.fontWeight.semibold,
      }}
    >
      {more}
    </Text>
  ) : null;

  return (
    <View
      style={[
        theme.elevation.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.panel,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.lg,
        },
      ]}
    >
      <View style={[styles.head, { gap: theme.spacing.sm }]}>
        <Text variant="overline" tone="faint" numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.grow} />
        {more && onMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${more}`}
            onPress={onMore}
            hitSlop={theme.spacing.sm}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            {moreText}
          </Pressable>
        ) : (
          moreText
        )}
      </View>
      {children}
    </View>
  );
}

/** Die eine grosse Zahl eines Blocks, mit leiser Einheit dahinter. */
export function BigFigure({
  value,
  unit,
  tone = 'default',
}: {
  value: string;
  unit?: string | undefined;
  tone?: TextTone | undefined;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.figure, { gap: theme.spacing.sm, marginTop: theme.spacing.sm }]}>
      <Text variant="hero" tone={tone}>
        {value}
      </Text>
      {unit ? (
        <Text
          variant="label"
          tone="faint"
          style={{
            fontSize: theme.fontSize.lede,
            lineHeight: theme.lineHeight.lede,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

/** Tinte fuer Verbrauchtes, Signal fuer Freies, Linie fuer das, was noch offen ist. */
export type SegmentKind = 'ink' | 'signal' | 'rest';
export type Segment = { key: string; value: number; kind: SegmentKind };
export type LegendItem = { key: string; label: string; kind: SegmentKind };

function kindColor(theme: Theme, kind: SegmentKind, legend: boolean): string {
  if (kind === 'ink') return theme.colors.text;
  if (kind === 'signal') return theme.colors.accent;
  return legend ? theme.colors.borderStrong : theme.colors.border;
}

export function SegmentBar({ segments }: { segments: readonly Segment[] }) {
  const theme = useTheme();
  const visible = segments.filter((segment) => segment.value > 0);

  return (
    <View style={[styles.bar, { marginTop: theme.spacing.md }]}>
      {visible.length === 0 ? (
        <View
          style={[
            styles.segment,
            { flex: 1, borderRadius: theme.radii.pill, backgroundColor: theme.colors.border },
          ]}
        />
      ) : (
        visible.map((segment) => (
          <View
            key={segment.key}
            style={[
              styles.segment,
              {
                flex: segment.value,
                borderRadius: theme.radii.pill,
                backgroundColor: kindColor(theme, segment.kind, false),
              },
            ]}
          />
        ))
      )}
    </View>
  );
}

export function Legend({ items }: { items: readonly LegendItem[] }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.legend,
        { columnGap: theme.spacing.md, rowGap: theme.spacing.xs, marginTop: theme.spacing.md },
      ]}
    >
      {items.map((item) => (
        <View key={item.key} style={[styles.head, { gap: theme.spacing.xs }]}>
          <View
            style={[
              styles.swatch,
              { borderRadius: SWATCH_RADIUS, backgroundColor: kindColor(theme, item.kind, true) },
            ]}
          />
          <Text
            variant="caption"
            tone="muted"
            style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Der Kopf ueber einer Liste: Name in Grossbuchstaben, Zahl rechts. */
export function SectionHead({
  title,
  count,
  onPress,
}: {
  title: string;
  count?: string | undefined;
  onPress?: (() => void) | undefined;
}) {
  const theme = useTheme();

  const content = (
    <>
      <Text variant="section" numberOfLines={1} style={{ letterSpacing: theme.tracking.label }}>
        {title}
      </Text>
      <View style={styles.grow} />
      {count ? (
        <Text
          variant="caption"
          tone="faint"
          numberOfLines={1}
          style={{
            fontSize: theme.fontSize.caption,
            lineHeight: theme.lineHeight.caption,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {count}
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.head, { gap: theme.spacing.sm }]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${title}, ${count}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.head, { gap: theme.spacing.sm, opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

/** Faelligkeit rechts in einer Zeile. Was heute dran ist, steht im Signal. */
export function DueTag({
  text,
  now = false,
  late = false,
}: {
  text: string;
  now?: boolean | undefined;
  late?: boolean | undefined;
}) {
  const theme = useTheme();
  const caps = {
    fontSize: theme.fontSize.xs,
    lineHeight: theme.lineHeight.xs,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: theme.tracking.tag,
    textTransform: 'uppercase' as const,
  };

  if (now) {
    return (
      <View
        style={{
          alignSelf: 'flex-end',
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: PILL_Y,
          backgroundColor: theme.colors.accent,
        }}
      >
        <Text style={[caps, { color: theme.colors.textOnAccent }]}>{text}</Text>
      </View>
    );
  }

  return (
    <Text tone={late ? 'danger' : 'faint'} numberOfLines={1} style={caps}>
      {text}
    </Text>
  );
}

/** Eine stille Zeile in einer Liste, wenn dort (noch) nichts steht. */
export function EmptyRow({ text, onPress }: { text: string; onPress?: (() => void) | undefined }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.head,
        {
          minHeight: ROW_HEIGHT,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
        },
      ]}
    >
      <Text variant="label" tone="faint">
        {text}
      </Text>
    </Pressable>
  );
}

/** Ein schlichter Balken in Tinte auf Papier — Sparziel, Schlaf gegen acht Stunden. */
export function Track({ share }: { share: number }) {
  const theme = useTheme();
  const width = Math.max(0, Math.min(1, share)) * 100;

  return (
    <View
      style={{
        height: TRACK_HEIGHT,
        overflow: 'hidden',
        marginTop: theme.spacing.md,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <View
        style={{
          width: `${width}%`,
          height: '100%',
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.text,
        }}
      />
    </View>
  );
}

/**
 * Ein Verlauf als Linie mit einem Punkt fuers Heute. Ohne Grafikbibliothek:
 * jedes Stueck ist ein gedrehter Strich zwischen zwei Messpunkten.
 */
export function Trend({ values }: { values: readonly number[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const inset = TREND_DOT / 2;

  const points = values.map((value, index) => ({
    x:
      values.length === 1
        ? width - inset
        : inset + (index / (values.length - 1)) * (width - TREND_DOT),
    y: inset + (1 - (value - min) / span) * (TREND_HEIGHT - TREND_DOT),
  }));
  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout} style={{ height: TREND_HEIGHT, marginTop: theme.spacing.md }}>
      {width > 0
        ? points.slice(1).map((point, index) => {
            const from = points[index];
            if (!from) return null;
            const dx = point.x - from.x;
            const dy = point.y - from.y;
            const length = Math.hypot(dx, dy);
            return (
              <View
                key={`line-${index}`}
                style={{
                  position: 'absolute',
                  left: (from.x + point.x) / 2 - length / 2,
                  top: (from.y + point.y) / 2 - TREND_LINE / 2,
                  width: length,
                  height: TREND_LINE,
                  borderRadius: TREND_LINE,
                  backgroundColor: theme.colors.text,
                  transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                }}
              />
            );
          })
        : null}
      {width > 0 && last ? (
        <View
          style={{
            position: 'absolute',
            left: last.x - inset,
            top: last.y - inset,
            width: TREND_DOT,
            height: TREND_DOT,
            borderRadius: TREND_DOT / 2,
            borderWidth: TREND_LINE,
            borderColor: theme.colors.text,
            backgroundColor: theme.colors.accent,
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  figure: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  bar: { flexDirection: 'row', height: BAR_HEIGHT, gap: BAR_GAP },
  segment: { height: '100%' },
  legend: { flexDirection: 'row', flexWrap: 'wrap' },
  swatch: { width: SWATCH, height: SWATCH },
});
