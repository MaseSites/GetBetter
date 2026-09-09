import { Tabs } from 'expo-router';

import { useTabScreenOptions, tabIcon } from '@/app/tabs';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();
  const t = useTranslate();
  const { account } = useApp();
  const screenOptions = useTabScreenOptions(theme);

  // Beim Abmelden bleiben die Tabs kurz stehen; ohne Konto wuerden sie werfen.
  if (!account) return null;

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="home"
        options={{ title: t('tabs.functions'), tabBarIcon: tabIcon('wallet') }}
      />
      <Tabs.Screen
        name="finder"
        options={{ title: t('tabs.functions'), tabBarIcon: tabIcon('grid') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('person') }}
      />
    </Tabs>
  );
}
