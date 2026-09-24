import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { currentApp } from '@/app/identity';
import { useSpeechVoices } from '@/features/assistant/useSpeechVoices';
import { VoicePicker } from '@/features/assistant/VoicePicker';
import { PillButton } from '@/features/auth/PillButton';
import type { AvatarStyle } from '@/features/avatar/style';
import { useAvatarStyle } from '@/features/avatar/useAvatarStyle';
import { ClubAvatar } from '@/features/intro/ClubAvatar';
import { useNarration } from '@/features/intro/narration';
import { SpeechBubble } from '@/features/intro/SpeechBubble';
import { StagePanel } from '@/features/intro/StagePanel';
import { Tutorial } from '@/features/intro/Tutorial';
import { useReducedMotion } from '@/features/intro/useReducedMotion';
import { trialNeedsPlan } from '@/features/plan/entitlement';
import { usePlanSheet } from '@/features/plan/PlanSheet';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { openTrialGate } from '@/state/trialGate';
import { useTheme } from '@/theme';
import { AppIcon, Screen, Text, useSwipeSteps } from '@/ui';

import { useOnboarding } from './OnboardingContext';
import { StepHeader } from './StepHeader';
import { NameStep, PersonalizeStep } from './SetupFields';
import { canLeave, neighbourStep, setupSteps, type SetupStep } from './steps';

const AVATAR_SIZE = 76;
/** Ein neuer Schritt rueckt aus dieser Richtung nach. */
const SLIDE = 28;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Das Einrichten nach dem Registrieren, als Gespraech mit dem Avatar — im Stil
 * von Anmelden und Registrieren: oben auf hellem Grund zurueck, der Fortschritt,
 * er und seine Blase; darunter das dunkle Feld (`StagePanel`) mit dem, was man
 * eingibt, und „Weiter“ fest unten. Keine Hinweise unter den Feldern — was zu
 * sagen ist, sagt die Blase. Er sagt jeden Schritt auch
 * laut — darum waehlt man zuerst seine Stimme. Jeder Schritt laesst sich
 * wischen — nach links weiter, nach rechts zurueck — und oben zurueckgehen.
 * Zum Schluss geht es ins Tutorial oder direkt in die App.
 */
export function SetupScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const {
    account,
    personal,
    entitled,
    trial,
    endTrial,
    signOut,
    completeOnboarding,
    setAssistantName,
    setAssistantVoice,
    setAssistantAvatar,
  } = useApp();
  const plan = usePlanSheet();
  // Solange hier eingerichtet wird, darf man ohne Abo alles anprobieren.
  useEffect(() => openTrialGate(), []);
  const draft = useOnboarding();
  const voices = useSpeechVoices();
  const savedAvatar = useAvatarStyle();
  // Er verwandelt sich beim Tippen, nicht erst, wenn die Ablage geantwortet hat.
  const [avatarDraft, setAvatarDraft] = useState<AvatarStyle | null>(null);
  const avatar = avatarDraft ?? savedAvatar;
  // Ob er schon einen Vornamen hat, steht beim Betreten fest; welche Stimmen es
  // gibt, reicht der Browser erst nach — darum nur das Zweite von aussen.
  const [hadFirstName] = useState(() => Boolean(account?.firstName.trim()));
  const canPickVoice = voices.length > 1;
  // Die Stimme gibt es nur mit Abo; alles andere steht allen offen (als Anprobe).
  const liveSteps = useMemo(
    () => setupSteps(hadFirstName, canPickVoice, entitled),
    [hadFirstName, canPickVoice, entitled],
  );
  // Sobald man einmal weiter ist, stehen die Schritte fest: kaeme die Stimme
  // danach noch vorne dazu, rutschte der laufende Schritt um eins.
  const [fixedSteps, setFixedSteps] = useState<readonly SetupStep[] | null>(null);
  const steps = fixedSteps ?? liveSteps;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [touring, setTouring] = useState(false);

  const step: SetupStep = steps[index] ?? 'ready';
  const firstName = draft.firstName.trim();
  const assistant = draft.assistantName.trim();
  const canGo = canLeave(step, draft);
  const voiceUri = personal.voice;
  // Angeprobt, was es nur mit Abo gibt: dann geht es ohne nicht weiter.
  const needsPlan = step === 'personalize' && !entitled && trialNeedsPlan(trial);

  const bubble: Record<SetupStep, string> = {
    voice: t('intro.setup.voice.bubble'),
    // Kam die Stimme zuerst, ist das Konto schon begruesst.
    name:
      steps[0] === 'name' ? t('intro.setup.name.bubble') : t('intro.setup.name.bubbleAfterVoice'),
    personalize: entitled
      ? t('intro.setup.personalize.bubble')
      : t('intro.setup.personalize.bubbleTrial'),
    ready: t('intro.setup.ready.bubble', { name: firstName }),
  };

  // Waehrend des Tutorials redet er hier nicht dazwischen.
  useNarration(step, touring ? '' : bubble[step]);

  async function go(to: 1 | -1) {
    if (busy) return;
    const target = neighbourStep(steps, index, to);
    if (target === null) {
      // Ganz am Anfang heisst zurueck: doch nicht — wieder zum Intro.
      if (to === -1) void signOut();
      return;
    }
    if (to === 1 && !canGo) return;
    // Ohne Abo bleibt die Anprobe hier: erst das Abo — oder „Ohne Abo weiter“.
    if (to === 1 && needsPlan) {
      plan.open();
      return;
    }
    if (
      to === 1 &&
      step === 'personalize' &&
      entitled &&
      assistant !== (account?.assistantName ?? '')
    ) {
      setBusy(true);
      try {
        await setAssistantName(assistant);
      } finally {
        setBusy(false);
      }
    }
    if (!fixedSteps) setFixedSteps(steps);
    setDirection(to);
    setIndex(target);
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      // Danach schickt der RouteGuard in die App, und sie kommt angeflogen.
      await completeOnboarding({ firstName: draft.firstName, areas: [] });
    } finally {
      setBusy(false);
    }
  }

  function changeAvatar(next: AvatarStyle) {
    setAvatarDraft(next);
    void setAssistantAvatar(next);
  }

  function changeAssistantName(name: string) {
    draft.setAssistantName(name);
    // Ohne Abo gleich in die Anprobe — mit Abo wird beim Weiter gespeichert.
    if (!entitled) void setAssistantName(name);
  }

  /** Die Anprobe verwerfen und im Standard weiter. */
  function continueFree() {
    endTrial();
    draft.setAssistantName('');
    setAvatarDraft(null);
    if (!fixedSteps) setFixedSteps(steps);
    const target = neighbourStep(steps, index, 1);
    if (target === null) return;
    setDirection(1);
    setIndex(target);
  }

  const swipe = useSwipeSteps((to) => void go(to));

  if (touring) return <Tutorial onDone={() => void finish()} />;

  const footer =
    step === 'ready' ? (
      <View style={{ gap: theme.spacing.sm }}>
        <PillButton
          label={t('intro.setup.ready.tour')}
          variant="signal"
          onPress={() => setTouring(true)}
          disabled={busy}
        />
        <PillButton
          label={t('intro.setup.ready.explore')}
          variant="outline"
          onPress={() => void finish()}
          loading={busy}
        />
      </View>
    ) : (
      <>
        <PillButton
          label={t('common.continue')}
          variant="signal"
          onPress={() => void go(1)}
          disabled={!canGo}
          loading={busy}
        />
        {needsPlan ? (
          <PillButton label={t('intro.setup.withoutPlan')} variant="outline" onPress={continueFree} />
        ) : null}
      </>
    );

  return (
    <Screen
      scroll={false}
      padded={false}
      gap={0}
      header={
        <StepHeader current={index + 1} total={steps.length} onBack={() => void go(-1)}>
          <View
            style={[
              styles.talk,
              { gap: theme.spacing.md, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.lg },
            ]}
          >
            {/* Er kommt vom Registrieren und steht schon — bei jedem Schritt nickt er. */}
            <ClubAvatar size={AVATAR_SIZE} phase="idle" bounceKey={step} style={avatar} />
            <View style={styles.grow}>
              <SpeechBubble text={bubble[step]} tail="left" typeKey={step} />
            </View>
          </View>
        </StepHeader>
      }
    >
      {/* Kurze Schritte wie beim Anmelden: Weiter gleich unter dem Feld. */}
      <StagePanel scroll={step === 'personalize' || step === 'voice'} footer={footer}>
        {/* Nach links weiter, nach rechts zurueck; senkrecht rollt das Feld wie immer. */}
        <Animated.View style={swipe.style} {...swipe.panHandlers}>
          <StepPane key={step} direction={direction}>
            <Text variant="display">{t(`intro.setup.title.${step}`)}</Text>
            {step === 'voice' ? (
              <VoicePicker
                bare
                value={voiceUri}
                onChange={(uri) => void setAssistantVoice(uri)}
              />
            ) : null}
            {step === 'name' ? (
              <NameStep
                value={draft.firstName}
                onChange={draft.setFirstName}
                onSubmit={() => void go(1)}
              />
            ) : null}
            {step === 'personalize' ? (
              <PersonalizeStep
                assistantName={draft.assistantName}
                onAssistantName={changeAssistantName}
                avatar={avatar}
                onAvatar={changeAvatar}
                offer={entitled ? null : plan.open}
              />
            ) : null}
            {step === 'ready' ? <ReadyCard /> : null}
          </StepPane>
        </Animated.View>
      </StagePanel>
    </Screen>
  );
}

/** Zum Schluss: die App, in die es gleich geht. */
function ReadyCard() {
  const theme = useTheme();
  const app = currentApp();

  return (
    <View style={[styles.ready, { gap: theme.spacing.md, paddingVertical: theme.spacing.lg }]}>
      <AppIcon appId={app.id} size="xl" />
      <Text variant="title" align="center">
        {app.name}
      </Text>
    </View>
  );
}

/** Ein Schritt rueckt beim Erscheinen aus der Richtung nach, in die man gewischt hat. */
function StepPane({ direction, children }: { direction: 1 | -1; children: ReactNode }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced === null) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: reduced ? theme.motion.duration.exit : theme.motion.duration.sheet,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }, [enter, reduced, theme.motion]);

  const offset = reduced === false ? SLIDE * direction : 0;

  return (
    <Animated.View
      style={{
        gap: theme.spacing.lg,
        opacity: enter,
        transform: [
          { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  talk: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  ready: { alignItems: 'center' },
});
