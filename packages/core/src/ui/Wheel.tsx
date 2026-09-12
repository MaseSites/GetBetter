import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

/** Das Rad: so hoch ist eine Zeile, so viele sieht man auf einmal. */
const ITEM_HEIGHT = 34;
const VISIBLE_ROWS = 7;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const WHEEL_PADDING = (ITEM_HEIGHT * (VISIBLE_ROWS - 1)) / 2;
/** So lange nach dem letzten Ruck wartet das Rad, bevor es einrastet. */
const SETTLE_MS = 90;
/** So viele Zeilen hat ein Rad ohne Ende mindestens — genug, dass kein Wurf an ein Ende kommt. */
const MIN_LOOP_ROWS = 240;
/** Das Verblassen: halbe Zeilen, von der Mitte nach aussen immer deckender. */
const FADE_STRIP = ITEM_HEIGHT / 2;
const FADE = [0.12, 0.28, 0.44, 0.6, 0.74, 0.88] as const;
const DEFAULT_WIDTH = 96;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Der Rahmen fuer ein oder mehrere Raeder nebeneinander: das Band hinter der
 * gewaehlten Zeile und das Verblassen nach oben und unten. Die Streifen haben
 * die Farbe des Blatts, damit beim Drehen nichts neu gezeichnet werden muss.
 */
export function WheelFrame({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.frame, { height: WHEEL_HEIGHT }]}>
      <View
        style={[
          styles.band,
          {
            top: WHEEL_PADDING,
            height: ITEM_HEIGHT,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surfaceMuted,
          },
        ]}
      />
      {children}
      {FADE.map((opacity, step) => (
        <View
          key={`top-${step}`}
          style={[
            styles.fade,
            {
              top: WHEEL_PADDING - (step + 1) * FADE_STRIP,
              height: FADE_STRIP,
              backgroundColor: theme.colors.background,
              opacity,
            },
          ]}
        />
      ))}
      {FADE.map((opacity, step) => (
        <View
          key={`bottom-${step}`}
          style={[
            styles.fade,
            {
              top: WHEEL_PADDING + ITEM_HEIGHT + step * FADE_STRIP,
              height: FADE_STRIP,
              backgroundColor: theme.colors.background,
              opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

export type WheelProps = {
  values: readonly number[];
  value: number;
  onChange: (value: number) => void;
  /** Fuer die Bedienungshilfe: „Stunden“, „Monat“ … */
  label: string;
  /** Wie eine Zahl dasteht; ohne Angabe zweistellig. */
  format?: (value: number) => string;
  /** Ohne Ende: nach der letzten Zahl kommt wieder die erste. */
  loop?: boolean;
  width?: number;
};

/**
 * Ein Rad wie am iPhone. Ziehen, werfen oder auf eine Zahl tippen; es rastet
 * ein und meldet den Wert. Mit `loop` hat es kein Ende: die Zahlen stehen
 * mehrmals hintereinander, und in Ruhe springt das Rad unsichtbar in die
 * mittlere Runde zurueck — dort stehen dieselben Zahlen.
 */
export function Wheel({
  values,
  value,
  onChange,
  label,
  format = pad,
  loop = false,
  width = DEFAULT_WIDTH,
}: WheelProps) {
  const theme = useTheme();
  const ref = useRef<ScrollView>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastY = useRef(0);
  // Was das Rad zuletzt selbst gemeldet hat. Kommt von aussen ein anderer
  // Wert (etwa der 31. im Februar), dreht es sich dorthin.
  const reported = useRef(value);

  const length = values.length;
  // Eine ungerade Zahl an Runden, damit es eine Mitte gibt.
  const rounds = loop ? Math.max(3, Math.ceil(MIN_LOOP_ROWS / Math.max(1, length))) | 1 : 1;
  const middle = Math.floor(rounds / 2);
  const rows = useMemo(
    () => Array.from({ length: length * rounds }, (_, index) => values[index % length] ?? 0),
    [values, length, rounds],
  );
  const slotOf = (index: number) =>
    loop ? ((index % length) + length) % length : Math.max(0, Math.min(length - 1, index));
  const [home] = useState(
    () => (middle * length + Math.max(0, values.indexOf(value))) * ITEM_HEIGHT,
  );
  const target = (middle * length + Math.max(0, values.indexOf(value))) * ITEM_HEIGHT;

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  // Aendert sich die Zahl der Zeilen (Februar statt Maerz), steht das Rad neu.
  const placedLength = useRef(length);
  useEffect(() => {
    if (placedLength.current === length) return;
    placedLength.current = length;
    ref.current?.scrollTo({ y: target, animated: false });
  }, [length, target]);

  useEffect(() => {
    if (value === reported.current) return;
    reported.current = value;
    ref.current?.scrollTo({ y: target, animated: true });
  }, [value, target]);

  function report(next: number) {
    reported.current = next;
    onChange(next);
  }

  function settleAt(y: number) {
    const index = Math.round(y / ITEM_HEIGHT);
    const slot = slotOf(index);
    report(values[slot] ?? 0);
    // Noch zwischen zwei Zeilen (oder hinter dem Ende): erst einrasten. Danach
    // kommt dieser Aufruf wieder.
    const snapped = (loop ? index : slot) * ITEM_HEIGHT;
    if (Math.abs(y - snapped) > 0.5) {
      ref.current?.scrollTo({ y: snapped, animated: true });
      return;
    }
    const centered = middle * length + slot;
    if (loop && index !== centered) {
      ref.current?.scrollTo({ y: centered * ITEM_HEIGHT, animated: false });
    }
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    lastY.current = event.nativeEvent.contentOffset.y;
    if (settle.current) clearTimeout(settle.current);
    // Im Browser gibt es kein "Rollen zu Ende" — also warten, bis es still ist.
    settle.current = setTimeout(() => settleAt(lastY.current), SETTLE_MS);
  }

  function step(direction: -1 | 1) {
    const slot = slotOf(Math.max(0, values.indexOf(value)) + direction);
    report(values[slot] ?? 0);
    ref.current?.scrollTo({ y: (middle * length + slot) * ITEM_HEIGHT, animated: true });
  }

  return (
    <ScrollView
      ref={ref}
      style={{ width }}
      contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
      contentOffset={{ x: 0, y: home }}
      onLayout={() => ref.current?.scrollTo({ y: target, animated: false })}
      onScroll={onScroll}
      scrollEventThrottle={16}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      {rows.map((entry, index) => (
        <Pressable
          key={index}
          accessibilityRole="button"
          accessibilityLabel={format(entry)}
          onPress={() => {
            report(entry);
            ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
          }}
          style={[styles.item, { height: ITEM_HEIGHT }]}
        >
          <Text
            variant="title"
            numberOfLines={1}
            style={{ fontVariant: ['tabular-nums'], fontWeight: theme.fontWeight.medium }}
          >
            {format(entry)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  frame: { flexDirection: 'row', justifyContent: 'center' },
  band: { position: 'absolute', left: 0, right: 0 },
  fade: { position: 'absolute', left: 0, right: 0, pointerEvents: 'none' },
  item: { alignItems: 'center', justifyContent: 'center' },
});
