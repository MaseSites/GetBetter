import { useState } from 'react';
import { View } from 'react-native';

import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { StepHeader } from '@/features/onboarding/StepHeader';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Input, Screen, Text } from '@/ui';

/** Der eine Schritt: wie sollen wir dich nennen? Danach geht es los. */
export default function WelcomeStep() {
  const t = useTranslate();
  const theme = useTheme();
  const { firstName, setFirstName } = useOnboarding();
  const { signOut, completeOnboarding } = useApp();
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (busy) return;
    setBusy(true);
    // Der RouteGuard schickt danach selbst in die Tabs.
    await completeOnboarding({ firstName, areas: [] });
  }

  return (
    <Screen
      header={<StepHeader step="welcome" onBack={signOut} />}
      footer={<Button label={t('onboarding.finish')} onPress={finish} loading={busy} />}
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
        onSubmitEditing={finish}
        returnKeyType="done"
      />
    </Screen>
  );
}
