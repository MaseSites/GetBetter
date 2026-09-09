import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Loading, PhoneFrame } from '@/ui';

export type RootShellProps = {
  /** Wohin es nach der Anmeldung geht. */
  home: string;
  /** Nur GetBetter fragt beim ersten Start nach; die anderen legen gleich los. */
  hasOnboarding?: boolean;
};

/** Schickt in den Auth-Stack, ins Onboarding oder in die Tabs. */
function RouteGuard({ home, hasOnboarding }: Required<RootShellProps>) {
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

    if (hasOnboarding && !account.onboarded) {
      if (!inOnboarding) router.replace('/welcome');
      return;
    }

    if (inAuth || inOnboarding) router.replace(home);
  }, [hydrated, account, group, router, home, hasOnboarding]);

  return null;
}

function Shell({ home, hasOnboarding }: Required<RootShellProps>) {
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
      <RouteGuard home={home} hasOnboarding={hasOnboarding} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

/**
 * Die Huelle, die jede Better-App gleich braucht: Sitzung, Theme, Telefonrahmen
 * und die Weiche zwischen Anmelden, Einrichten und der App selbst.
 */
export function RootShell({ home, hasOnboarding = false }: RootShellProps) {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="auto" />
        <PhoneFrame>
          <Shell home={home} hasOnboarding={hasOnboarding} />
        </PhoneFrame>
      </AppProvider>
    </SafeAreaProvider>
  );
}
