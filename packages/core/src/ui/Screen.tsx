import { LinearGradient } from 'expo-linear-gradient';
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

import { currentApp, type AppId } from '@/app/identity';
import { useApp } from '@/state/AppContext';
import { useTheme, type ColorScheme } from '@/theme';
import { resolveBackdrop, type ResolvedBackdrop } from '@/theme/backdrops';

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
  const { account } = useApp();
  const appId = currentApp().id;
  const backdrop = resolveBackdrop(account?.backdrop, appId);

  const inner: StyleProp<ViewStyle> = [
    {
      // Mindestens so hoch wie der Platz zwischen Kopf und Fuss, damit ein
      // leerer Zustand darin mittig stehen kann.
      flexGrow: 1,
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
      {backdrop.kind === 'app' ? (
        <AppBackdrop appId={appId} backdrop={backdrop} />
      ) : (
        <ChosenBackdrop backdrop={backdrop} />
      )}
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

/** Das Bild der App: unten angesetzt, mit eingebautem Auslauf nach oben. */
function AppBackdrop({
  appId,
  backdrop,
}: {
  appId: AppId;
  backdrop: Extract<ResolvedBackdrop, { kind: 'app' }>;
}) {
  const theme = useTheme();
  const isGetBetter = appId === 'getbetter';
  const opacity = isGetBetter
    ? theme.scheme === 'dark'
      ? 0.68
      : 0.82
    : appId === 'betterai'
      ? 0.34
      : theme.scheme === 'dark'
        ? 0.5
        : 0.46;

  return (
    <View
      style={[
        styles.appBackdrop,
        styles.nonInteractive,
        { height: isGetBetter ? '72%' : appId === 'betterai' ? '62%' : '68%' },
      ]}
    >
      <Image
        source={backdrop.source}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        style={[styles.backdropImage, { opacity }]}
      />
    </View>
  );
}

/**
 * Wie viel Papier ueber einem gewaehlten Bild liegt: oben, in der Mitte und
 * unten. Oben am meisten — dort stehen Titel und Abschnittsnamen direkt auf dem
 * Bild; unten tragen Karten und Leiste die Schrift ohnehin.
 *
 * - Passt das Bild zum Modus (helles Bild im hellen Modus), bleibt viel davon.
 * - Passt es nicht, deckt das Papier fast zu — sonst stuende dunkle Schrift auf
 *   dunklem Grund.
 * - Eigene Bilder kennt die App nicht; sie bekommen immer mehr Papier.
 */
const VEILS = {
  match: [0.8, 0.5, 0.22],
  mismatch: [0.9, 0.82, 0.74],
  upload: [0.86, 0.66, 0.42],
} as const;

const VEIL_STOPS = [0, 0.45, 1] as const;

function veilOf(
  backdrop: Exclude<ResolvedBackdrop, { kind: 'app' }>,
  scheme: ColorScheme,
): readonly [number, number, number] {
  if (backdrop.kind === 'upload') return VEILS.upload;
  return backdrop.tone === scheme ? VEILS.match : VEILS.mismatch;
}

/** Deckkraft als zwei Hex-Ziffern, fuer `#RRGGBBAA`. */
function alphaHex(alpha: number): string {
  return Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

/** Ein gewaehlter Hintergrund fuellt den ganzen Bildschirm, mit Papier darueber. */
function ChosenBackdrop({ backdrop }: { backdrop: Exclude<ResolvedBackdrop, { kind: 'app' }> }) {
  const theme = useTheme();
  const paper = theme.colors.background;
  const [top, middle, bottom] = veilOf(backdrop, theme.scheme);

  return (
    <View style={[StyleSheet.absoluteFill, styles.nonInteractive]}>
      <Image
        source={backdrop.source}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        style={styles.backdropImage}
      />
      <LinearGradient
        colors={[
          `${paper}${alphaHex(top)}`,
          `${paper}${alphaHex(middle)}`,
          `${paper}${alphaHex(bottom)}`,
        ]}
        locations={VEIL_STOPS}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  appBackdrop: {
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
