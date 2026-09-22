import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useI18n } from '@/i18n';
import { hueTint, useTheme } from '@/theme';
import { Icon, Text, useReducedMotion, usePressScale, type IconName } from '@/ui';

import { TRAINING } from './trainingType';

/**
 * Kleine Bausteine des Trainingshefts: die runde Pille, der Balken, der beim
 * Laden einmal waechst, das Haekchen-Kaestchen einer Heftzeile und die leise
 * Karte fuer eine neue Bestleistung.
 */

const useNativeDriver = Platform.OS !== 'web';
/** Wie weit ein Balken hinter dem vorigen anfaengt. */
const STAGGER_MS = 40;
const PILL_HEIGHT = 44;
const PILL_TALL = 50;
const PILL_SMALL = 36;
/** Heftzeilen und ihr Kaestchen: 10 px, kleiner als ein Block. */
export const ROW_RADIUS = 10;
export const CHECK_SIZE = 34;
const CHECK_BORDER = 1.5;
const MARK_WIDTH = 4;
const RECORD_DETAIL_GAP = 2;

/** Schwarze Pille fuer das Wichtigste, weiche Senke fuer das Zweite. */
export function InkPill({
  label,
  icon,
  onPress,
  soft = false,
  tall = false,
  small = false,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  icon?: IconName | undefined;
  onPress: () => void;
  soft?: boolean | undefined;
  tall?: boolean | undefined;
  small?: boolean | undefined;
  disabled?: boolean | undefined;
  accessibilityLabel?: string | undefined;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const color = soft ? theme.colors.text : theme.colors.onInverse;
  const height = tall ? PILL_TALL : small ? PILL_SMALL : PILL_HEIGHT;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={small ? undefined : styles.grow}
    >
      <Animated.View
        style={[
          styles.center,
          {
            height,
            gap: theme.spacing.sm,
            paddingHorizontal: small ? theme.spacing.md : theme.spacing.lg,
            borderRadius: theme.radii.pill,
            backgroundColor: soft ? theme.colors.surfaceMuted : theme.colors.inverse,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        {icon ? <Icon name={icon} size={theme.fontSize.md} color={color} /> : null}
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            color,
            fontSize: tall ? theme.fontSize.md : theme.fontSize.lede,
            lineHeight: theme.lineHeight.lede,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Ein Wert von 0 bis 1, der beim ersten Zeichnen einmal hochlaeuft — 240 ms,
 * je Reihe 40 ms spaeter. Bei reduzierter Bewegung steht er gleich da.
 */
export function useGrow(index = 0) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [grow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      grow.setValue(1);
      return;
    }
    Animated.timing(grow, {
      toValue: 1,
      duration: theme.motion.duration.sheet,
      delay: index * STAGGER_MS,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }, [grow, index, reduced, theme.motion.duration.sheet, theme.motion.easing.out]);

  return grow;
}

/** Ein Balken, der von links waechst. `share` ist die Breite von 0 bis 1. */
export function GrowBar({
  share,
  height,
  color,
  index = 0,
}: {
  share: number;
  height: number;
  color: string;
  index?: number;
}) {
  const theme = useTheme();
  const grow = useGrow(index);
  const width = `${Math.max(0, Math.min(1, share)) * 100}%` as const;

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: theme.radii.pill,
        backgroundColor: color,
        transformOrigin: 'left',
        transform: [{ scaleX: grow }],
      }}
    />
  );
}

/**
 * Das Kaestchen am Ende einer Heftzeile. Abgehakt fuellt es sich in 160 ms mit
 * Signal; die jetzige Zeile hat einen Rand in Tinte, offene einen zarten.
 */
export function CheckSquare({
  state,
  muted = false,
}: {
  state: 'done' | 'now' | 'open';
  muted?: boolean | undefined;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const done = state === 'done';
  const [fill] = useState(() => new Animated.Value(done ? 1 : 0));

  useEffect(() => {
    const to = done ? 1 : 0;
    if (reduced !== false) {
      fill.setValue(to);
      return;
    }
    Animated.timing(fill, {
      toValue: to,
      duration: theme.motion.duration.press,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }, [done, fill, reduced, theme.motion.duration.press, theme.motion.easing.out]);

  // Aufwaermen zaehlt nicht: sein Haken ist grau, nicht Signal.
  const doneFill = muted ? theme.colors.surface : theme.colors.accent;
  const doneEdge = muted ? theme.colors.textFaint : theme.colors.accentMark;
  const edge = done ? doneEdge : state === 'now' ? theme.colors.text : theme.colors.textFaint;

  return (
    <View
      style={{
        width: CHECK_SIZE,
        height: CHECK_SIZE,
        borderRadius: ROW_RADIUS,
        borderWidth: CHECK_BORDER,
        borderColor: edge,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: doneFill, opacity: fill }]}
      />
      {done ? (
        <BoldCheck color={muted ? theme.colors.textMuted : theme.colors.textOnAccent} />
      ) : null}
    </View>
  );
}

/**
 * Ein Block des Trainingshefts: weiss, 18 rund, innen 13 · 16 · 14 wie im
 * Entwurf. Mit `label` steht oben die kleine Marke, rechts der Nebenwert.
 */
export function TrainingBlock({
  label,
  more,
  children,
  style,
}: {
  label?: string | undefined;
  more?: string | undefined;
  children?: ReactNode;
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
          paddingTop: TRAINING.blockTop,
          paddingBottom: TRAINING.blockBottom,
        },
        style,
      ]}
    >
      {label ? <BlockHead label={label} more={more} /> : null}
      {children}
    </View>
  );
}

/** Kleine Versalien, 11 px — Marke eines Blocks oder Abschnitts. */
export function Caps({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text
        variant="overline"
        tone="faint"
        numberOfLines={1}
        style={{ lineHeight: TRAINING.line11, letterSpacing: TRAINING.capsTracking }}
      >
        {text}
      </Text>
    </View>
  );
}

/** Kopf eines Blocks: Marke links, Nebenwert rechts auf derselben Grundlinie. */
export function BlockHead({ label, more }: { label: string; more?: string | undefined }) {
  const theme = useTheme();
  return (
    <View style={[styles.baseline, { gap: theme.spacing.sm }]}>
      <View style={styles.grow}>
        <Text
          variant="overline"
          tone="faint"
          numberOfLines={1}
          style={{ lineHeight: TRAINING.line11, letterSpacing: TRAINING.capsTracking }}
        >
          {label}
        </Text>
      </View>
      {more ? (
        <Text
          variant="caption"
          tone="faint"
          numberOfLines={1}
          style={[
            {
              fontSize: theme.fontSize.caption,
              lineHeight: TRAINING.line12,
              fontWeight: theme.fontWeight.semibold,
            },
          ]}
        >
          {more}
        </Text>
      ) : null}
    </View>
  );
}

/** Die grosse schwarze Pille „Training starten“: 50 hoch, 16 px, gefuelltes Dreieck. */
export function StartPill({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const press = usePressScale();
  const color = theme.colors.onInverse;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.center,
          {
            height: PILL_TALL,
            gap: theme.spacing.sm,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.inverse,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <Ionicons name="play" size={TRAINING.rowSize} color={color} />
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            color,
            fontSize: TRAINING.rowSize,
            lineHeight: TRAINING.rowLine,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Der Haken wie im Entwurf: 16 px, Strich 2.6, runde Enden — aus zwei
 * gedrehten Strichen, denn das Zeichen der Symbolschrift ist zu duenn.
 * Punkte im 24er-Raster: (5, 12.5) → (9.5, 17) → (19, 7.5).
 */
const CHECK_BOX = 16;
const CHECK_STROKE = 2.6;
const CHECK_GRID = 24;
const CHECK_POINTS = [
  [5, 12.5],
  [9.5, 17],
  [19, 7.5],
] as const;

function BoldCheck({ color }: { color: string }) {
  const scale = CHECK_BOX / CHECK_GRID;
  const legs = [
    [CHECK_POINTS[0], CHECK_POINTS[1]],
    [CHECK_POINTS[1], CHECK_POINTS[2]],
  ] as const;
  return (
    <View style={{ width: CHECK_BOX, height: CHECK_BOX }}>
      {legs.map(([from, to]) => {
        const dx = (to[0] - from[0]) * scale;
        const dy = (to[1] - from[1]) * scale;
        // Die Striche reichen um den halben Strich ueber die Punkte hinaus: runde Enden.
        const length = Math.hypot(dx, dy) + CHECK_STROKE;
        const cx = ((from[0] + to[0]) / 2) * scale;
        const cy = ((from[1] + to[1]) / 2) * scale;
        return (
          <View
            key={`${from[0]}-${to[0]}`}
            style={{
              position: 'absolute',
              left: cx - length / 2,
              top: cy - CHECK_STROKE / 2,
              width: length,
              height: CHECK_STROKE,
              borderRadius: CHECK_STROKE,
              backgroundColor: color,
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          />
        );
      })}
    </View>
  );
}

/** Eine neue Bestleistung: leise, mit einem roten Strich statt Pokal. */
export function RecordNote({ line, detail }: { line: string; detail?: string | null }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <View accessibilityLiveRegion="polite">
      <TrainingBlock style={[styles.row, { gap: theme.spacing.md }]}>
        <View style={styles.grow}>
          <Text
            variant="overline"
            tone="faint"
            numberOfLines={1}
            style={{ lineHeight: TRAINING.line11, letterSpacing: TRAINING.capsTracking }}
          >
            {t('fit6.v.record.label')}
          </Text>
          <Text
            variant="title"
            style={{
              marginTop: theme.spacing.xs,
              fontSize: theme.fontSize.stat,
              lineHeight: TRAINING.line22,
              letterSpacing: TRAINING.statTracking,
            }}
          >
            {line}
          </Text>
          {detail ? (
            <Text
              variant="label"
              tone="faint"
              style={{
                marginTop: RECORD_DETAIL_GAP,
                lineHeight: TRAINING.line13,
                fontWeight: theme.fontWeight.regular,
              }}
            >
              {detail}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            width: MARK_WIDTH,
            alignSelf: 'stretch',
            borderRadius: theme.radii.pill,
            backgroundColor: hueTint(theme, 'health').base,
          }}
        />
      </TrainingBlock>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  baseline: { flexDirection: 'row', alignItems: 'baseline' },
  center: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
