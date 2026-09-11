import { Tabs } from 'expo-router';

import { accentTabIcon, accentTabOptions, tabIcon, useTabScreenOptions } from '@/app/tabs';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { createTheme, useTheme } from '@/theme';

/** Heute, Bereiche, Assistent, Suche, Profil — in dieser Reihenfolge wie im Entwurf. */
export default function TabsLayout() {
  const theme = useTheme();
  const t = useTranslate();
  const screenOptions = useTabScreenOptions(theme);
  const { account, appearance } = useApp();

  // Beim Abmelden bleiben die Tabs kurz stehen; ohne Konto wuerden sie werfen.
  if (!account) return null;

  // Im Assistenten wird auch die Leiste dunkel — sonst stuende ein heller
  // Balken unter der dunklen Flaeche.
  const dark = createTheme('dark', appearance.accent, appearance.preset);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="today"
        options={{ title: t('tabs.today'), tabBarIcon: tabIcon('lines') }}
      />
      <Tabs.Screen
        name="modules"
        options={{ title: t('tabs.finder'), tabBarIcon: tabIcon('grid') }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          ...accentTabOptions,
          title: t('tabs.assistant'),
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
        name="search"
        options={{ title: t('tabs.search'), tabBarIcon: tabIcon('search') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('person') }}
      />
    </Tabs>
  );
}
