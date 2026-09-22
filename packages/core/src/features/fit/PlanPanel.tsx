import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { fit, type FitAction, type MealPlan, type PlanEntry } from '@/db/fit';
import type { PlanChange } from '@/db/fitKitchen';
import { formatShortDate, formatWeekdayLong, useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { EmptyState, Icon, IconButton, Text, useUndo } from '@/ui';

import { ActionCard } from './ActionCard';
import { FitState } from './FitGate';
import { kitchenError } from './kitchenErrors';
import { Block, Hairline, Pill, RoundIcon } from './KitchenKit';
import { addDays } from './kitchenLogic';
import { RoundCheck, Thumb } from './KitchenMedia';
import { PlanEntrySheet } from './PlanEntrySheet';
import { recipeImageFor } from './recipeImages';
import { useFit } from './useFit';
import { portionText } from './portionText';

const DOT = 10;
const DOT_BORDER = 1.5;

/**
 * Der Wochen-Essensplan: erst ein Vorschlag, gespeichert nach Bestaetigung.
 * Woche fuer Woche blaetterbar. Je Mahlzeit: gegessen (ins Tagebuch),
 * ersetzen, verschieben, auslassen — und Ausgelassenes doch wieder einplanen.
 * Jede Aenderung ist ein Vorschlag mit neuen Tageswerten.
 */
export function PlanPanel() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const undo = useUndo();
  const [week, setWeek] = useState<string | null>(null);
  const current = useFit(() => fit.currentPlan(week ?? undefined), [week], ['kitchen']);
  const [action, setAction] = useState<FitAction | null>(null);
  const [entry, setEntry] = useState<PlanEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const quarter = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 2 });
  const plan: MealPlan | null = current.data?.plan ?? null;
  const weekStart = current.data?.weekStart ?? week;
  const thisWeek = current.data?.today ? current.data.today : null;

  async function propose(run: () => ReturnType<typeof fit.proposePlan>) {
    setBusy(true);
    setProblem(null);
    const result = await run();
    setBusy(false);
    if (result.ok) {
      setAction(result.data.action);
      setEntry(null);
    } else setProblem(kitchenError(t, result.error));
  }

  const change = (target: PlanEntry, next: PlanChange) => {
    if (!plan) return;
    void propose(() => fit.proposePlanChange(plan.id, target.id, next));
  };

  async function eat(target: PlanEntry) {
    if (!plan) return;
    setBusy(true);
    setProblem(null);
    const result = await fit.logPlanEntry(plan.id, target.id);
    setBusy(false);
    if (!result.ok) {
      setProblem(kitchenError(t, result.error));
      return;
    }
    setEntry(null);
    undo.show({
      message: t('fit.plan.logged', {
        title: target.title,
        kcal: whole.format(result.data.meal.total.kcal),
      }),
    });
    if (result.data.pantryAction) setAction(result.data.pantryAction);
  }

  const shift = (days: number) => weekStart && setWeek(addDays(weekStart, days));
  const today = current.data?.today ?? null;
  const weekLabel =
    weekStart && thisWeek && weekStart <= thisWeek && thisWeek < addDays(weekStart, 7)
      ? t('fit.plan.thisWeek')
      : weekStart
        ? t('fit.plan.weekOf', { date: formatShortDate(language, `${weekStart}T12:00:00`) })
        : '';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {weekStart ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.sm,
          }}
        >
          <Text variant="title" style={{ flex: 1 }}>
            {weekLabel}
          </Text>
          <RoundIcon icon="back" label={t('fit.plan.prevWeek')} onPress={() => shift(-7)} />
          <RoundIcon icon="forward" label={t('fit.plan.nextWeek')} onPress={() => shift(7)} />
        </View>
      ) : null}
      {action ? (
        <ActionCard key={action.id} action={action} onDone={() => current.reload()} />
      ) : null}
      {problem && !entry ? (
        <Text variant="label" tone="danger">
          {problem}
        </Text>
      ) : null}
      <FitState loading={current.loading} error={current.error} onRetry={current.reload}>
        {!plan ? (
          <EmptyState
            title={t('fit.plan.emptyTitle')}
            body={t('fit.plan.emptyBody')}
            actionLabel={t('fit.plan.create')}
            onAction={() => void propose(() => fit.proposePlan(weekStart ?? undefined))}
          />
        ) : (
          <>
            {plan.days.map((day) => {
              const isToday = day.day === today;
              return (
                <Block key={day.day} flush>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      paddingTop: theme.spacing.md,
                      paddingBottom: theme.spacing.xs,
                    }}
                  >
                    {isToday ? (
                      <View
                        style={{
                          width: DOT,
                          height: DOT,
                          borderRadius: DOT / 2,
                          borderWidth: DOT_BORDER,
                          borderColor: theme.colors.accentMark,
                          backgroundColor: theme.colors.accent,
                        }}
                      />
                    ) : null}
                    <Text
                      variant="body"
                      numberOfLines={1}
                      style={{ flex: 1, fontWeight: theme.fontWeight.bold }}
                    >
                      {formatWeekdayLong(language, new Date(`${day.day}T12:00:00`))}
                      {isToday ? (
                        <Text variant="label" tone="muted">
                          {` · ${t('fit.kitchen.plan.today')}`}
                        </Text>
                      ) : null}
                    </Text>
                    <Icon
                      name={day.tolerance.kcalOk ? 'checkCircle' : 'warning'}
                      size={theme.fontSize.lede}
                      color={day.tolerance.kcalOk ? theme.colors.textMuted : theme.colors.danger}
                    />
                    <Text
                      variant="label"
                      tone={day.tolerance.kcalOk ? 'muted' : 'danger'}
                      style={[numeric, { fontWeight: theme.fontWeight.semibold }]}
                    >
                      {t(day.tolerance.kcalOk ? 'fit.plan.inTarget' : 'fit.plan.offTarget')}
                    </Text>
                  </View>
                  <Text variant="label" tone="muted" style={numeric}>
                    {t('fit.plan.dayTotal', {
                      kind: t(day.kind === 'training' ? 'fit.day.training' : 'fit.day.rest'),
                      total: whole.format(day.total.kcal),
                      target: whole.format(day.target.kcal),
                    })}
                    {!day.tolerance.proteinOk ? (
                      <Text variant="label" tone="danger">
                        {` · ${t('fit.plan.proteinLow')}`}
                      </Text>
                    ) : null}
                  </Text>
                  <View style={{ marginTop: theme.spacing.xs }}>
                    {day.entries.map((item) => (
                      <View key={item.id}>
                        <Hairline />
                        <PlanRow
                          item={item}
                          plan={plan}
                          busy={busy}
                          onOpen={() => {
                            setProblem(null);
                            setEntry(item);
                          }}
                          onUnskip={() => change(item, { unskip: true })}
                          whole={whole}
                          quarter={quarter}
                        />
                      </View>
                    ))}
                  </View>
                </Block>
              );
            })}
            <View style={{ alignSelf: 'center', marginTop: theme.spacing.sm }}>
              <Pill
                label={t('fit.plan.recreate')}
                tone="soft"
                icon="refresh"
                onPress={() => void propose(() => fit.proposePlan(plan.weekStart))}
                disabled={busy}
              />
            </View>
          </>
        )}
      </FitState>

      {entry && plan ? (
        <PlanEntrySheet
          key={entry.id}
          plan={plan}
          entry={entry}
          busy={busy}
          problem={problem}
          onEat={() => void eat(entry)}
          onChange={(next) => change(entry, next)}
          onClose={() => setEntry(null)}
        />
      ) : null}
    </View>
  );
}

/** Eine Mahlzeit im Tag: Bild, Name, Werte — gegessen mit Haken, ausgelassen blass. */
function PlanRow({
  item,
  plan,
  busy,
  onOpen,
  onUnskip,
  whole,
  quarter,
}: {
  item: PlanEntry;
  plan: MealPlan;
  busy: boolean;
  onOpen: () => void;
  onUnskip: () => void;
  whole: Intl.NumberFormat;
  quarter: Intl.NumberFormat;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const recipe = plan.recipes[item.recipeId];
  const image = recipeImageFor({ id: item.recipeId, basedOn: recipe?.basedOn ?? null });
  const planned = item.status === 'planned';
  const meta = [
    t(`meals.slot.${item.slot}` as TranslationKey),
    portionText(t, item.portions, (value) => quarter.format(value)),
    t('fit.plan.kcal', { kcal: whole.format(item.nutrients.kcal) }),
    item.fromEntryId ? t('fit.plan.leftover') : null,
    item.status === 'skipped' ? t('fit.plan.skipped') : null,
    item.status === 'eaten' ? t('fit.plan.eaten') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Pressable
        accessibilityRole={planned ? 'button' : undefined}
        accessibilityLabel={planned ? t('fit.plan.moreFor', { title: item.title }) : item.title}
        disabled={!planned}
        onPress={onOpen}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          opacity: item.status === 'skipped' ? 0.55 : pressed ? 0.7 : 1,
        })}
      >
        <Thumb source={image} label={item.title} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            variant="body"
            numberOfLines={2}
            tone={item.status === 'skipped' ? 'faint' : 'default'}
            style={{ fontWeight: theme.fontWeight.semibold }}
          >
            {item.title}
          </Text>
          <Text variant="label" tone="muted" style={numeric} numberOfLines={2}>
            {meta}
          </Text>
        </View>
      </Pressable>
      {item.status === 'eaten' ? <RoundCheck checked /> : null}
      {planned ? (
        <IconButton
          icon="more"
          label={t('fit.plan.moreFor', { title: item.title })}
          onPress={onOpen}
          tone="default"
        />
      ) : null}
      {item.status === 'skipped' ? (
        <Pill
          label={t('fit.plan.unskip')}
          tone="soft"
          size="sm"
          onPress={onUnskip}
          disabled={busy}
        />
      ) : null}
    </View>
  );
}
