import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { MEAL_SLOTS, type FitMeal, type MealSlot } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { useReducedMotion } from '@/ui';

import { Quiet } from './FitBlock';

const BAR_HEIGHT = 9;
const BAR_GAP = 3;
/** Das Band 14 unter der Zahl, die Legende 10 darunter — wie im Entwurf. */
const BAR_TOP = 14;
const LEGEND_TOP = 10;
const LEGEND_ROW_GAP = 6;
const LEGEND_COLUMN_GAP = 14;
const SWATCH = 7;
const SWATCH_RADIUS = 2;
const SWATCH_GAP = 6;
/** Vier Mahlzeiten und der Rest — mehr Abschnitte gibt es nie. */
const MAX_PIECES = MEAL_SLOTS.length + 1;
/** Die Abschnitte wachsen nacheinander, nicht alle auf einmal. */
const STAGGER_MS = 40;
const useNativeDriver = Platform.OS !== 'web';

/**
 * Das Tagesband im Stil der Bereichsseiten: je gegessene Mahlzeit ein
 * Abschnitt in Tinte, was noch Platz hat als Linie. Darueber hinaus ist
 * nichts rot — der Rest faellt einfach weg, die Zahl darueber sagt es ruhig.
 * Beim ersten Laden wachsen die Abschnitte von links, versetzt um 40 ms.
 */
export function DayBand({ meals, targetKcal }: { meals: FitMeal[]; targetKcal: number }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [grow] = useState(() =>
    Array.from({ length: MAX_PIECES }, () => new Animated.Value(reduced ? 1 : 0)),
  );
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });

  useEffect(() => {
    if (reduced) {
      for (const value of grow) value.setValue(1);
      return;
    }
    Animated.stagger(
      STAGGER_MS,
      grow.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: theme.motion.duration.sheet,
          easing: theme.motion.easing.out,
          useNativeDriver,
        }),
      ),
    ).start();
  }, [grow, reduced, theme.motion.duration.sheet, theme.motion.easing.out]);

  const bySlot = MEAL_SLOTS.map((slot) => ({
    slot,
    kcal: meals
      .filter((meal) => meal.slot === slot)
      .reduce((sum, meal) => sum + meal.total.kcal, 0),
  }));
  const eaten = bySlot.reduce((sum, entry) => sum + entry.kcal, 0);
  const done = bySlot.filter((entry) => entry.kcal > 0);
  const open = bySlot.filter((entry) => entry.kcal <= 0);
  const rest = Math.max(0, targetKcal - eaten);
  const pieces: { key: string; value: number; ink: boolean }[] = [
    ...done.map((entry) => ({ key: entry.slot, value: entry.kcal, ink: true })),
    ...(rest > 0 || done.length === 0
      ? [{ key: 'rest', value: Math.max(rest, 1), ink: false }]
      : []),
  ];

  const slotName = (slot: MealSlot) => t(`meals.slot.${slot}` as TranslationKey);
  const legend: { key: string; label: string; ink: boolean }[] = [
    ...done.map((entry) => ({
      key: entry.slot,
      label: t('health.slotKcal', { slot: slotName(entry.slot), kcal: whole.format(entry.kcal) }),
      ink: true,
    })),
    ...open.map((entry) => ({
      key: entry.slot,
      label: t('health.slotOpen', { slot: slotName(entry.slot) }),
      ink: false,
    })),
  ];

  return (
    <View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('fit.band.label', {
          eaten: whole.format(eaten),
          target: whole.format(targetKcal),
        })}
        accessibilityValue={{ min: 0, max: Math.round(targetKcal), now: Math.round(eaten) }}
        style={[styles.bar, { marginTop: BAR_TOP }]}
      >
        {pieces.map((piece, index) => (
          <Animated.View
            key={piece.key}
            style={{
              flex: piece.value,
              height: '100%',
              borderRadius: theme.radii.pill,
              backgroundColor: piece.ink ? theme.colors.text : theme.colors.border,
              transformOrigin: 'left',
              transform: [{ scaleX: grow[index] ?? 1 }],
            }}
          />
        ))}
      </View>
      <View
        style={[
          styles.legend,
          { rowGap: LEGEND_ROW_GAP, columnGap: LEGEND_COLUMN_GAP, marginTop: LEGEND_TOP },
        ]}
      >
        {legend.map((item) => (
          <View key={item.key} style={[styles.item, { gap: SWATCH_GAP }]}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: item.ink ? theme.colors.text : theme.colors.borderStrong },
              ]}
            />
            <Quiet size="sm" tone="muted">
              {item.label}
            </Quiet>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', height: BAR_HEIGHT, gap: BAR_GAP },
  legend: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH_RADIUS },
});
