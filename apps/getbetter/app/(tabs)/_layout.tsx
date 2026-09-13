import { Tabs } from 'expo-router';

import { tabIcon, useTabScreenOptions } from '@/app/tabs';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';

/** Heute, Bereiche, Assistent, Suche, Profil — in dieser Reihenfolge wie im Entwurf. */
export default function TabsLayout() {
  const theme = useTheme();
  const t = useTranslate();
  const screenOptions = useTabScreenOptions(theme);
  const { account } = useApp();

  // Beim Abmelden bleiben die Tabs kurz stehen; ohne Konto wuerden sie werfen.
  if (!account) return null;

  // Die Leiste folgt ueberall dem Aussehen des Kontos, auch unter dem Assistenten.
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
        options={{ title: t('tabs.assistant'), tabBarIcon: tabIcon('sparkles') }}
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
