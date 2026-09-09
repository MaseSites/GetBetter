import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, type Theme } from '@/theme';
import { Icon } from '@/ui';
import type { IconName } from '@/ui/Icon';

/**
 * Der gewaehlte Tab bekommt eine gefuellte Pille hinter dem Icon —
 * Farbe allein war zu leise, um zu zeigen, wo man steht.
 */
export function tabIcon(name: IconName) {
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

/** Die Leiste sieht in jeder Better-App gleich aus. */
export function useTabScreenOptions(theme: Theme) {
  const insets = useSafeAreaInsets();
  // Ohne feste Hoehe schneidet die Leiste die Beschriftungen ab.
  const barHeight = 72 + insets.bottom;

  return {
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
      lineHeight: 14,
      fontFamily: theme.fontFamily,
      marginTop: 2,
      marginBottom: 0,
    },
    tabBarIconStyle: { marginTop: 0 },
    sceneStyle: { backgroundColor: theme.colors.background },
  } as const;
}

const styles = StyleSheet.create({
  iconPill: {
    width: 52,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
