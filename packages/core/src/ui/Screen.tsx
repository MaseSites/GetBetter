import type { ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { currentApp } from '@/app/identity';
import { useTheme } from '@/theme';

const APP_BACKDROPS = {
  getbetter: require('../assets/backgrounds/getbetter-life.png'),
  betterfamily: require('../assets/backgrounds/betterfamily-life.png'),
  bettergym: require('../assets/backgrounds/bettergym-life.png'),
  betterai: require('../assets/backgrounds/betterai-life.png'),
  bettermoney: require('../assets/backgrounds/bettermoney-life.png'),
} as const;

export type ScreenProps = {
  children: ReactNode;
  /** Kopfbereich, der beim Scrollen stehen bleibt. */
  header?: ReactNode;
  /** Fussbereich, der beim Scrollen stehen bleibt. */
  footer?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  padded = true,
  gap,
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const appId = currentApp().id;
  const backdrop = APP_BACKDROPS[appId];
  const isGetBetter = appId === 'getbetter';
  const backdropOpacity = isGetBetter
    ? theme.scheme === 'dark'
      ? 0.68
      : 0.82
    : appId === 'betterai'
      ? 0.34
      : theme.scheme === 'dark'
        ? 0.5
        : 0.46;

  const inner: StyleProp<ViewStyle> = [
    {
      // Seitenrand 20, oben und unten 16 — so stehen alle Entwuerfe.
      paddingHorizontal: padded ? theme.spacing.edge : 0,
      paddingVertical: padded ? theme.spacing.lg : 0,
      gap: gap ?? theme.spacing.lg,
    },
    contentStyle,
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.backdrop,
          styles.nonInteractive,
          { height: isGetBetter ? '72%' : appId === 'betterai' ? '62%' : '68%' },
        ]}
      >
        <Image
          source={backdrop}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={[styles.backdropImage, { opacity: backdropOpacity }]}
        />
      </View>
      {header}
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, inner]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: theme.spacing.edge,
              paddingTop: theme.spacing.lg,
              paddingBottom: theme.spacing.lg + insets.bottom,
              gap: theme.spacing.sm,
              backgroundColor: `${theme.colors.background}D9`,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  backdropImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  nonInteractive: { pointerEvents: 'none' },
  footer: {},
});
