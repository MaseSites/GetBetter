import { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import { usePlanSheet } from '@/features/plan/PlanSheet';
import { useI18n, useTranslate, type TranslationKey } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Icon, Text, usePressScale } from '@/ui';

import { cloudState, loadCloudVoices, onCloudChange, type CloudState } from './cloudVoice';
import { Voice, type SpeechVoice } from './speech';
import { useSpeechVoices } from './useSpeechVoices';
import { choosableVoices, type VoiceTier } from './voices';

/** So hoch wie eine Zeile mit zwei Zeilen Text — gross genug zum Antippen. */
const ROW_HEIGHT = 52;

const TIER_LABEL: Record<VoiceTier, TranslationKey> = {
  natural: 'assistant.voice.tier.natural',
  clear: 'assistant.voice.tier.clear',
  basic: 'assistant.voice.tier.basic',
};

const GENDER_LABEL: Readonly<Record<string, TranslationKey>> = {
  female: 'assistant.gender.female',
  male: 'assistant.gender.male',
  neutral: 'assistant.gender.neutral',
};

/** Was zu ElevenLabs dazugesagt werden muss — oder nichts, wenn alles laeuft. */
function cloudNote(cloud: CloudState): TranslationKey | null {
  if (cloud.blocked === 'plan_required') return 'assistant.cloud.planRequired';
  if (cloud.blocked === 'budget_exhausted') return 'assistant.cloud.budgetExhausted';
  if (!cloud.configured) return 'assistant.cloud.missing';
  if (cloud.problem === 'auth_failed') return 'assistant.cloud.auth_failed';
  if (cloud.problem === 'quota_exceeded') return 'assistant.cloud.quota_exceeded';
  if (cloud.problem !== null) return 'assistant.cloud.failed';
  if (cloud.voices.length === 0) return 'assistant.cloud.empty';
  return null;
}

export type VoicePickerProps = {
  /** Der gewaehlte `voiceURI`. Fehlt er, spricht die beste Stimme. */
  value?: string | undefined;
  /** Eine Stimme wurde gewaehlt. Sie wird beim Antippen gleich vorgelesen. */
  onChange: (voiceUri: string) => void;
  /**
   * Wohin „Abo ansehen“ fuehrt. Standard ist das Abo-Fenster; aus einem Blatt
   * heraus schliesst der Aufrufer erst sein Blatt.
   */
  onPlan?: () => void;
};

/**
 * Wie er klingen soll: die Stimmen, die dieser Browser fuer die Sprache des
 * Kontos kennt — die natuerlich klingenden oben, die blechernen nur, solange es
 * nicht genug bessere gibt. Ein Tipp waehlt sie und liest gleich einen Satz vor.
 *
 * Wo es nichts zu waehlen gibt (auf dem Geraet, in einem Browser ohne
 * Sprachausgabe, oder wenn es nur eine einzige Stimme gibt), steht statt einer
 * halbleeren Liste ein Satz, der das sagt.
 */
export function VoicePicker({ value, onChange, onPlan }: VoicePickerProps) {
  const t = useTranslate();
  const theme = useTheme();
  const { language } = useI18n();
  const { personal } = useApp();
  const plan = usePlanSheet();
  const showPlan = onPlan ?? plan.open;
  const voices = choosableVoices(useSpeechVoices());
  const cloud = useSyncExternalStore(onCloudChange, cloudState, cloudState);
  const [speaking, setSpeaking] = useState<string | null>(null);
  // Eine eigene Stimme fuers Probehoeren — der Assistent redet hier nicht mit.
  const [player] = useState(() => new Voice());

  useEffect(() => {
    player.setLanguage(language);
  }, [player, language]);

  // Beim Oeffnen neu fragen: ein eben eingetragener Schluessel zeigt sich sofort.
  useEffect(() => {
    void loadCloudVoices(language, true);
  }, [language]);

  // Beim Verlassen ist Ruhe: kein Satz redet auf dem naechsten Bildschirm weiter.
  useEffect(() => () => player.release(), [player]);

  const note = Platform.OS === 'web' ? cloudNote(cloud) : null;
  // „Echte Stimmen gibt es mit dem Abo.“ fuehrt direkt dorthin.
  const noteText =
    note === 'assistant.cloud.planRequired' ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t(note)} ${t('plan.see')}`}
        onPress={showPlan}
        style={({ pressed }) => [styles.note, { gap: theme.spacing.xs, opacity: pressed ? 0.6 : 1 }]}
      >
        <Text variant="caption" tone="faint">
          {t(note)}
        </Text>
        <Text variant="caption" tone="accent">
          {t('plan.see')}
        </Text>
      </Pressable>
    ) : note ? (
      <Text variant="caption" tone="faint">
        {t(note)}
      </Text>
    ) : null;

  if (voices.length < 2) {
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" tone="muted">
          {voices.length === 1
            ? t('assistant.voice.pick.onlyOne', { voice: voices[0]?.label ?? '' })
            : t(Platform.OS === 'web' ? 'assistant.voice.pick.none' : 'assistant.voice.soon')}
        </Text>
        {noteText}
      </View>
    );
  }

  // Ohne eigene Wahl spricht die oberste — also ist sie auch die gewaehlte.
  const chosen = voices.some((voice) => voice.uri === value) ? value : undefined;
  const current = chosen ?? voices[0]?.uri;

  /** Hoechstens ein Wort unter dem Namen: „Männlich“ bei ElevenLabs, „Natürlich“ im Browser. */
  function detailOf(voice: SpeechVoice): string | null {
    if (voice.provider === 'cloud') {
      const gender = voice.gender ? GENDER_LABEL[voice.gender.toLowerCase()] : undefined;
      return gender ? t(gender) : null;
    }
    return t(TIER_LABEL[voice.tier]);
  }

  function play(voice: SpeechVoice) {
    // Ohne Abo spricht die beste Stimme — waehlen gibt es mit dem Abo.
    if (!personal.canPersonalize) {
      showPlan();
      return;
    }
    onChange(voice.uri);
    setSpeaking(voice.uri);
    player.setVoice(voice.uri);
    // Ein fester Satz ohne Namen: bei ElevenLabs einmal erzeugt, danach fuer alle gratis.
    player.saySample(t('assistant.voice.sampleAnon'), () =>
      setSpeaking((now) => (now === voice.uri ? null : now)),
    );
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('assistant.voice.pick.title')}
      style={{ gap: theme.spacing.sm }}
    >
      {voices.map((voice) => (
        <VoiceRow
          key={voice.uri}
          voice={voice}
          detail={detailOf(voice)}
          selected={voice.uri === current}
          speaking={voice.uri === speaking}
          onPress={() => play(voice)}
        />
      ))}
      <Text variant="caption" tone="faint">
        {t('assistant.voice.pick.hint')}
      </Text>
      {/* Ehrlich: ohne ElevenLabs klingen die Stimmen des Browsers eher technisch. */}
      {noteText}
    </View>
  );
}

type VoiceRowProps = {
  voice: SpeechVoice;
  detail: string | null;
  selected: boolean;
  speaking: boolean;
  onPress: () => void;
};

function VoiceRow({ voice, detail, selected, speaking, onPress }: VoiceRowProps) {
  const t = useTranslate();
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={
        speaking
          ? t('assistant.voice.pick.a11y.speaking', { voice: voice.label })
          : t('assistant.voice.pick.a11y', { voice: voice.label })
      }
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.row,
          {
            backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
            borderColor: selected ? theme.colors.accentStrong : theme.colors.border,
            borderRadius: theme.radii.sm,
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <Icon
          name={speaking ? 'play' : 'mic'}
          size={theme.fontSize.md}
          color={selected ? theme.colors.accentStrong : theme.colors.textFaint}
        />
        <View style={styles.grow}>
          <Text variant="label" numberOfLines={1}>
            {voice.label}
          </Text>
          {detail ? (
            <Text variant="caption" tone="faint" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        {selected ? (
          <Icon name="check" size={theme.fontSize.md} color={theme.colors.accentStrong} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: ROW_HEIGHT, borderWidth: 1 },
  note: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  grow: { flex: 1 },
});
