import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { ONBOARDING_QUESTIONS } from '@/features/onboarding/questions';
import { StepHeader } from '@/features/onboarding/StepHeader';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Chip, Screen, Text } from '@/ui';

/**
 * Ein paar Fragen, aus denen die Favoriten entstehen. Ueberspringen ist
 * erlaubt — dann bekommt man die wichtigsten Apps der gewaehlten Bereiche.
 */
export default function QuestionsStep() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { answers, toggleAnswer } = useOnboarding();

  return (
    <Screen
      header={<StepHeader step="questions" />}
      footer={
        <Button
          label={answers.length === 0 ? t('common.skip') : t('common.continue')}
          onPress={() => router.push('/household-step')}
        />
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display">{t('onboarding.questions.title')}</Text>
        <Text variant="body" tone="muted">
          {t('onboarding.questions.subtitle')}
        </Text>
      </View>

      {ONBOARDING_QUESTIONS.map((question) => (
        <View key={question.id} style={{ gap: theme.spacing.sm }}>
          <Text variant="title">{t(question.titleKey)}</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {question.options.map((option) => (
              <Chip
                key={option.id}
                label={t(option.labelKey)}
                selected={answers.includes(option.id)}
                onPress={() => toggleAnswer(option.id)}
              />
            ))}
          </View>
        </View>
      ))}

      <Text variant="caption" tone="faint">
        {t('onboarding.questions.hint')}
      </Text>
    </Screen>
  );
}
