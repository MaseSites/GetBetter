import { Tabs } from 'expo-router';

import { accentTabIcon, accentTabOptions, tabIcon, useTabScreenOptions } from '@/app/tabs';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { createTheme, useTheme } from '@/theme';

/** Das Gespraech im Signalkreis wie der Assistent in GetBetter, daneben das Profil. */
export default function TabsLayout() {
  const theme = useTheme();
  const t = useTranslate();
  const { account, appearance } = useApp();
  const screenOptions = useTabScreenOptions(theme);

  // Beim Abmelden bleiben die Tabs kurz stehen; ohne Konto wuerden sie werfen.
  if (!account) return null;

  // Unter der dunklen Gespraechsflaeche wird auch die Leiste dunkel.
  const dark = createTheme('dark', appearance.accent, appearance.preset);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="home"
        options={{
          ...accentTabOptions,
          title: t('tabs.chat'),
          tabBarIcon: accentTabIcon('sparkles'),
          tabBarActiveTintColor: dark.colors.text,
          tabBarInactiveTintColor: dark.colors.textFaint,
          tabBarStyle: {
            ...screenOptions.tabBarStyle,
            backgroundColor: dark.colors.background,
            borderTopColor: dark.colors.background,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('person') }}
      />
    </Tabs>
  );
}
