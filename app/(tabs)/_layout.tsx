import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon } from '@/ui';
import type { IconName } from '@/ui/Icon';

/**
 * Der gewaehlte Tab bekommt eine gefuellte Pille hinter dem Icon —
 * Farbe allein war zu leise, um zu zeigen, wo man steht.
 */
function tabIcon(name: IconName) {
  function TabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    const theme = useTheme();
    return (
      <View
        style={[
          styles.iconPill,
          {
            borderRadius: theme.radii.pill,
            backgroundColor: focused ? theme.colors.accentSoft : 'transparent',
          },
        ]}
      >
        <Icon name={name} size={22} color={String(color)} />
      </View>
    );
  }
  return TabBarIcon;
}

export default function TabsLayout() {
  const theme = useTheme();
  const t = useTranslate();
  const insets = useSafeAreaInsets();

  // Ohne feste Hoehe schneidet die Leiste die Beschriftungen ab.
  const barHeight = 64 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: barHeight,
          paddingTop: theme.spacing.xs,
          paddingBottom: insets.bottom + theme.spacing.xs,
        },
        tabBarLabelStyle: {
          fontSize: theme.fontSize.xs,
          fontFamily: theme.fontFamily,
          marginTop: 2,
        },
        tabBarIconStyle: { marginTop: 2 },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="today" options={{ title: t('tabs.today'), tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen
        name="modules"
        options={{ title: t('tabs.modules'), tabBarIcon: tabIcon('grid') }}
      />
      <Tabs.Screen
        name="assistant"
        options={{ title: t('tabs.assistant'), tabBarIcon: tabIcon('sparkles') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('person') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 56,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
