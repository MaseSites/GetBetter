import { LinearGradient } from 'expo-linear-gradient';
import { useRef, type ReactNode } from 'react';
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
import { useTheme } from '@/theme';
import {
  APP_BACKDROP_VEILS,
  VEIL_STOPS,
  resolveBackdrop,
  veilOf,
  type ResolvedBackdrop,
  type Veil,
} from '@/theme/backdrops';

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
  /** Rollt ans Ende, sobald Inhalt dazukommt — fuer Gespraeche wie den Coach. */
  followEnd?: boolean;
};

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  padded = true,
  gap,
  contentStyle,
  followEnd = false,
}: ScreenProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { personal } = useApp();
  const appId = currentApp().id;
  // Ohne Abo das Bild der App — der gewaehlte Hintergrund bleibt gespeichert.
  const backdrop = resolveBackdrop(personal.backdrop, appId);

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
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={inner}
          onContentSizeChange={
            followEnd ? () => scrollRef.current?.scrollToEnd({ animated: true }) : undefined
          }
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
      <PaperVeil veil={APP_BACKDROP_VEILS[appId][theme.scheme]} paper={theme.colors.background} />
    </View>
  );
}

/** Deckkraft als zwei Hex-Ziffern, fuer `#RRGGBBAA`. */
function alphaHex(alpha: number): string {
  return Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

/**
 * Das Papier ueber einem Bild, als Verlauf in fuenf Stufen. Wie viel es je
 * Hoehe sein muss, damit Schrift lesbar bleibt, steht in `theme/backdrops.ts`.
 */
function PaperVeil({ veil, paper }: { veil: Veil; paper: string }) {
  if (veil.every((alpha) => alpha === 0)) return null;
  const tone = (alpha: number) => `${paper}${alphaHex(alpha)}`;
  return (
    <LinearGradient
      colors={[tone(veil[0]), tone(veil[1]), tone(veil[2]), tone(veil[3]), tone(veil[4])]}
      locations={VEIL_STOPS}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** Ein gewaehlter Hintergrund fuellt den ganzen Bildschirm, mit Papier darueber. */
function ChosenBackdrop({ backdrop }: { backdrop: Exclude<ResolvedBackdrop, { kind: 'app' }> }) {
  const theme = useTheme();

  return (
    <View style={[StyleSheet.absoluteFill, styles.nonInteractive]}>
      <Image
        source={backdrop.source}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        style={styles.backdropImage}
      />
      <PaperVeil veil={veilOf(backdrop, theme.scheme)} paper={theme.colors.background} />
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
