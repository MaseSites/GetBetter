import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  ACTIVITIES,
  ALLERGENS,
  DIETS,
  EQUIPMENT,
  FIT_GOALS,
  fit,
  type FitGoals,
  type FitProfile,
} from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Checkbox, Chip, Input, Segmented, Sheet, Text } from '@/ui';

import { MacroTable } from './MacroTable';
import {
  EMPTY_DRAFT,
  draftErrors,
  draftToProfile,
  profileToDraft,
  toggled,
  type DraftField,
  type SetupDraft,
} from './setupForm';

const STEPS = ['body', 'everyday', 'goal', 'food', 'safety', 'result'] as const;
type Step = (typeof STEPS)[number];

const TRAINING_DAYS = [0, 1, 2, 3, 4, 5, 6, 7];
const COOK_MINUTES = [15, 30, 45, 60, 90];
const HOUSEHOLD = [1, 2, 3, 4, 5, 6];
const SAFETY_FLAGS = ['pregnant', 'breastfeeding', 'eatingDisorder', 'medicalCondition'] as const;

/**
 * Die Ziele einrichten oder aendern — in kleinen Schritten, jederzeit mit
 * Zurueck, und ganz am Ende ehrlich: das ist eine Startschaetzung.
 */
export function FitSetup({
  visible,
  initial,
  onClose,
}: {
  visible: boolean;
  initial: FitProfile | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [draft, setDraft] = useState<SetupDraft>(() =>
    initial ? profileToDraft(initial) : EMPTY_DRAFT,
  );
  const [step, setStep] = useState<Step>('body');
  const [touched, setTouched] = useState<DraftField[]>([]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [goals, setGoals] = useState<FitGoals | null>(null);

  const index = STEPS.indexOf(step);
  const errors = draftErrors(draft);
  const set = <K extends keyof SetupDraft>(key: K, value: SetupDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const fieldError = (field: DraftField) =>
    touched.includes(field) && errors.includes(field)
      ? t(`fit.setup.error.${field}` as TranslationKey)
      : undefined;
  const touch = (field: DraftField) =>
    setTouched((current) => (current.includes(field) ? current : [...current, field]));

  async function next() {
    if (step === 'body' && errors.length > 0) {
      setTouched(['birthDate', 'heightCm', 'weightKg']);
      return;
    }
    if (step === 'safety') {
      setSaving(true);
      setFailure(null);
      const result = await fit.saveProfile(draftToProfile(draft));
      setSaving(false);
      if (!result.ok) {
        setFailure(result.error === 'offline' ? t('fit.offline.body') : t('fit.setup.saveFailed'));
        return;
      }
      setGoals(result.data.goals);
    }
    const following = STEPS[index + 1];
    if (following) setStep(following);
  }

  function close() {
    setStep('body');
    setGoals(null);
    setFailure(null);
    onClose();
  }

  const chips = <T extends string | number>(
    values: readonly T[],
    selected: (value: T) => boolean,
    onPress: (value: T) => void,
    label: (value: T) => string,
  ) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {values.map((value) => (
        <Chip
          key={String(value)}
          label={label(value)}
          selected={selected(value)}
          onPress={() => onPress(value)}
        />
      ))}
    </View>
  );

  const section = (title: string, body: React.ReactNode, hint?: string) => (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label">{title}</Text>
      {body}
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t(`fit.setup.step.${step}` as TranslationKey)}
      subtitle={
        step === 'result'
          ? undefined
          : t('fit.setup.progress', { step: index + 1, total: STEPS.length - 1 })
      }
    >
      <View style={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.lg }}>
        {step === 'body' ? (
          <>
            <Input
              label={t('fit.setup.birthDate')}
              placeholder={t('fit.setup.birthDatePlaceholder')}
              value={draft.birthDate}
              onChangeText={(value) => set('birthDate', value)}
              onBlur={() => touch('birthDate')}
              keyboardType="numbers-and-punctuation"
              {...(fieldError('birthDate') ? { error: fieldError('birthDate') } : {})}
            />
            <Input
              label={t('fit.setup.height')}
              placeholder="175"
              value={draft.heightCm}
              onChangeText={(value) => set('heightCm', value)}
              onBlur={() => touch('heightCm')}
              keyboardType="numeric"
              {...(fieldError('heightCm') ? { error: fieldError('heightCm') } : {})}
            />
            <Input
              label={t('fit.setup.weight')}
              placeholder="72,5"
              value={draft.weightKg}
              onChangeText={(value) => set('weightKg', value)}
              onBlur={() => touch('weightKg')}
              keyboardType="decimal-pad"
              {...(fieldError('weightKg') ? { error: fieldError('weightKg') } : {})}
            />
            {section(
              t('fit.setup.sex'),
              <Segmented
                options={(['female', 'male', 'unspecified'] as const).map((value) => ({
                  value,
                  label: t(`fit.setup.sex.${value}`),
                }))}
                value={draft.sex}
                onChange={(value) => set('sex', value)}
                accessibilityLabel={t('fit.setup.sex')}
              />,
              t('fit.setup.sexHint'),
            )}
          </>
        ) : null}

        {step === 'everyday' ? (
          <>
            {section(
              t('fit.setup.activity'),
              chips(
                ACTIVITIES,
                (value) => draft.activity === value,
                (value) => set('activity', value),
                (value) => t(`fit.activity.${value}` as TranslationKey),
              ),
              t(`fit.activity.${draft.activity}.hint` as TranslationKey),
            )}
            {section(
              t('fit.setup.trainingDays'),
              chips(
                TRAINING_DAYS,
                (value) => draft.trainingDaysPerWeek === value,
                (value) => set('trainingDaysPerWeek', value),
                String,
              ),
              t('fit.setup.trainingDaysHint'),
            )}
          </>
        ) : null}

        {step === 'goal' ? (
          <>
            {section(
              t('fit.setup.goal'),
              <Segmented
                options={FIT_GOALS.map((value) => ({
                  value,
                  label: t(`fit.goal.${value}` as TranslationKey),
                }))}
                value={draft.goal}
                onChange={(value) => set('goal', value)}
                accessibilityLabel={t('fit.setup.goal')}
              />,
            )}
            {draft.goal !== 'maintain'
              ? section(
                  t('fit.setup.pace'),
                  <Segmented
                    options={(['gentle', 'moderate'] as const).map((value) => ({
                      value,
                      label: t(`fit.pace.${draft.goal}.${value}` as TranslationKey),
                    }))}
                    value={draft.pace}
                    onChange={(value) => set('pace', value)}
                    accessibilityLabel={t('fit.setup.pace')}
                  />,
                  t('fit.setup.paceHint'),
                )
              : null}
          </>
        ) : null}

        {step === 'food' ? (
          <>
            {section(
              t('fit.setup.diet'),
              chips(
                DIETS,
                (value) => draft.diet === value,
                (value) => set('diet', value),
                (value) => t(`fit.diet.${value}` as TranslationKey),
              ),
            )}
            {section(
              t('fit.setup.allergies'),
              chips(
                ALLERGENS,
                (value) => draft.allergies.includes(value),
                (value) => set('allergies', toggled(draft.allergies, value)),
                (value) => t(`fit.allergen.${value}` as TranslationKey),
              ),
            )}
            <Input
              label={t('fit.setup.excluded')}
              placeholder={t('fit.setup.excludedPlaceholder')}
              value={draft.excludedFoods}
              onChangeText={(value) => set('excludedFoods', value)}
            />
            {section(
              t('fit.setup.equipment'),
              chips(
                EQUIPMENT,
                (value) => draft.equipment.includes(value),
                (value) => set('equipment', toggled(draft.equipment, value)),
                (value) => t(`fit.equipment.${value}` as TranslationKey),
              ),
            )}
            {section(
              t('fit.setup.cookTime'),
              chips(
                COOK_MINUTES,
                (value) => draft.maxCookMinutes === value,
                (value) => set('maxCookMinutes', value),
                (value) => t('fit.minutes', { minutes: value }),
              ),
            )}
            {section(
              t('fit.setup.budget'),
              <Segmented
                options={(['low', 'medium', 'high'] as const).map((value) => ({
                  value,
                  label: t(`fit.budget.${value}`),
                }))}
                value={draft.budget}
                onChange={(value) => set('budget', value)}
                accessibilityLabel={t('fit.setup.budget')}
              />,
            )}
            {section(
              t('fit.setup.household'),
              chips(
                HOUSEHOLD,
                (value) => draft.householdSize === value,
                (value) => set('householdSize', value),
                String,
              ),
            )}
          </>
        ) : null}

        {step === 'safety' ? (
          <>
            <Text variant="body" tone="muted">
              {t('fit.setup.safetyIntro')}
            </Text>
            <View style={{ gap: theme.spacing.xs }}>
              {SAFETY_FLAGS.map((flag) => (
                <Pressable
                  key={flag}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: draft[flag] }}
                  aria-checked={draft[flag]}
                  accessibilityLabel={t(`fit.setup.flag.${flag}` as TranslationKey)}
                  onPress={() => set(flag, !draft[flag])}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    paddingVertical: theme.spacing.md,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Checkbox checked={draft[flag]} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {t(`fit.setup.flag.${flag}` as TranslationKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {failure ? (
              <Text variant="label" tone="danger">
                {failure}
              </Text>
            ) : null}
          </>
        ) : null}

        {step === 'result' && goals ? (
          <>
            <MacroTable
              caption={t('fit.table.perDay')}
              rows={[
                { key: 'kcal', target: goals.kcal },
                { key: 'proteinG', target: goals.proteinG },
                { key: 'carbsG', target: goals.carbsG },
                { key: 'fatG', target: goals.fatG },
              ]}
            />
            {goals.trainingDay.kcal !== goals.restDay.kcal ? (
              <Text variant="body" tone="muted">
                {t('fit.setup.dayKinds', {
                  training: goals.trainingDay.kcal,
                  rest: goals.restDay.kcal,
                })}
              </Text>
            ) : null}
            {goals.safety.mode === 'maintain_only' ? (
              <Text variant="body" tone="danger">
                {/* Bei einem gemessenen Grund steht der Grund dabei: wer eine
                    Angabe selbst angekreuzt hat, weiss warum — wer sehr tief
                    wiegt, merkt es sonst nicht. */}
                {goals.safety.reasons.includes('very_low_weight')
                  ? t('fit8.safety.lowWeight')
                  : t('fit.setup.safetyResult')}
              </Text>
            ) : null}
            <Text variant="caption" tone="muted">
              {t('fit.setup.estimate')}
            </Text>
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {step !== 'body' && step !== 'result' ? (
            <View style={{ flex: 1 }}>
              <Button
                label={t('common.back')}
                variant="secondary"
                onPress={() => setStep(STEPS[index - 1] ?? 'body')}
                fullWidth
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            {step === 'result' ? (
              <Button label={t('common.done')} icon="check" onPress={close} fullWidth />
            ) : (
              <Button
                label={step === 'safety' ? t('fit.setup.calculate') : t('fit.setup.next')}
                onPress={() => void next()}
                loading={saving}
                disabled={saving}
                fullWidth
              />
            )}
          </View>
        </View>
      </View>
    </Sheet>
  );
}
