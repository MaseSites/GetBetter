import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon } from '@/ui';
import type { IconName } from '@/ui/Icon';

function tabIcon(name: IconName) {
  function TabBarIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={22} color={String(color)} />;
  }
  return TabBarIcon;
}

/** Der Assistent sitzt in der Mitte und ist bewusst hervorgehoben. */
function AssistantTabIcon({ focused }: { focused: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.assistantIcon,
        {
          borderRadius: theme.radii.pill,
          backgroundColor: focused ? theme.colors.accentStrong : theme.colors.accent,
        },
      ]}
    >
      <Icon name="sparkles" size={24} color={theme.colors.textOnAccent} />
    </View>
  );
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
        options={{
          title: t('tabs.assistant'),
          tabBarIcon: AssistantTabIcon,
          tabBarAccessibilityLabel: t('tabs.assistant'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('person') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  assistantIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
