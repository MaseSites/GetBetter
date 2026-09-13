import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTranslate, type Translate, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text, usePressScale, type IconName } from '@/ui';

import { useReducedMotion } from '../intro/useReducedMotion';
import type { SpeechProblem } from './speech';
import type { Voicing } from './useVoice';

/** Ein Atemzug: so lange braucht der Ring einmal von innen nach aussen. */
const PULSE_MS = 1400;
/** Wie weit er dabei hinauswaechst. Genug, um es zu sehen, wenig genug, um ruhig zu bleiben. */
const PULSE_SPREAD = 1.3;
/** So hoch wie ein Chip, damit die Zeile unter dem Feld nicht drueckt. */
const BUTTON_HEIGHT = 44;

export type VoiceControlsProps = {
  voicing: Voicing;
  /** Sein Name, wenn er einen hat — dann spricht er von sich selbst. */
  name?: string | undefined;
  /** Solange er nachdenkt, ruht das Mikrofon. */
  busy?: boolean | undefined;
};

/**
 * Die zwei Knoepfe unter dem Feld: eine Sprachnachricht — und ein Gespraech,
 * in dem man redet und er antwortet, ohne jedes Mal zu tippen.
 *
 * Im Browser arbeiten beide wirklich. Auf dem Geraet gaebe es dafuer noch kein
 * Paket; ein Tipp sagt das dann in einem Satz, statt still nichts zu tun.
 */
export function VoiceControls({ voicing, name = '', busy = false }: VoiceControlsProps) {
  const t = useTranslate();
  const theme = useTheme();
  const listening = voicing.phase === 'listening';
  const speaking = voicing.phase === 'speaking';

  const note = noteOf(voicing, name, t);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {/* Eine Meldung darf die Vorlesefunktion nicht verpassen. */}
      <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: theme.spacing.sm }}>
        {note ? (
          <Text variant="label" tone={voicing.problem === null ? 'muted' : 'danger'}>
            {note}
          </Text>
        ) : null}
      </View>

      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <VoiceButton
          icon={voicing.mode === 'speak' ? 'check' : 'mic'}
          label={t(
            voicing.mode === 'speak' ? 'assistant.voice.speak.done' : 'assistant.voice.speak',
          )}
          spoken={t(
            voicing.mode === 'speak'
              ? 'assistant.voice.speak.a11y.busy'
              : 'assistant.voice.speak.a11y',
          )}
          active={voicing.mode === 'speak'}
          pulsing={voicing.mode === 'speak' && listening}
          disabled={busy || voicing.mode === 'talk'}
          onPress={voicing.dictate}
        />
        <VoiceButton
          icon={voicing.mode === 'talk' ? 'close' : 'repeat'}
          label={t(voicing.mode === 'talk' ? 'assistant.voice.talk.end' : 'assistant.voice.talk')}
          spoken={t(
            voicing.mode === 'talk'
              ? 'assistant.voice.talk.a11y.busy'
              : 'assistant.voice.talk.a11y',
          )}
          active={voicing.mode === 'talk'}
          pulsing={voicing.mode === 'talk' && (listening || speaking)}
          disabled={voicing.mode === 'speak'}
          onPress={voicing.talk}
        />
      </View>
    </View>
  );
}

/**
 * Was schiefging, in einem Satz. `unavailable` haengt davon ab, wo man steht,
 * und wird darum erst in `noteOf` entschieden.
 */
const PROBLEM_KEY: Record<Exclude<SpeechProblem, 'unavailable'>, TranslationKey> = {
  denied: 'assistant.voice.problem.denied',
  noDevice: 'assistant.voice.problem.noDevice',
  unheard: 'assistant.voice.problem.unheard',
  failed: 'assistant.voice.problem.failed',
};

/** Der Satz ueber den Knoepfen — was gerade laeuft, oder warum nicht. */
function noteOf(voicing: Voicing, name: string, t: Translate): string | null {
  if (voicing.problem !== null) {
    // Im Browser fehlt die Erkennung, auf dem Geraet das Paket — zwei Saetze.
    if (voicing.problem === 'unavailable') {
      return t(Platform.OS === 'web' ? 'assistant.voice.noBrowser' : 'assistant.voice.soon');
    }
    return t(PROBLEM_KEY[voicing.problem]);
  }
  if (voicing.phase === 'listening') {
    // Was er schon verstanden hat, sagt mehr als jede Beschriftung.
    if (voicing.heard.length > 0) return voicing.heard;
    return name ? t('assistant.voice.listeningNamed', { name }) : t('assistant.voice.listening');
  }
  if (voicing.phase === 'speaking') {
    return name ? t('assistant.voice.speakingNamed', { name }) : t('assistant.voice.speaking');
  }
  return null;
}

type VoiceButtonProps = {
  icon: IconName;
  label: string;
  /** Was die Vorlesefunktion sagt — sie nennt auch den Zustand. */
  spoken: string;
  active: boolean;
  pulsing: boolean;
  disabled: boolean;
  onPress: () => void;
};

function VoiceButton({
  icon,
  label,
  spoken,
  active,
  pulsing,
  disabled,
  onPress,
}: VoiceButtonProps) {
  const theme = useTheme();
  const press = usePressScale();
  const still = useReducedMotion() !== false;
  const pulse = usePulse(pulsing && !still);

  const background = active ? theme.colors.accent : theme.colors.surface;
  const foreground = active ? theme.colors.textOnAccent : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.slot}
    >
      {pulsing && !still ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.accentSoft,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [
                {
                  scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, PULSE_SPREAD] }),
                },
              ],
            },
          ]}
        />
      ) : null}

      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: background,
            // Ohne Bewegung traegt der Ring allein, dass er zuhoert.
            borderColor: pulsing && still ? theme.colors.accentStrong : theme.colors.border,
            borderRadius: theme.radii.pill,
            gap: theme.spacing.sm,
            opacity: disabled ? 0.4 : 1,
            paddingHorizontal: theme.spacing.lg,
            transform: [{ scale: disabled ? 1 : press.scale }],
          },
        ]}
      >
        <Icon name={icon} size={theme.fontSize.md} color={foreground} />
        <Text variant="label" tone={active ? 'onAccent' : 'default'} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Der Ring, der zeigt, dass wirklich zugehoert wird. Steht still, wenn weniger Bewegung gewuenscht ist. */
function usePulse(running: boolean) {
  const theme = useTheme();
  // Kein `useRef`: der Wert wird beim Rendern gelesen, dafuer ist `useState` da.
  const [value] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!running) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: PULSE_MS,
        easing: theme.motion.easing.out,
        // Im Browser gibt es kein natives Animated-Modul.
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      value.setValue(0);
    };
  }, [running, value, theme.motion.easing.out]);

  return value;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  slot: { flex: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: BUTTON_HEIGHT,
    borderWidth: 1,
  },
});
