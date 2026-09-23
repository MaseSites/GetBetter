import { View } from 'react-native';

import type { FitAction, FitDay, FitGoals } from '@/db/fit';
import { useI18n } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Button, Chip, Text } from '@/ui';

import type { QuickAnswers } from './onboardingPlan';
import { WorkoutPlanPreview, weekdayLabel } from './WorkoutPlanPreview';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

/**
 * Der letzte Schritt: der ganze Plan auf einer Seite — kcal, Makros, Trinken
 * und das Training mit den Wochentagen. Ein Tipp auf einen Tag aendert Profil
 * (und damit die kcal-Verteilung) und Trainingsplan.
 */
export function OnboardingPlanStep({
  answers,
  goals,
  today,
  action,
  planning,
  busy,
  failure,
  onWeekday,
  onStart,
}: {
  answers: QuickAnswers;
  goals: FitGoals;
  today: FitDay | null;
  action: FitAction | null;
  /** Ein neuer Vorschlag ist unterwegs. */
  planning: boolean;
  busy: boolean;
  failure: string | null;
  onWeekday: (weekday: number) => void;
  onStart: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const litres = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 });

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View
        style={[
          theme.elevation.card,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.item,
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
          },
        ]}
      >
        <Text variant="overline" tone="muted">
          {t('fit.quick.plan.food')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}>
          <Text variant="hero" style={numeric}>
            {whole.format(goals.kcal)}
          </Text>
          <Text variant="label" tone="muted">
            {t('fit.quick.plan.kcalPerDay')}
          </Text>
        </View>
        <Text variant="body" style={numeric}>
          {t('fit.quick.plan.macros', {
            protein: whole.format(goals.proteinG),
            carbs: whole.format(goals.carbsG),
            fat: whole.format(goals.fatG),
          })}
        </Text>
        {goals.trainingDay.kcal !== goals.restDay.kcal ? (
          <Text variant="caption" tone="muted" style={numeric}>
            {t('fit.setup.dayKinds', {
              training: whole.format(goals.trainingDay.kcal),
              rest: whole.format(goals.restDay.kcal),
            })}
          </Text>
        ) : null}
        {today ? (
          <Text variant="caption" tone="muted" style={numeric}>
            {t('fit.quick.plan.water', { litres: litres.format(today.waterTargetMl / 1000) })}
          </Text>
        ) : null}
        {goals.safety.mode === 'maintain_only' ? (
          <Text variant="body" tone="danger">
            {goals.safety.reasons.includes('very_low_weight')
              ? t('fit8.safety.lowWeight')
              : t('fit.setup.safetyResult')}
          </Text>
        ) : null}
      </View>

      {answers.trainingDays > 0 || answers.gym !== null ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="overline" tone="muted">
            {t('fit.quick.plan.training')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {WEEK.map((weekday) => (
              <Chip
                key={weekday}
                label={weekdayLabel(language, weekday)}
                selected={answers.weekdays.includes(weekday)}
                onPress={() => onWeekday(weekday)}
              />
            ))}
          </View>
          {answers.weekdays.length < 2 || answers.weekdays.length > 6 ? (
            <Text variant="caption" tone="danger">
              {t('fit.quick.plan.daysRange')}
            </Text>
          ) : planning ? (
            <Text variant="caption" tone="muted">
              {t('fit4.onboarding.replanning')}
            </Text>
          ) : action ? (
            <WorkoutPlanPreview action={action} />
          ) : null}
        </View>
      ) : null}

      <Text variant="caption" tone="muted">
        {t('fit.setup.estimate')}
      </Text>
      {failure ? (
        <Text variant="label" tone="danger">
          {failure}
        </Text>
      ) : null}
      <Button
        label={t('fit.quick.start')}
        icon="check"
        onPress={onStart}
        loading={busy}
        disabled={busy || planning}
        fullWidth
      />
    </View>
  );
}
