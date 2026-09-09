import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Loading, PhoneFrame } from '@/ui';

/**
 * P-006: Ein Schalter im Mock-Zustand entscheidet, welcher Bereich gezeigt wird —
 * Auth-Stack, Onboarding oder die Tabs.
 */
function RouteGuard() {
  const { account, hydrated } = useApp();
  const segments = useSegments();
  const router = useRouter();

  const group = segments[0];

  useEffect(() => {
    if (!hydrated) return;

    const inAuth = group === '(auth)';
    const inOnboarding = group === '(onboarding)';

    if (!account) {
      if (!inAuth) router.replace('/start');
      return;
    }

    if (!account.onboarded) {
      if (!inOnboarding) router.replace('/welcome');
      return;
    }

    if (inAuth || inOnboarding) router.replace('/today');
  }, [hydrated, account, group, router]);

  return null;
}

function Shell() {
  const theme = useTheme();
  const { hydrated } = useApp();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center' }}>
        <Loading />
      </View>
    );
  }

  return (
    <>
      <RouteGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="module/[id]" />
        <Stack.Screen name="run/[id]" />
        <Stack.Screen name="manage-household" />
        <Stack.Screen name="ui-kit" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <PhoneFrame>
          <Shell />
        </PhoneFrame>
      </AppProvider>
    </SafeAreaProvider>
  );
}
