import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { PillButton } from '@/features/auth/PillButton';
import { SocialButton } from '@/features/auth/SocialButton';
import { ClubAvatar } from '@/features/intro/ClubAvatar';
import { SpeechBubble } from '@/features/intro/SpeechBubble';
import { useReducedMotion } from '@/features/intro/useReducedMotion';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Screen, Text, usePhoneFrame } from '@/ui';

type Provider = 'apple' | 'google';

/** Der Avatar nimmt etwa ein Fuenftel der Hoehe ein, nie weniger oder mehr als hier. */
const AVATAR_SHARE = 0.24;
const AVATAR_MIN = 112;
const AVATAR_MAX = 208;
/** Wie weit die Knoepfe von unten nachruecken, und wie versetzt sie kommen. */
const RISE = 18;
/** Fuenf Reihen: der Versatz mal die letzte plus die Dauer ergibt genau 1. */
const STAGGER = 0.1;
const RISE_SPAN = 0.6;
/** Platz fuer zwei Zeilen Frage, damit nichts springt, wenn die Blase erscheint. */
const QUESTION_LINES = 2;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Das Intro fuer alle, die nicht angemeldet sind: Der Avatar setzt sich aus
 * kleinen Stuecken zusammen, dreht sich einmal und fragt, ob man schon im
 * Better-Club ist. Danach ruecken die Knoepfe nach.
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

  const bubble = provider
    ? { text: t(`intro.start.soon.${provider}`), size: 'md' as const, key: provider }
    : { text: t('intro.start.question'), size: 'lg' as const, key: 'question' };

  return (
    <Screen
      scroll={false}
      contentStyle={styles.content}
      footer={
        <View style={[{ gap: theme.spacing.sm }, ready ? null : styles.inert]}>
          <Animated.View style={rise(0)}>
            <PillButton label={t('intro.start.signIn')} onPress={() => router.push('/sign-in')} />
          </Animated.View>
          <Animated.View style={rise(1)}>
            <PillButton
              label={t('intro.start.signUp')}
              variant="secondary"
              onPress={() => router.push('/sign-up')}
            />
          </Animated.View>
          <Animated.View
            style={[styles.or, { gap: theme.spacing.md, marginTop: theme.spacing.xs }, rise(2)]}
          >
            <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
            <Text variant="caption" tone="faint">
              {t('common.or')}
            </Text>
            <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
          </Animated.View>
          <Animated.View style={[styles.row, { gap: theme.spacing.md }, rise(3)]}>
            <SocialButton
              name={t('auth.provider.apple')}
              label={t('intro.start.apple')}
              onPress={() => setProvider('apple')}
            />
            <SocialButton
              name={t('auth.provider.google')}
              label={t('intro.start.google')}
              onPress={() => setProvider('google')}
            />
          </Animated.View>
          <Animated.View style={rise(4)}>
            <Text variant="caption" tone="faint" align="center">
              {t('auth.start.note')}
            </Text>
          </Animated.View>
        </View>
      }
    >
      <View style={[styles.stage, { gap: theme.spacing.xl }]}>
        <ClubAvatar size={avatarSize} phase="assemble" onAssembled={handleAssembled} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center' },
  stage: { alignItems: 'center' },
  say: { alignSelf: 'stretch', justifyContent: 'flex-start' },
  inert: { pointerEvents: 'none' },
  or: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'center' },
});
