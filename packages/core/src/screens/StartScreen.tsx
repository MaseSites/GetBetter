import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PillButton } from '@/features/auth/PillButton';
import { type Provider, SocialButton } from '@/features/auth/SocialButton';
import { DEFAULT_AVATAR } from '@/features/avatar/style';
import { ClubAvatar } from '@/features/intro/ClubAvatar';
import { useNarration } from '@/features/intro/narration';
import { SpeechBubble } from '@/features/intro/SpeechBubble';
import { useReducedMotion } from '@/features/intro/useReducedMotion';
import { useTranslate } from '@/i18n';
import { darkTheme, ThemeProvider, useTheme } from '@/theme';
import { Screen, Text, usePhoneFrame } from '@/ui';

/** Der Avatar nimmt etwa ein Fuenftel der Hoehe ein, nie weniger oder mehr als hier. */
const AVATAR_SHARE = 0.22;
const AVATAR_MIN = 104;
const AVATAR_MAX = 196;
/** Wie weit das Feld unten und die Reihen darin nachruecken. */
const PANEL_RISE = 48;
const RISE = 14;
/** Vier Reihen im Feld: der Versatz mal die letzte plus die Dauer ergibt genau 1. */
const ROWS = 4;
const RISE_SPAN = 0.55;
const STAGGER = (1 - RISE_SPAN) / (ROWS - 1);
/** Platz fuer zwei Zeilen Frage, damit nichts springt, wenn die Blase erscheint. */
const QUESTION_LINES = 2;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Das Intro fuer alle, die nicht angemeldet sind: Der Avatar setzt sich aus
 * kleinen Stuecken zusammen, dreht sich einmal und fragt, ob man schon im
 * Better-Club ist. Dann faehrt unten das dunkle Feld herein — immer dunkel,
 * auch im hellen Modus (`darkTheme`): **Anmelden** im Signalgruen als die eine
 * Haupthandlung, **Konto erstellen** als Umriss, darunter klein Apple und
 * Google nebeneinander.
 *
 * Apple und Google sind noch nicht eingerichtet — ein Tipp darauf sagt das
 * ehrlich, statt ins Leere zu fuehren.
 */
export function StartScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const frame = usePhoneFrame();
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [enter] = useState(() => new Animated.Value(0));

  const avatarSize = Math.round(
    Math.min(AVATAR_MAX, Math.max(AVATAR_MIN, frame.height * AVATAR_SHARE)),
  );

  function handleAssembled() {
    setReady(true);
    Animated.timing(enter, {
      toValue: 1,
      duration: theme.motion.duration.sheet * 2,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }

  const bubble = provider
    ? { text: t(`intro.start.soon.${provider}`), size: 'md' as const, key: provider }
    : { text: t('intro.start.question'), size: 'lg' as const, key: 'question' };
  // Er redet, sobald er steht — noch bevor es ein Konto gibt.
  useNarration(`start:${bubble.key}`, ready ? bubble.text : '');

  return (
    <Screen scroll={false} padded={false} gap={0} contentStyle={styles.content}>
      <View
        style={[
          styles.stage,
          { gap: theme.spacing.xl, paddingHorizontal: theme.spacing.edge },
        ]}
      >
        <ClubAvatar
          size={avatarSize}
          phase="assemble"
          style={DEFAULT_AVATAR}
          onAssembled={handleAssembled}
        />
        <View
          style={[
            styles.say,
            { minHeight: theme.lineHeight.lg * QUESTION_LINES + theme.spacing.md * 2 },
          ]}
        >
          {ready ? (
            <SpeechBubble text={bubble.text} size={bubble.size} tail="top" typeKey={bubble.key} />
          ) : null}
        </View>
      </View>
      <ThemeProvider value={darkTheme}>
        <StartPanel
          enter={enter}
          ready={ready}
          reduced={reduced === true}
          onSignIn={() => router.push('/sign-in')}
          onSignUp={() => router.push('/sign-up')}
          onProvider={setProvider}
        />
      </ThemeProvider>
    </Screen>
  );
}

type StartPanelProps = {
  enter: Animated.Value;
  ready: boolean;
  reduced: boolean;
  onSignIn: () => void;
  onSignUp: () => void;
  onProvider: (provider: Provider) => void;
};

/** Das dunkle Feld unten: faehrt als Ganzes herein, die Reihen darin versetzt. */
function StartPanel({ enter, ready, reduced, onSignIn, onSignUp, onProvider }: StartPanelProps) {
  const t = useTranslate();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  function rise(index: number) {
    const start = index * STAGGER;
    const range = { inputRange: [start, start + RISE_SPAN], extrapolate: 'clamp' as const };
    return {
      opacity: enter.interpolate({ ...range, outputRange: [0, 1] }),
      transform: [
        { translateY: enter.interpolate({ ...range, outputRange: [reduced ? 0 : RISE, 0] }) },
      ],
    };
  }

  const slide = {
    opacity: enter.interpolate({ inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 0.6],
          outputRange: [reduced ? 0 : PANEL_RISE, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  return (
    <Animated.View style={[slide, ready ? null : styles.inert]}>
      <LinearGradient
        // Oben ein Hauch Signalgruen im Dunkeln, nach unten reines Papier der Nacht.
        colors={[theme.colors.accentSoft, theme.colors.background]}
        style={[
          styles.panel,
          {
            gap: theme.spacing.md,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            paddingHorizontal: theme.spacing.edge,
            paddingTop: theme.spacing.xxl,
            paddingBottom: theme.spacing.xl + insets.bottom,
          },
        ]}
      >
        <Animated.View style={rise(0)}>
          <PillButton label={t('intro.start.signIn')} variant="signal" onPress={onSignIn} />
        </Animated.View>
        <Animated.View style={rise(1)}>
          <PillButton label={t('intro.start.signUp')} variant="outline" onPress={onSignUp} />
        </Animated.View>
        <Animated.View
          style={[styles.or, { gap: theme.spacing.md, marginTop: theme.spacing.sm }, rise(2)]}
        >
          <View style={[styles.line, { backgroundColor: theme.colors.borderStrong }]} />
          <Text variant="caption" tone="faint">
            {t('intro.start.or')}
          </Text>
          <View style={[styles.line, { backgroundColor: theme.colors.borderStrong }]} />
        </Animated.View>
        <Animated.View style={[styles.row, { gap: theme.spacing.md }, rise(3)]}>
          <SocialButton
            provider="apple"
            name={t('auth.provider.apple')}
            label={t('intro.start.apple')}
            onPress={() => onProvider('apple')}
          />
          <SocialButton
            provider="google"
            name={t('auth.provider.google')}
            label={t('intro.start.google')}
            onPress={() => onProvider('google')}
          />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  say: { alignSelf: 'stretch', justifyContent: 'flex-start' },
  inert: { pointerEvents: 'none' },
  panel: { overflow: 'hidden' },
  or: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row' },
});
