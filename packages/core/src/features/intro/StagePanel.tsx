import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/state/AppContext';
import { createTheme, ThemeProvider, useTheme } from '@/theme';

import { useReducedMotion } from './useReducedMotion';

/** Wie weit das Feld beim Oeffnen nachrueckt. */
const PANEL_RISE = 40;

const useNativeDriver = Platform.OS !== 'web';

export type StagePanelProps = {
  children: ReactNode;
  /** Die Knoepfe. Mit `scroll` stehen sie fest unten, sonst gleich nach dem Inhalt. */
  footer?: ReactNode;
  /** Der Inhalt rollt im Feld; das Feld selbst fuellt den Rest des Bildschirms. */
  scroll?: boolean;
};

/**
 * Das dunkle Feld des Intros — Anmelden, Registrieren, Einrichten: runde Ecken
 * oben, ein Hauch Signalgruen, der nach unten ins Dunkle laeuft, und immer
 * dunkel, auch im hellen Modus — in der Akzentfarbe des Kontos, vor dem
 * Anmelden also im Signalgruen. Faehrt beim Oeffnen einmal herein.
 * Der Startbildschirm zeichnet dasselbe Feld selbst, weil seine Reihen einzeln
 * nachruecken.
 */
export function StagePanel(props: StagePanelProps) {
  const { personal } = useApp();
  // Dunkel, aber in der gewaehlten Farbe — beim Einrichten sieht man sie sofort.
  const theme = useMemo(
    () => createTheme('dark', personal.accent, personal.preset),
    [personal.accent, personal.preset],
  );
  return (
    <ThemeProvider value={theme}>
      <PanelBody {...props} />
    </ThemeProvider>
  );
}

function PanelBody({ children, footer, scroll = false }: StagePanelProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: theme.motion.duration.sheet,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }, [enter, theme.motion]);

  const slide = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [reduced === true ? 0 : PANEL_RISE, 0],
        }),
      },
    ],
  };
  const inset = { paddingHorizontal: theme.spacing.edge };
  const body = { gap: theme.spacing.lg, paddingTop: theme.spacing.xxl, ...inset };

  return (
    <Animated.View style={[scroll ? styles.fill : styles.grow, slide]}>
      <LinearGradient
        colors={[theme.colors.accentSoft, theme.colors.background]}
        style={[
          scroll ? styles.fill : styles.grow,
          styles.clip,
          { borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl },
        ]}
      >
        {scroll ? (
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[body, { paddingBottom: theme.spacing.lg }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={body}>{children}</View>
        )}
        {footer ? (
          <View
            style={[
              inset,
              {
                gap: theme.spacing.sm,
                paddingTop: scroll ? theme.spacing.md : theme.spacing.xl,
                paddingBottom: theme.spacing.xl + insets.bottom,
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  clip: { overflow: 'hidden' },
});
