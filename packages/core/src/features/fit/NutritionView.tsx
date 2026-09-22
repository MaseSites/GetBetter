import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { MEAL_SLOTS, fit, type FitMeal, type MealSlot } from '@/db/fit';
import {
  formatDayMonth,
  formatLongDate,
  formatWeekdayLong,
  useI18n,
  type TranslationKey,
} from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import type { ModuleDefinition } from '@/mocks/types';
import { numeric, useTheme } from '@/theme';
import {
  Button,
  FloatingButton,
  Panel,
  Screen,
  Text,
  usePressScale,
  useUndo,
  type FloatingButtonMenuItem,
  type IconName,
} from '@/ui';

import { AreaHeader } from './KitchenKit';
import { AddMealSheet } from './AddMealSheet';
import { DailyQuote } from './DailyQuote';
import { DaySheet } from './DaySheet';
import { Block, BlockLabel, FIT_BODY, Quiet } from './FitBlock';
import { FitState } from './FitGate';
import { FitOnboarding } from './FitOnboarding';
import { FitSetup } from './FitSetup';
import { FITS_FROM_KCAL, FitsCard } from './FitsCard';
import { IntentKeys } from './intentKeys';
import { DayMeals } from './MealCard';
import { MealEditSheet } from './MealEditSheet';
import { shiftDayKey, slotForNow, zurichDay } from './slots';
import { TodayHead } from './TodayHead';
import { useFit } from './useFit';
import { useMealToast } from './useMealToast';
import { WaterCard } from './WaterCard';

/** Der heutige Tag in Zuerich — derselbe, den der Dienst nimmt. */
export function zurichToday(): string {
  return zurichDay();
}

const SLOT_ICON: Record<MealSlot, IconName> = {
  breakfast: 'sun',
  lunch: 'partlySunny',
  dinner: 'sleep',
  snack: 'star',
};

/** Die Zeile unter „Heute“ steht 2 unter dem Titel (der Kopf setzt 8, daher -6). */
const SUBTITLE_TOP = -6;
/** Der Spruch 18 unter der Zeile, die Bloecke 14 unter dem Spruch. */
const QUOTE_TOP = 18;
const BLOCKS_TOP = 14;
/** „Der Tag“ steht 22 unter den Bloecken. */
const SECTION_TOP = 22;
/** Der Satz des Coachs: 16 auf 22, 6 unter der Marke. */
const COACH_LINE = 22;
const COACH_GAP = 6;
/** Die Marke auf Tinte ist leiser als der Satz. */
const COACH_LABEL_OPACITY = 0.72;
/** Platz fuer das Plus unten rechts, damit die Links darueber erreichbar bleiben. */
const FAB_ROOM = 72;

/**
 * Die Ernaehrung eines Tages, genau nach dem Entwurf: oben der Tag als Titel
 * (ein Tipp auf die Zeile darunter wechselt den Tag), der Spruch, dann Bloecke
 * — „Heute noch“ mit der einen grossen Zahl, „Was passt noch“, „Getrunken“ —,
 * darunter „Der Tag“ als Heft mit einer Zeile je Mahlzeit und die Karte vom
 * Coach. Ziele und alle Angaben stehen leise ganz unten. Eingetragen wird ueber
 * das Plus; eine Mahlzeit antippen heisst bearbeiten, leere bieten „Wie gestern“.
 */
export function NutritionView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const undo = useUndo();
  const toast = useMealToast();
  const today = zurichToday();
  const [day, setDay] = useState(today);
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const [editing, setEditing] = useState<FitMeal | null>(null);
  const [onboarding, setOnboarding] = useState<boolean | null>(null);
  const [details, setDetails] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [keys] = useState(() => new IntentKeys());
  const yesterday = shiftDayKey(day, -1);

  const summary = useFit(() => fit.day(day), [day], ['diary', 'profile', 'training']);
  const previous = useFit(() => fit.day(yesterday), [yesterday], ['diary']);
  const profile = useFit(() => fit.profile(), [], ['profile']);
  const data = summary.data;

  // Beim ersten Mal ohne Profil geht das Einrichten gleich auf — bis man es schliesst.
  // Einmal offen, bleibt es offen — auch wenn das Profil mittendrin gespeichert
  // wird; sonst verschwaende der letzte Schritt mit dem Plan.
  if (onboarding === null && data && !data.hasProfile) setOnboarding(true);
  const showOnboarding = onboarding === true;

  async function remove(meal: FitMeal) {
    const removed = await fit.removeMeal(meal.id);
    if (!removed.ok) return;
    undo.show({
      message: t('fit.meal.removed', { name: meal.name }),
      onUndo: () => {
        void fit.changes('meals').then((result) => {
          const change = result.ok
            ? result.data.changes.find(
                (entry) => entry.rowId === meal.id && entry.action === 'remove' && !entry.undoneAt,
              )
            : undefined;
          if (change) void fit.undo(change.id);
        });
      },
    });
  }

  /** „Wie gestern“: eine Mahlzeit oder den ganzen Tag von gestern uebernehmen. */
  async function copyYesterday(slots: MealSlot[] | null) {
    if (copying) return;
    const id = slots ? slots.join('-') : 'day';
    setCopying(id);
    setCopyError(null);
    const result = await fit.copyDay(
      day,
      { from: yesterday, ...(slots ? { slots } : {}) },
      keys.of(`copy-${day}-${id}`),
    );
    setCopying(null);
    if (result.ok) toast.copied(result.data.meals);
    else setCopyError(t(result.error === 'offline' ? 'fit.offline.body' : 'fit4.logFailed'));
  }

  // Die Mahlzeit, die gerade dran ist, steht zuoberst — nach Zuercher Zeit.
  const current = slotForNow();
  const menu: FloatingButtonMenuItem[] = [
    current,
    ...MEAL_SLOTS.filter((slot) => slot !== current),
  ].map((slot) => ({
    key: slot,
    label: t(`meals.slot.${slot}` as TranslationKey),
    icon: SLOT_ICON[slot],
    onPress: () => setAdding(slot),
  }));

  const yesterdayMeals = day <= today ? (previous.data?.meals ?? []) : [];
  const leftKcal = data?.target ? data.target.kcal - data.total.kcal : 0;
  const date = new Date(`${day}T12:00:00`);
  const kind = data ? t(data.kind === 'training' ? 'fit.day.training' : 'fit.day.rest') : null;
  const dateText =
    day === today ? formatLongDate(language, `${day}T12:00:00`) : formatDayMonth(language, date);
  const subtitle = kind ? t('fit4.day.subtitle', { date: dateText, kind }) : dateText;

  return (
    <>
      <Screen
        gap={theme.spacing.sm}
        contentStyle={{ paddingTop: QUOTE_TOP - theme.spacing.md }}
        header={
          <AreaHeader
            crumb={t('fit4.crumb', { area: t('area.health'), name: moduleName(t, module.id) })}
            title={day === today ? t('fit.day.today') : formatWeekdayLong(language, date)}
            subtitle={subtitle}
            subtitleHint={t('fit4.day.pick')}
            onSubtitlePress={() => setPicking(true)}
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
      >
        <FitState
          loading={summary.loading}
          error={summary.error}
          onRetry={summary.reload}
          hasData={data !== undefined}
        >
          <View>
            {data && !data.hasProfile ? (
              <Panel label={t('fit.quick.welcomeTitle')}>
                <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
                  {t('fit.quick.welcomeBody')}
                </Text>
                <View style={{ marginTop: theme.spacing.md }}>
                  <Button
                    label={t('fit.quick.welcomeAction')}
                    icon="sparkles"
                    onPress={() => setOnboarding(true)}
                  />
                </View>
              </Panel>
            ) : null}

            {day === today && data?.hasProfile ? (
              <View style={{ marginBottom: BLOCKS_TOP }}>
                <DailyQuote day={today} bare />
              </View>
            ) : null}

            <View style={{ gap: theme.spacing.sm }}>
              {data?.target ? <TodayHead data={data} /> : null}
              {data?.hasProfile ? (
                <>
                  {data.target && day <= today && leftKcal > FITS_FROM_KCAL ? (
                    <FitsCard
                      day={day}
                      slot={day === today ? current : 'dinner'}
                      leftKcal={leftKcal}
                    />
                  ) : null}
                  <WaterCard day={day} today={today} targetMl={data.waterTargetMl} />
                </>
              ) : null}
            </View>

            {data ? (
              <>
                <BlockLabel style={{ marginTop: SECTION_TOP, marginBottom: theme.spacing.sm }}>
                  {t('fit4.day.title')}
                </BlockLabel>
                {data.hasProfile && data.meals.length === 0 && yesterdayMeals.length > 0 ? (
                  <View style={{ marginBottom: theme.spacing.sm }}>
                    <Button
                      label={t('fit4.copy.day', { count: yesterdayMeals.length })}
                      variant="secondary"
                      icon="repeat"
                      onPress={() => void copyYesterday(null)}
                      loading={copying === 'day'}
                      disabled={copying !== null}
                    />
                  </View>
                ) : null}
                {copyError ? (
                  <Text variant="label" tone="danger" style={{ marginBottom: theme.spacing.sm }}>
                    {copyError}
                  </Text>
                ) : null}
                <DayMeals
                  meals={data.meals}
                  yesterday={yesterdayMeals}
                  now={day === today ? current : null}
                  copying={copying}
                  canCopy={data.hasProfile}
                  onEdit={setEditing}
                  onRemove={(meal) => void remove(meal)}
                  onAdd={setAdding}
                  onCopy={(slot) => void copyYesterday([slot])}
                />
                {day === today && data.hasProfile ? (
                  <CoachToday onPress={() => router.push('/run/coach')} />
                ) : null}
              </>
            ) : null}

            {data?.hasProfile ? (
              <View style={[styles.links, { gap: theme.spacing.xl, marginTop: SECTION_TOP }]}>
                <QuietLink label={t('fit.goals.edit')} onPress={() => setOnboarding(true)} />
                <QuietLink label={t('fit.nutrition.details')} onPress={() => setDetails(true)} />
              </View>
            ) : null}

            {data &&
            data.meals.some((meal) => meal.items.some((item) => item.source === 'mock')) ? (
              <Text
                variant="caption"
                tone="faint"
                align="center"
                style={{ marginTop: theme.spacing.md }}
              >
                {t('fit.mockNote')}
              </Text>
            ) : null}
            <View style={{ height: FAB_ROOM }} />
          </View>
        </FitState>

        {picking ? (
          <DaySheet day={day} today={today} onChange={setDay} onClose={() => setPicking(false)} />
        ) : null}
        {adding ? (
          <AddMealSheet initialSlot={adding} day={day} onClose={() => setAdding(null)} />
        ) : null}
        {editing ? <MealEditSheet meal={editing} onClose={() => setEditing(null)} /> : null}
        {showOnboarding ? (
          <FitOnboarding
            visible
            initial={profile.data?.profile ?? null}
            onClose={(done) => {
              setOnboarding(false);
              if (done) {
                summary.reload();
                profile.reload();
              }
            }}
          />
        ) : null}
        {details ? (
          <FitSetup
            visible
            initial={profile.data?.profile ?? null}
            onClose={() => setDetails(false)}
          />
        ) : null}
      </Screen>
      {data?.hasProfile && !adding && !editing ? (
        <FloatingButton compact label={t('fit.add.title')} text={t('fit.add.short')} menu={menu} />
      ) : null}
    </>
  );
}

/** Ein leiser Link unter dem Tag: Ziele ändern, Alle Angaben. */
function QuietLink({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={theme.spacing.md}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Quiet size="sm" weight="semibold">
        {label}
      </Quiet>
    </Pressable>
  );
}

/**
 * „Heute vom Coach“: die dunkle Karte mit dem ersten Hinweis des Tages — nach
 * festen Regeln im Dienst, kein KI-Aufruf. Ein Tipp fuehrt in den Coach.
 */
function CoachToday({ onPress }: { onPress: () => void }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const press = usePressScale();
  const coach = useFit(() => fit.coachToday(), [], ['training', 'diary']);
  const card = coach.data?.cards[0];
  if (!card) return null;
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const litres = new Intl.NumberFormat(`${language}-CH`, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const text =
    card.kind === 'protein'
      ? t('fit6.card.protein', { protein: whole.format(card.proteinG) })
      : card.kind === 'water'
        ? t('fit6.card.water', { target: litres.format(card.targetMl / 1000) })
        : t(card.tomorrowFree ? 'fit6.card.missed' : 'fit6.card.missedBusy', {
            title: card.title,
            day: formatDayMonth(language, new Date(`${card.day}T12:00:00`)),
          });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('fit6.card.title')}. ${text}`}
      accessibilityHint={t('fit4.coach.open')}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ marginTop: theme.spacing.sm }}
    >
      <Animated.View style={{ transform: [{ scale: press.scale }] }}>
        <Block style={{ backgroundColor: theme.colors.inverse, boxShadow: 'none' }}>
          <BlockLabel color={theme.colors.onInverse} style={{ opacity: COACH_LABEL_OPACITY }}>
            {t('fit6.card.title')}
          </BlockLabel>
          <Text
            variant="body"
            style={[
              numeric,
              {
                marginTop: COACH_GAP,
                color: theme.colors.onInverse,
                fontSize: FIT_BODY,
                lineHeight: COACH_LINE,
                letterSpacing: 0,
              },
            ]}
          >
            {text}
          </Text>
        </Block>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: { alignSelf: 'flex-start', marginTop: SUBTITLE_TOP },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
});
