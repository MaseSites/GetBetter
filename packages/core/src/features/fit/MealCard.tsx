import { Animated, Pressable, StyleSheet, View } from 'react-native';

import type { FitMeal, MealSlot } from '@/db/fit';
import { formatList, localeFor, useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { SwipeRow, Text, usePressScale } from '@/ui';

import { FIT_BODY, FIT_LINE, Quiet } from './FitBlock';
import { shortFoodNames } from './foodLabel';

/** Der Tag in seiner Reihenfolge: der Snack steht vor dem Abendessen, wie im Heft. */
const DAY_ORDER: readonly MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
/** Die Spalte links: Uhrzeit oder der Punkt fuer das, was jetzt dran ist. */
const TIME_COLUMN = 42;
const DOT = 10;
const DOT_RING = 1.5;
const PILL_HEIGHT = 36;
const PILL_PADDING = 18;

/**
 * „Der Tag“: ein Block, darin je Mahlzeit eine Zeile wie im Heft — links die
 * Uhrzeit (Zuerich), dann Mahlzeit und was drin war, rechts die kcal. Eine
 * leere Mahlzeit sagt „Noch offen“; die, die gerade dran ist, traegt den
 * Signalpunkt, und wo es gestern etwas gab, steht „Wie gestern“ daneben.
 */
export function DayMeals({
  meals,
  yesterday,
  now,
  copying,
  canCopy,
  onEdit,
  onRemove,
  onAdd,
  onCopy,
}: {
  meals: readonly FitMeal[];
  yesterday: readonly FitMeal[];
  /** Die Mahlzeit, die jetzt dran ist — nur heute, sonst `null`. */
  now: MealSlot | null;
  copying: string | null;
  canCopy: boolean;
  onEdit: (meal: FitMeal) => void;
  onRemove: (meal: FitMeal) => void;
  onAdd: (slot: MealSlot) => void;
  onCopy: (slot: MealSlot) => void;
}) {
  const theme = useTheme();

  const rows = DAY_ORDER.flatMap(
    (slot): { key: string; slot: MealSlot; meal: FitMeal | null }[] => {
      const own = meals.filter((meal) => meal.slot === slot);
      if (own.length > 0) return own.map((meal) => ({ key: meal.id, slot, meal }));
      return [{ key: `open-${slot}`, slot, meal: null }];
    },
  );
  // Der Punkt steht bei der naechsten offenen Mahlzeit ab jetzt — nur heute.
  const nowIndex = now ? DAY_ORDER.indexOf(now) : -1;
  const next = now
    ? (rows.find((row) => !row.meal && DAY_ORDER.indexOf(row.slot) >= nowIndex)?.slot ?? null)
    : null;

  return (
    <View
      style={[
        theme.elevation.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.panel,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.xs,
          overflow: 'hidden',
        },
      ]}
    >
      {rows.map((row, index) => {
        const last = index === rows.length - 1;
        if (row.meal) {
          const meal = row.meal;
          // Mehrere Essen in einer Mahlzeit: der Name steht nur einmal, darunter die Essen.
          const continued = rows[index - 1]?.slot === row.slot;
          return (
            <SwipeRow key={row.key} onDelete={() => onRemove(meal)}>
              <MealCard
                meal={meal}
                last={last}
                continued={continued}
                onPress={() => onEdit(meal)}
              />
            </SwipeRow>
          );
        }
        const fromYesterday = yesterday.some((meal) => meal.slot === row.slot);
        return (
          <OpenSlot
            key={row.key}
            slot={row.slot}
            now={row.slot === next}
            last={last}
            copy={canCopy && fromYesterday}
            copyBusy={copying === row.slot}
            copyLocked={copying !== null}
            onAdd={() => onAdd(row.slot)}
            onCopy={() => onCopy(row.slot)}
          />
        );
      })}
    </View>
  );
}

/**
 * Eine gegessene Mahlzeit als Zeile: Uhrzeit, Mahlzeit, was drin war, kcal —
 * bei Schaetzungen der Bereich. Ein Tipp oeffnet sie zum Bearbeiten.
 */
export function MealCard({
  meal,
  last = false,
  continued = false,
  onPress,
}: {
  meal: FitMeal;
  last?: boolean;
  /** Ein weiteres Essen derselben Mahlzeit: ohne ihren Namen. */
  continued?: boolean;
  onPress: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const time = new Intl.DateTimeFormat(localeFor(language), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  }).format(new Date(meal.createdAt));
  const estimated = meal.range && meal.range.kcalMax - meal.range.kcalMin > 0;
  // Ein gebauter Name (die Zeilen hintereinander) wird kurz, ein eigener bleibt.
  const auto =
    meal.nameAuto === true || meal.name === meal.items.map((item) => item.name).join(', ');
  const items =
    meal.items.length > 0 && auto
      ? formatList(language, shortFoodNames(meal.items.map((item) => item.name)))
      : meal.name;
  const detail = [
    items,
    ...(meal.source === 'plan' ? [t('fit4.meal.fromPlan')] : []),
    ...(estimated && meal.range
      ? [
          t('fit.meal.range', {
            min: whole.format(meal.range.kcalMin),
            max: whole.format(meal.range.kcalMax),
          }),
        ]
      : []),
  ].join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('fit4.meal.edit', {
        name: meal.name,
        kcal: whole.format(meal.total.kcal),
      })}
      accessibilityHint={t('fit4.meal.editHint')}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.row,
          {
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            borderBottomWidth: last ? 0 : 1,
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <View style={styles.time}>
          <Quiet size="sm">{time}</Quiet>
        </View>
        <View style={styles.grow}>
          {continued ? null : (
            <Text variant="label" numberOfLines={1} style={strong(theme)}>
              {t(`meals.slot.${meal.slot}` as TranslationKey)}
            </Text>
          )}
          <Quiet size="sm" lines={2}>
            {detail}
          </Quiet>
        </View>
        <Text variant="label" style={[numeric, strong(theme)]}>
          {whole.format(meal.total.kcal)}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Eine leere Mahlzeit: ein Tipp traegt ein, daneben (kein Knopf im Knopf) „Wie gestern“. */
function OpenSlot({
  slot,
  now,
  last,
  copy,
  copyBusy,
  copyLocked,
  onAdd,
  onCopy,
}: {
  slot: MealSlot;
  /** Die naechste offene Mahlzeit: traegt den Signalpunkt und fragt „Wie gestern?“. */
  now: boolean;
  last: boolean;
  copy: boolean;
  copyBusy: boolean;
  copyLocked: boolean;
  onAdd: () => void;
  onCopy: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const name = t(`meals.slot.${slot}` as TranslationKey);

  return (
    <View
      style={[
        styles.row,
        {
          gap: theme.spacing.md,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('fit.meal.addTo', { slot: name })}
        accessibilityHint={now ? t('fit4.slot.now') : undefined}
        onPress={onAdd}
        style={({ pressed }) => [
          styles.row,
          styles.grow,
          { gap: theme.spacing.md, paddingVertical: theme.spacing.md, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <View style={styles.time}>
          {now ? (
            <View
              style={{
                width: DOT,
                height: DOT,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.accent,
                borderWidth: DOT_RING,
                borderColor: theme.colors.accentMark,
              }}
            />
          ) : null}
        </View>
        <View style={styles.grow}>
          <Text variant="label" numberOfLines={1} style={strong(theme)}>
            {name}
          </Text>
          <Quiet size="sm" lines={2}>
            {now && copy ? t('fit4.slot.openCopy') : t('fit4.slot.open')}
          </Quiet>
        </View>
      </Pressable>
      {copy ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}: ${t('fit4.copy.slot')}`}
          accessibilityState={{ busy: copyBusy, disabled: copyLocked }}
          disabled={copyLocked}
          onPress={onCopy}
          style={({ pressed }) => [
            styles.center,
            {
              height: PILL_HEIGHT,
              paddingHorizontal: PILL_PADDING,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surfaceMuted,
              opacity: copyLocked && !copyBusy ? 0.5 : 1,
              transform: [{ scale: pressed ? theme.motion.pressScale.button : 1 }],
            },
          ]}
        >
          <Text
            variant="label"
            numberOfLines={1}
            style={{
              fontSize: theme.fontSize.lede,
              lineHeight: FIT_LINE.lede,
              fontWeight: theme.fontWeight.semibold,
            }}
          >
            {copyBusy ? t('fit.add.saving') : t('fit4.copy.slot')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Name der Mahlzeit und kcal: 16 pt, halbfett — der Fliesstext des Entwurfs. */
function strong(theme: ReturnType<typeof useTheme>) {
  return { fontSize: FIT_BODY, lineHeight: FIT_LINE.body, fontWeight: theme.fontWeight.semibold };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  time: { width: TIME_COLUMN, justifyContent: 'center' },
});
