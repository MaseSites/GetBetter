import { StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Header } from '@/ui';

import { ONBOARDING_STEP_COUNT, stepNumber, type OnboardingStep } from './OnboardingContext';

export type StepHeaderProps = {
  step: OnboardingStep;
  showBack?: boolean;
  onBack?: () => void;
};

/** Fortschrittsanzeige plus Zurueck, auf allen vier Onboarding-Schritten gleich. */
export function StepHeader({ step, showBack = true, onBack }: StepHeaderProps) {
  const theme = useTheme();
  const t = useTranslate();
  const current = stepNumber(step);

  return (
    <Header
      showBack={showBack}
      onBack={onBack}
      subtitle={t('common.step', { current, total: ONBOARDING_STEP_COUNT })}
    >
      <View style={[styles.track, { gap: theme.spacing.xs }]}>
        {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              {
                borderRadius: theme.radii.pill,
                backgroundColor: index < current ? theme.colors.accent : theme.colors.surfaceMuted,
              },
            ]}
          />
        ))}
      </View>
    </Header>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row' },
  segment: { flex: 1, height: 4 },
});
