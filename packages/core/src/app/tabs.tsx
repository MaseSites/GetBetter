import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, type Theme } from '@/theme';
import { Icon } from '@/ui';
import type { IconName } from '@/ui/Icon';

/**
 * Ein Tab in der Leiste. Wo man steht, sagt die Farbe: Tinte fuer den
 * gewaehlten, zart fuer die anderen — keine Pille, kein zweites Signal.
 */
export function tabIcon(name: IconName) {
  function TabBarIcon({ color }: { color: ColorValue; focused: boolean }) {
    return <Icon name={name} size={21} color={String(color)} />;
  }
  return TabBarIcon;
}

/**
 * Der Assistent in der Mitte — der einzige Tab mit Flaeche. Er steht quer
 * ueber allen Bereichen, dafuer darf er die Signalfarbe tragen.
 */
export function accentTabIcon(name: IconName) {
  function TabBarIcon() {
    const theme = useTheme();
    return (
      <View
        style={[
          styles.circle,
          { backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill },
        ]}
      >
        <Icon name={name} size={21} color={theme.colors.textOnAccent} />
      </View>
    );
  }
  return TabBarIcon;
}

/**
 * Der Tab mit Flaeche traegt keine Beschriftung — die Form sagt es schon.
 * Die Flaeche braucht ihren vollen Platz, sonst schneidet die Leiste sie ab.
 */
export const accentTabOptions = {
  tabBarShowLabel: false,
  tabBarLabel: () => null,
  tabBarIconStyle: { width: 46, height: 46 },
} as const;

/** Die Leiste sieht in jeder Better-App gleich aus. */
export function useTabScreenOptions(theme: Theme) {
  const insets = useSafeAreaInsets();
  // Ohne feste Hoehe schneidet die Leiste die Beschriftungen ab.
  const barHeight = 76 + insets.bottom;

  return {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.text,
    tabBarInactiveTintColor: theme.colors.textFaint,
    // Ohne diese Angabe setzt der Browser die Beschriftung neben das Symbol,
    // sobald das Fenster breit genug ist — im Artboard steht sie darunter.
    tabBarLabelPosition: 'below-icon',
    tabBarStyle: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      height: barHeight,
      paddingTop: theme.spacing.sm,
      paddingBottom: insets.bottom + theme.spacing.sm,
    },
    tabBarLabelStyle: {
      fontSize: theme.fontSize.micro,
      lineHeight: theme.lineHeight.micro,
      fontFamily: theme.fontFamily,
      fontWeight: theme.fontWeight.semibold,
      marginTop: theme.spacing.xs,
      marginBottom: 0,
    },
    tabBarIconStyle: { marginTop: 0 },
    sceneStyle: { backgroundColor: theme.colors.background },
  } as const;
}

const styles = StyleSheet.create({
  circle: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
});
