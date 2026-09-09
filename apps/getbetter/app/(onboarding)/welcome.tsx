import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { StepHeader } from '@/features/onboarding/StepHeader';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Input, Screen, Text } from '@/ui';

export default function WelcomeStep() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { firstName, setFirstName } = useOnboarding();
  const { signOut } = useApp();

  function goNext() {
    router.push('/areas');
  }

  return (
    <Screen
      header={<StepHeader step="welcome" onBack={signOut} />}
      footer={<Button label={t('common.continue')} onPress={goNext} />}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display">{t('onboarding.name.title')}</Text>
        <Text variant="body" tone="muted">
          {t('onboarding.name.subtitle')}
        </Text>
      </View>

      <Input
        label={t('onboarding.name.label')}
        placeholder={t('onboarding.name.placeholder')}
        value={firstName}
        onChangeText={setFirstName}
        icon="person"
        autoCapitalize="words"
        onSubmitEditing={goNext}
        returnKeyType="next"
      />
    </Screen>
  );
}
