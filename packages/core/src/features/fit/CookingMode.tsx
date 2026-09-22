import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Vibration, View } from 'react-native';

import { useI18n } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Text } from '@/ui';

import { Pill } from './KitchenKit';
import { clockOf, minutesIn } from './kitchenLogic';

const TICK_MS = 250;
const BAR = 4;
const BAR_GAP = 3;
const EDGE = 4;
const TIMER_BUTTON = 40;

/** Ein Wecker fuer einen Kochschritt: bis wann, und fuer welchen Schritt er gestellt wurde. */
type Timer = { endsAt: number; step: number; minutes: number };

/**
 * Kochmodus: ein Schritt je Seite, grosse Schrift, Zurueck und Weiter. Steht
 * im Schritt eine Zeit („10 Minuten“), startet ein Tipp den Wecker; bei null
 * vibriert das Telefon und die Vorlesefunktion sagt es. Der Wecker laeuft
 * weiter, auch wenn man schon beim naechsten Schritt ist.
 */
export function CookingMode({ steps, onClose }: { steps: readonly string[]; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const endsAt = timer?.endsAt ?? null;

  useEffect(() => {
    if (endsAt === null || endsAt <= Date.now()) return undefined;
    const tick = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) {
        clearInterval(tick);
        Vibration.vibrate([0, 400, 200, 400]);
        AccessibilityInfo.announceForAccessibility(t('fit.cook.timerDone'));
      }
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [endsAt, t]);

  const step = steps[index] ?? '';
  const minutes = minutesIn(step);
  const left = timer ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : 0;
  const last = index >= steps.length - 1;

  function start(value: number) {
    const current = Date.now();
    setNow(current);
    setTimer({ endsAt: current + value * 60000, step: index, minutes: value });
  }

  const total = timer ? timer.minutes * 60 : 1;
  const elapsed = timer ? Math.min(1, Math.max(0, 1 - left / total)) : 0;
  const dim = `${theme.colors.onInverse}1F`;

  return (
    <View style={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: BAR_GAP }}>
          {steps.map((entry, position) => (
            <View
              key={`${position}-${entry}`}
              style={{
                flex: 1,
                height: BAR,
                borderRadius: theme.radii.pill,
                backgroundColor: position <= index ? theme.colors.text : theme.colors.border,
              }}
            />
          ))}
        </View>
        <Text variant="overline" tone="faint">
          {t('fit.cook.step', { step: index + 1, count: steps.length })}
        </Text>
        <View accessibilityLiveRegion="polite">
          <Text
            variant="body"
            style={{
              fontSize: theme.fontSize.stat,
              lineHeight: theme.lineHeight.xl,
              fontWeight: theme.fontWeight.medium,
              letterSpacing: theme.tracking.title,
            }}
          >
            {step}
          </Text>
        </View>
      </View>

      {timer ? (
        <View
          style={{
            overflow: 'hidden',
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.inverse,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View accessible accessibilityRole="timer" style={{ flex: 1, gap: 2 }}>
              <Text variant="overline" style={{ color: theme.colors.onInverse }}>
                {t('fit.cook.timerFor', { step: timer.step + 1, minutes: timer.minutes })}
              </Text>
              <Text
                variant="display"
                style={[
                  numeric,
                  { color: theme.colors.onInverse, fontWeight: theme.fontWeight.extrabold },
                ]}
              >
                {left === 0 ? t('fit.cook.timerDone') : clockOf(left)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(left === 0 ? 'fit.cook.timerClear' : 'fit.cook.timerStop')}
              onPress={() => setTimer(null)}
              style={({ pressed }) => ({
                height: TIMER_BUTTON,
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.lg,
                borderRadius: theme.radii.pill,
                backgroundColor: dim,
                transform: [{ scale: pressed ? theme.motion.pressScale.button : 1 }],
              })}
            >
              <Text
                variant="label"
                style={{ color: theme.colors.onInverse, fontWeight: theme.fontWeight.semibold }}
              >
                {t(left === 0 ? 'fit.cook.timerClear' : 'fit.cook.timerStop')}
              </Text>
            </Pressable>
          </View>
          <View
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              height: EDGE,
              width: `${elapsed * 100}%`,
              backgroundColor: theme.colors.accent,
            }}
          />
        </View>
      ) : null}
      {minutes !== null && (!timer || timer.step !== index) ? (
        <Pill
          label={t('fit.cook.timerStart', { minutes })}
          icon="clock"
          tone="soft"
          onPress={() => start(minutes)}
        />
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Pill
              label={t('fit.cook.prev')}
              icon="back"
              tone="soft"
              fullWidth
              onPress={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={index === 0}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Pill
              label={t(last ? 'fit.cook.done' : 'fit.cook.next')}
              icon={last ? 'check' : 'forward'}
              fullWidth
              onPress={() => (last ? onClose() : setIndex((value) => value + 1))}
            />
          </View>
        </View>
        <View style={{ alignSelf: 'center' }}>
          <Pill label={t('fit.cook.close')} tone="white" size="sm" onPress={onClose} />
        </View>
      </View>
    </View>
  );
}
