import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';

import { useI18n } from '@/i18n';
import { ensureContrast, numeric, useTheme } from '@/theme';
import { Text, useReducedMotion, usePressScale } from '@/ui';

import { formatClock } from './trainingText';
import { TRAINING } from './trainingType';

/** Eine laufende Pause: seit wann, bis wann. `+30 s` verschiebt nur das Ende. */
export type Rest = { startedAt: number; endsAt: number };

const TICK_MS = 250;
const EDGE = 4;
const PILL_HEIGHT = 40;
const PILL_PAD_X = 18;
/** Die Leiste: 20 rund, innen 14 · 16 · 16. */
const BAR_RADIUS = 20;
const BAR_TOP = 14;
/** Die Flaeche einer Pille auf der Tintenleiste: ein Hauch Papier (#2A2B24 im Entwurf). */
const PILL_TINT = 0.1;
/** Die Marke „Pause“ tritt hinter die Zeit zurueck. */
const LABEL_OPACITY = 0.72;
const MIN_EDGE_CONTRAST = 3;
const useNativeDriver = Platform.OS !== 'web';

/**
 * Die Pause nach einem Satz, fest unten im Blatt: eine Leiste in Tinte, gross
 * die Zeit als m:ss, daneben +30 s und Überspringen; unten laeuft eine Kante
 * in Signal linear mit. Am Ende vibriert das Telefon einmal und die
 * Vorlesefunktion sagt „Pause vorbei“ — dann steht der Takt still.
 * Blockiert nichts: eintragen geht jederzeit weiter.
 */
export function RestTimer({
  rest,
  onChange,
}: {
  rest: Rest;
  onChange: (next: Rest | null) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const [progress] = useState(() => new Animated.Value(0));
  const { startedAt, endsAt } = rest;

  useEffect(() => {
    if (endsAt <= Date.now()) return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) {
        clearInterval(timer);
        Vibration.vibrate();
        AccessibilityInfo.announceForAccessibility(t('fit6.rest.over'));
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [endsAt, t]);

  // Die Kante: vom jetzigen Anteil linear bis ans Ende; +30 s setzt neu an.
  useEffect(() => {
    const total = Math.max(1, endsAt - startedAt);
    const current = Date.now();
    const share = Math.min(1, Math.max(0, (current - startedAt) / total));
    progress.setValue(share);
    if (reduced !== false || share >= 1) return undefined;
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: endsAt - current,
      easing: theme.motion.easing.linear,
      useNativeDriver,
    });
    run.start();
    return () => run.stop();
  }, [endsAt, progress, reduced, startedAt, theme.motion.easing.linear]);

  // Ohne Bewegung springt die Kante mit dem Takt weiter.
  useEffect(() => {
    if (reduced !== true) return;
    const total = Math.max(1, endsAt - startedAt);
    progress.setValue(Math.min(1, Math.max(0, (now - startedAt) / total)));
  }, [endsAt, now, progress, reduced, startedAt]);

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const over = left === 0;
  const clock = formatClock(left);
  const ink = theme.colors.onInverse;
  const edge = ensureContrast(theme.colors.accent, theme.colors.inverse, MIN_EDGE_CONTRAST);

  return (
    <View
      style={{
        borderRadius: BAR_RADIUS,
        backgroundColor: theme.colors.inverse,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: BAR_TOP,
        paddingBottom: theme.spacing.lg,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View
          accessible
          accessibilityRole="timer"
          accessibilityLabel={over ? t('fit6.rest.over') : t('fit6.rest.a11y', { time: clock })}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Text
            variant="overline"
            numberOfLines={1}
            style={{
              color: ink,
              opacity: LABEL_OPACITY,
              lineHeight: TRAINING.line11,
              letterSpacing: TRAINING.capsTracking,
            }}
          >
            {over ? t('fit6.rest.over') : t('fit6.v.rest.label')}
          </Text>
          <Text
            variant="display"
            style={[
              numeric,
              {
                color: ink,
                fontWeight: theme.fontWeight.extrabold,
                letterSpacing: TRAINING.displayTracking,
              },
            ]}
          >
            {clock}
          </Text>
        </View>
        {over ? null : (
          <DarkPill
            label={t('fit6.rest.add')}
            accessibilityLabel={t('fit6.rest.addA11y')}
            onPress={() => onChange({ ...rest, endsAt: Math.max(endsAt, Date.now()) + 30000 })}
          />
        )}
        <DarkPill
          label={t('fit6.v.rest.next')}
          accessibilityLabel={over ? t('fit6.v.rest.next') : t('fit6.v.rest.skipA11y')}
          onPress={() => onChange(null)}
        />
      </View>
      <Animated.View
        style={[
          styles.edge,
          {
            height: EDGE,
            backgroundColor: edge,
            transformOrigin: 'left',
            transform: [{ scaleX: progress }],
          },
        ]}
      />
    </View>
  );
}

/** Eine Pille auf der Tintenleiste. */
function DarkPill({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={{
          height: PILL_HEIGHT,
          justifyContent: 'center',
          paddingHorizontal: PILL_PAD_X,
          borderRadius: theme.radii.pill,
          overflow: 'hidden',
          transform: [{ scale: press.scale }],
        }}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.onInverse, opacity: PILL_TINT },
          ]}
        />
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            color: theme.colors.onInverse,
            fontSize: theme.fontSize.md,
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

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
