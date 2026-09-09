import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/features/onboarding/OnboardingContext';
import { useTheme } from '@/theme';

export default function OnboardingLayout() {
  const theme = useTheme();
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="welcome" />
      </Stack>
    </OnboardingProvider>
  );
}
