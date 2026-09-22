import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ALLERGENS, DIETS } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Checkbox, Chip, Input, Segmented, Text, type IconName } from '@/ui';

import { ChoiceTile } from './ChoiceTile';
import { GymPicker } from './GymPicker';
import {
  AIMS,
  EVERYDAY,
  LEVELS,
  TRAINING_COUNTS,
  bodyErrors,
  type Aim,
  type BodyField,
  type QuickAnswers,
} from './onboardingPlan';

const AIM_ICON: Record<Aim, IconName> = { lose: 'flame', fit: 'heart', muscle: 'fitness' };
const EVERYDAY_ICON: Record<(typeof EVERYDAY)[number], IconName> = {
  sedentary: 'briefcase',
  light: 'navigate',
  active: 'flame',
};
export const FLAGS = ['pregnant', 'breastfeeding', 'eatingDisorder', 'medicalCondition'] as const;

/** Was jeder Schritt bekommt: die Antworten, aendern, waehlen-und-weiter, weiter. */
export type StepProps = {
  answers: QuickAnswers;
  set: (patch: Partial<QuickAnswers>) => void;
  /** Waehlen und nach einem Augenblick weiter (die Wahl bleibt kurz sichtbar). */
  pick: (patch: Partial<QuickAnswers>) => void;
  next: () => void;
  answered: boolean;
};

export function AimStep({ answers, pick, answered }: StepProps) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {AIMS.map((aim) => (
        <ChoiceTile
          key={aim}
          icon={AIM_ICON[aim]}
          title={t(`fit.quick.aim.${aim}`)}
          hint={t(`fit.quick.aim.${aim}.hint`)}
          selected={answered && answers.aim === aim}
          onPress={() => pick({ aim })}
        />
      ))}
    </View>
  );
}

export function BodyStep({ answers, set, next }: StepProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const thisYear = new Date().getFullYear();
  const [touched, setTouched] = useState<BodyField[]>([]);
  const errors = bodyErrors(answers, thisYear);
  const fieldError = (field: BodyField) =>
    touched.includes(field) && errors.includes(field)
      ? t(`fit.quick.error.${field}` as TranslationKey)
      : undefined;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {(
          [
            ['birthYear', t('fit.quick.birthYear'), '2008', 'number-pad'],
            ['heightCm', t('fit.quick.height'), '175', 'number-pad'],
            ['weightKg', t('fit.quick.weight'), '70', 'decimal-pad'],
          ] as const
        ).map(([field, label, placeholder, keyboard]) => (
          <View key={field} style={{ flex: 1 }}>
            <Input
              label={label}
              placeholder={placeholder}
              value={answers[field]}
              onChangeText={(value) => set({ [field]: value })}
              onBlur={() =>
                setTouched((current) => (current.includes(field) ? current : [...current, field]))
              }
              keyboardType={keyboard}
              {...(fieldError(field) ? { error: fieldError(field) } : {})}
            />
          </View>
        ))}
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label">{t('fit.quick.sex')}</Text>
        <Segmented
          options={(['female', 'male', 'unspecified'] as const).map((value) => ({
            value,
            label: t(`fit.setup.sex.${value}`),
          }))}
          value={answers.sex}
          onChange={(sex) => set({ sex })}
          accessibilityLabel={t('fit.quick.sex')}
        />
        <Text variant="caption" tone="muted">
          {t('fit.quick.sexHint')}
        </Text>
      </View>
      <Button
        label={t('fit.setup.next')}
        onPress={() => {
          if (errors.length > 0) setTouched(['birthYear', 'heightCm', 'weightKg']);
          else next();
        }}
        fullWidth
      />
    </View>
  );
}

export function EverydayStep({ answers, pick, answered }: StepProps) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {EVERYDAY.map((value) => (
        <ChoiceTile
          key={value}
          icon={EVERYDAY_ICON[value]}
          title={t(`fit.quick.everyday.${value}`)}
          hint={t(`fit.quick.everyday.${value}.hint`)}
          selected={answered && answers.everyday === value}
          onPress={() => pick({ everyday: value })}
        />
      ))}
    </View>
  );
}

export function TrainStep({
  answers,
  answered,
  onCount,
}: StepProps & { onCount: (count: number) => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {TRAINING_COUNTS.map((count) => (
        <ChoiceTile
          key={count}
          title={count === 0 ? t('fit.quick.train.none') : t('fit.quick.train.count', { count })}
          hint={t(`fit.quick.train.hint.${count}` as TranslationKey)}
          selected={answered && answers.trainingDays === count}
          onPress={() => onCount(count)}
        />
      ))}
    </View>
  );
}

export function WhereStep({ answers, set, next }: StepProps) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xl }}>
      <GymPicker
        gym={answers.gym}
        equipment={answers.equipment}
        onChange={({ gym, equipment }) => set({ gym, equipment })}
      />
      {answers.gym ? (
        <>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label">{t('fit.training.level')}</Text>
            <Segmented
              options={LEVELS.map((value) => ({
                value,
                label: t(`fit.training.level.${value}`),
              }))}
              value={answers.level}
              onChange={(level) => set({ level })}
              accessibilityLabel={t('fit.training.level')}
            />
          </View>
          <Button label={t('fit.setup.next')} onPress={next} fullWidth />
        </>
      ) : null}
    </View>
  );
}

export function FoodStep({ answers, set, next }: StepProps) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.sm }}>
        {DIETS.map((diet) => (
          <ChoiceTile
            key={diet}
            title={t(`fit.diet.${diet}` as TranslationKey)}
            selected={answers.diet === diet}
            onPress={() => set({ diet })}
          />
        ))}
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label">{t('fit.quick.allergies')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {ALLERGENS.map((allergen) => (
            <Chip
              key={allergen}
              label={t(`fit.allergen.${allergen}` as TranslationKey)}
              selected={answers.allergies.includes(allergen)}
              onPress={() =>
                set({
                  allergies: answers.allergies.includes(allergen)
                    ? answers.allergies.filter((entry) => entry !== allergen)
                    : [...answers.allergies, allergen],
                })
              }
            />
          ))}
        </View>
      </View>
      <Button label={t('fit.setup.next')} onPress={next} fullWidth />
    </View>
  );
}

export function CheckStep({
  answers,
  set,
  busy,
  failure,
  onFinish,
}: StepProps & { busy: boolean; failure: string | null; onFinish: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View>
        {FLAGS.map((flag) => (
          <Pressable
            key={flag}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: answers.flags[flag] }}

            aria-checked={answers.flags[flag]}
            accessibilityLabel={t(`fit.setup.flag.${flag}` as TranslationKey)}
            onPress={() => set({ flags: { ...answers.flags, [flag]: !answers.flags[flag] } })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Checkbox checked={answers.flags[flag]} />
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
      <Button
        label={
          Object.values(answers.flags).some(Boolean)
            ? t('fit.quick.makePlan')
            : t('fit.quick.noneApplies')
        }
        onPress={onFinish}
        loading={busy}
        disabled={busy}
        fullWidth
      />
    </View>
  );
}
