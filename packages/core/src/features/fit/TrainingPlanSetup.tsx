import { useState } from 'react';
import { View } from 'react-native';

import { fit, type FitAction } from '@/db/fit';
import type { TrainingPlan } from '@/db/fitTraining';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, Panel, Segmented, Text } from '@/ui';

import { ActionCard } from './ActionCard';
import { GymPicker } from './GymPicker';
import { LEVELS, WEEKDAY_PATTERNS, goalsOfAim, aimOfGoal, type Level } from './onboardingPlan';
import { InkPill } from './TrainingParts';
import { WorkoutPlanPreview, weekdayLabel } from './WorkoutPlanPreview';

const GOALS = ['muscle', 'strength', 'fitness', 'fatloss'] as const;
const WEEK = [1, 2, 3, 4, 5, 6, 0];

type Draft = {
  goal: (typeof GOALS)[number];
  level: Level;
  gym: string | null;
  equipment: string[];
  weekdays: number[];
};

/**
 * Ein neuer Trainingsplan aus Studio, Geraeten, Tagen und Erfahrung — mit
 * Vorschau aller Uebungen, gespeichert erst nach „Bestaetigen“. Der Entwurf
 * beginnt beim laufenden Plan oder beim Profil, nie leer.
 */
export function TrainingPlanSetup({
  plan,
  profileGoal,
  daysPerWeek,
  onSaved,
  onCancel,
}: {
  plan: TrainingPlan | null;
  profileGoal: Parameters<typeof aimOfGoal>[0] | null | undefined;
  daysPerWeek: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [draft, setDraft] = useState<Draft>(() => ({
    goal:
      (plan?.goal as Draft['goal'] | undefined) ??
      (profileGoal ? goalsOfAim(aimOfGoal(profileGoal)).training : 'fitness'),
    level: (plan?.experience as Level | undefined) ?? 'beginner',
    gym: plan?.gym ?? null,
    equipment: Array.isArray(plan?.equipment) ? plan.equipment : [],
    weekdays: plan?.weekdays ??
      WEEKDAY_PATTERNS[Math.min(6, Math.max(2, daysPerWeek))] ?? [1, 3, 5],
  }));
  const [action, setAction] = useState<FitAction | null>(null);
  const [busy, setBusy] = useState(false);

  async function propose() {
    setBusy(true);
    if (action?.status === 'proposed') void fit.rejectAction(action.id);
    const result = await fit.proposeWorkoutPlan({
      goal: draft.goal,
      experience: draft.level,
      equipment: draft.equipment,
      gym: draft.gym,
      weekdays: draft.weekdays,
    });
    setBusy(false);
    if (result.ok) setAction(result.data.action);
  }

  const canPropose =
    draft.gym !== null &&
    draft.equipment.length > 0 &&
    draft.weekdays.length >= 2 &&
    draft.weekdays.length <= 6;
  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm } as const;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Panel label={t('fit.quick.q.where')}>
        <View style={{ marginTop: theme.spacing.md }}>
          <GymPicker
            gym={draft.gym}
            equipment={draft.equipment}
            onChange={({ gym, equipment }) => setDraft({ ...draft, gym, equipment })}
          />
        </View>
      </Panel>
      <Panel label={t('fit.training.days')}>
        <View style={[row, { marginTop: theme.spacing.md }]}>
          {WEEK.map((weekday) => (
            <Chip
              key={weekday}
              label={weekdayLabel(language, weekday)}
              selected={draft.weekdays.includes(weekday)}
              onPress={() =>
                setDraft({
                  ...draft,
                  weekdays: draft.weekdays.includes(weekday)
                    ? draft.weekdays.filter((entry) => entry !== weekday)
                    : [...draft.weekdays, weekday],
                })
              }
            />
          ))}
        </View>
        <Text
          variant="caption"
          tone={draft.weekdays.length < 2 || draft.weekdays.length > 6 ? 'danger' : 'muted'}
          style={{ marginTop: theme.spacing.sm }}
        >
          {t('fit.quick.plan.daysRange')}
        </Text>
      </Panel>
      <Panel label={t('fit.training.goal')}>
        <View style={[row, { marginTop: theme.spacing.md }]}>
          {GOALS.map((goal) => (
            <Chip
              key={goal}
              label={t(`fit.training.goal.${goal}` as TranslationKey)}
              selected={draft.goal === goal}
              onPress={() => setDraft({ ...draft, goal })}
            />
          ))}
        </View>
      </Panel>
      <Panel label={t('fit.training.level')}>
        <View style={{ marginTop: theme.spacing.md }}>
          <Segmented
            options={LEVELS.map((value) => ({
              value,
              label: t(`fit.training.level.${value}`),
            }))}
            value={draft.level}
            onChange={(level) => setDraft({ ...draft, level })}
            accessibilityLabel={t('fit.training.level')}
          />
        </View>
      </Panel>
      <View style={{ flexDirection: 'row', marginTop: theme.spacing.md }}>
        <InkPill
          label={t('fit.training.propose')}
          icon="check"
          tall
          onPress={() => void propose()}
          disabled={!canPropose || busy}
        />
      </View>
      {action?.status === 'proposed' ? <WorkoutPlanPreview action={action} /> : null}
      {action ? <ActionCard key={action.id} action={action} onDone={onSaved} /> : null}
      <View style={{ flexDirection: 'row' }}>
        <InkPill label={t('common.cancel')} soft onPress={onCancel} />
      </View>
    </View>
  );
}
