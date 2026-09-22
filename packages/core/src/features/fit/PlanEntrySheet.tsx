import { useState } from 'react';
import { View } from 'react-native';

import { MEAL_SLOTS, fit, type MealPlan, type MealSlot, type PlanEntry } from '@/db/fit';
import type { PlanChange } from '@/db/fitKitchen';
import { formatWeekdayLong, useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Loading, Sheet, Text } from '@/ui';

import { FitState } from './FitGate';
import { Hairline, Pill } from './KitchenKit';
import { Thumb, WhiteChip } from './KitchenMedia';
import { recipeImageFor } from './recipeImages';
import { useFit } from './useFit';
import { portionText } from './portionText';

type Mode = 'menu' | 'replace' | 'move';

/**
 * Eine Plan-Mahlzeit: gegessen, ersetzen (nur Passendes, mit kcal fuer das Ziel),
 * verschieben (Tag und Mahlzeit; was dort steht, tauscht den Platz), auslassen.
 */
export function PlanEntrySheet({
  plan,
  entry,
  busy,
  problem,
  onEat,
  onChange,
  onClose,
}: {
  plan: MealPlan;
  entry: PlanEntry;
  busy: boolean;
  problem: string | null;
  onEat: () => void;
  onChange: (change: PlanChange) => void;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const [mode, setMode] = useState<Mode>('menu');

  return (
    <Sheet
      visible
      onClose={onClose}
      title={entry.title}
      subtitle={t(`meals.slot.${entry.slot}` as TranslationKey)}
    >
      <PlanEntryBody
        plan={plan}
        entry={entry}
        mode={mode}
        setMode={setMode}
        busy={busy}
        onEat={onEat}
        onChange={onChange}
        language={language}
      />
      {problem ? (
        <Text variant="label" tone="danger">
          {problem}
        </Text>
      ) : null}
    </Sheet>
  );
}

function PlanEntryBody({
  plan,
  entry,
  mode,
  setMode,
  busy,
  onEat,
  onChange,
  language,
}: {
  plan: MealPlan;
  entry: PlanEntry;
  mode: Mode;
  setMode: (mode: Mode) => void;
  busy: boolean;
  onEat: () => void;
  onChange: (change: PlanChange) => void;
  language: Parameters<typeof formatWeekdayLong>[0];
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [toDay, setToDay] = useState(entry.day);
  const [toSlot, setToSlot] = useState<MealSlot>(entry.slot);
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const quarter = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 2 });
  const displaced = plan.days
    .find((day) => day.day === toDay)
    ?.entries.find((other) => other.slot === toSlot && other.id !== entry.id);
  const unchanged = toDay === entry.day && toSlot === entry.slot;

  if (mode === 'replace')
    return (
      <ReplaceOptions
        plan={plan}
        entry={entry}
        busy={busy}
        onPick={(recipeId) => onChange({ recipeId })}
        onBack={() => setMode('menu')}
      />
    );

  if (mode === 'move')
    return (
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        <Text variant="overline" tone="faint">
          {t('fit.plan.moveDay')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {plan.days.map((day) => (
            <WhiteChip
              key={day.day}
              label={formatWeekdayLong(language, new Date(`${day.day}T12:00:00`))}
              selected={day.day === toDay}
              onPress={() => setToDay(day.day)}
            >
              {formatWeekdayLong(language, new Date(`${day.day}T12:00:00`))}
            </WhiteChip>
          ))}
        </View>
        <Text variant="overline" tone="faint">
          {t('fit.plan.moveSlot')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {MEAL_SLOTS.map((slot) => (
            <WhiteChip
              key={slot}
              label={t(`meals.slot.${slot}` as TranslationKey)}
              selected={slot === toSlot}
              onPress={() => setToSlot(slot)}
            >
              {t(`meals.slot.${slot}` as TranslationKey)}
            </WhiteChip>
          ))}
        </View>
        {displaced && !unchanged ? (
          <Text variant="caption" tone="muted">
            {displaced.status === 'eaten'
              ? t('fit.plan.targetEaten')
              : t('fit.plan.moveSwap', { title: displaced.title })}
          </Text>
        ) : null}
        <Pill
          label={t('fit.plan.moveConfirm')}
          icon="check"
          fullWidth
          onPress={() => onChange({ toDay, toSlot })}
          disabled={busy || unchanged || displaced?.status === 'eaten'}
          loading={busy}
        />
        <Pill label={t('common.back')} tone="soft" fullWidth onPress={() => setMode('menu')} />
      </View>
    );

  return (
    <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
      <Text variant="label" tone="muted" style={[numeric, { marginBottom: theme.spacing.xs }]}>
        {`${portionText(t, entry.portions, (value) => quarter.format(value))} · ${t('fit.plan.kcal', { kcal: whole.format(entry.nutrients.kcal) })}`}
        {entry.cookPortions
          ? ` · ${t('fit.plan.cooksFor', { count: quarter.format(entry.cookPortions) })}`
          : ''}
      </Text>
      <Pill
        label={t('fit.plan.eat')}
        icon="check"
        fullWidth
        onPress={onEat}
        loading={busy}
        disabled={busy}
      />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Pill
            label={t('fit.plan.replace')}
            tone="soft"
            icon="refresh"
            fullWidth
            onPress={() => setMode('replace')}
            disabled={busy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Pill
            label={t('fit.plan.move')}
            tone="soft"
            icon="calendar"
            fullWidth
            onPress={() => setMode('move')}
            disabled={busy}
          />
        </View>
      </View>
      <View style={{ alignSelf: 'center' }}>
        <Pill
          label={t('fit.plan.skip')}
          tone="white"
          size="sm"
          onPress={() => onChange({ skip: true })}
          disabled={busy}
        />
      </View>
    </View>
  );
}

/** Nur, was der Dienst fuer diese Mahlzeit erlaubt — eigene Rezepte zuerst, dann was am besten ins Ziel passt. */
function ReplaceOptions({
  plan,
  entry,
  busy,
  onPick,
  onBack,
}: {
  plan: MealPlan;
  entry: PlanEntry;
  busy: boolean;
  onPick: (recipeId: string) => void;
  onBack: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const options = useFit(() => fit.planOptions(plan.id, entry.id), [plan.id, entry.id]);
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const quarter = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 2 });
  const list = options.data?.options ?? [];

  return (
    <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
      <FitState loading={options.loading} error={options.error} onRetry={options.reload}>
        {list.length === 0 ? (
          <Text variant="body" tone="muted">
            {t('fit.plan.noOptions')}
          </Text>
        ) : (
          <View>
            {list.map((option, index) => (
              <View key={option.recipeId}>
                {index > 0 ? <Hairline /> : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    paddingVertical: theme.spacing.md,
                  }}
                >
                  <Thumb source={recipeImageFor({ id: option.recipeId })} label={option.title} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body" style={{ fontWeight: theme.fontWeight.semibold }}>
                      {option.title}
                    </Text>
                    <Text variant="label" tone="muted" style={numeric}>
                      {t('fit.plan.option', {
                        portions: portionText(t, option.portions, (value) => quarter.format(value)),
                        kcal: whole.format(option.kcal),
                      })}
                    </Text>
                  </View>
                  <Pill
                    label={t('fit.plan.pick')}
                    accessibilityLabel={t('fit.plan.pickFor', { title: option.title })}
                    tone="soft"
                    size="sm"
                    onPress={() => onPick(option.recipeId)}
                    disabled={busy}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </FitState>
      {busy ? <Loading /> : null}
      <Pill label={t('common.back')} tone="soft" fullWidth onPress={onBack} />
    </View>
  );
}
