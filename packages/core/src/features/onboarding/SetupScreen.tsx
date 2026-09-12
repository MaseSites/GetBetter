import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { currentApp } from '@/app/identity';
import { ClubAvatar } from '@/features/intro/ClubAvatar';
import { SpeechBubble } from '@/features/intro/SpeechBubble';
import { Tutorial } from '@/features/intro/Tutorial';
import { useReducedMotion } from '@/features/intro/useReducedMotion';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { AppIcon, Button, Input, Screen, Text, useSwipeSteps } from '@/ui';

import { useOnboarding } from './OnboardingContext';
import { StepHeader } from './StepHeader';
import { canLeave, neighbourStep, setupSteps, type SetupStep } from './steps';
import { StylePicker } from './StylePicker';

const AVATAR_SIZE = 76;
/** Ein neuer Schritt rueckt aus dieser Richtung nach. */
const SLIDE = 28;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Das Einrichten nach dem Registrieren, als Gespraech mit dem Avatar: oben er
 * und seine Blase, darunter, was man dazu eingibt. Jeder Schritt laesst sich
 * wischen — nach links weiter, nach rechts zurueck — und oben zurueckgehen.
 * Zum Schluss geht es ins Tutorial oder direkt in die App.
 */
export function SetupScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const { account, signOut, completeOnboarding, setAssistantName } = useApp();
  const draft = useOnboarding();
  const [steps] = useState(() => setupSteps(Boolean(account?.firstName.trim())));
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [touring, setTouring] = useState(false);

  const step: SetupStep = steps[index] ?? 'ready';
  const firstName = draft.firstName.trim();
  const assistant = draft.assistantName.trim();
  const canGo = canLeave(step, draft);

  async function go(to: 1 | -1) {
    if (busy) return;
    const target = neighbourStep(steps, index, to);
    if (target === null) {
      // Ganz am Anfang heisst zurueck: doch nicht — wieder zum Intro.
      if (to === -1) void signOut();
      return;
    }
    if (to === 1 && !canGo) return;
    if (to === 1 && step === 'assistant' && assistant !== (account?.assistantName ?? '')) {
      setBusy(true);
      try {
        await setAssistantName(assistant);
      } finally {
        setBusy(false);
      }
    }
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

  const swipe = useSwipeSteps((to) => void go(to));

  if (touring) return <Tutorial onDone={() => void finish()} />;

  const bubble: Record<SetupStep, string> = {
    name: t('intro.setup.name.bubble'),
    assistant: assistant
      ? t('intro.setup.assistant.bubbleNamed', { name: firstName, assistant })
      : t('intro.setup.assistant.bubble', { name: firstName }),
    style: t('intro.setup.style.bubble', { assistant }),
    ready: t('intro.setup.ready.bubble', { name: firstName }),
  };

  const footer =
    step === 'ready' ? (
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={t('intro.setup.ready.tour')}
          onPress={() => setTouring(true)}
          disabled={busy}
        />
        <Button
          label={t('intro.setup.ready.explore')}
          variant="secondary"
          onPress={() => void finish()}
          loading={busy}
        />
      </View>
    ) : (
      <Button
        label={t('common.continue')}
        onPress={() => void go(1)}
        disabled={!canGo}
        loading={busy}
      />
    );

  return (
    <Screen
      header={
        <StepHeader current={index + 1} total={steps.length} onBack={() => void go(-1)}>
          <View style={[styles.talk, { gap: theme.spacing.md, paddingTop: theme.spacing.sm }]}>
            {/* Er kommt vom Registrieren und steht schon — bei jedem Schritt nickt er. */}
            <ClubAvatar size={AVATAR_SIZE} phase="idle" bounceKey={step} />
            <View style={styles.grow}>
              <SpeechBubble text={bubble[step]} tail="left" typeKey={step} />
            </View>
          </View>
        </StepHeader>
      }
      footer={footer}
    >
      {/* Nach links weiter, nach rechts zurueck; senkrecht rollt die Seite wie immer. */}
      <Animated.View style={[styles.grow, swipe.style]} {...swipe.panHandlers}>
        <StepPane key={step} direction={direction}>
          {step === 'name' ? (
            <Input
              label={t('intro.setup.name.label')}
              hint={t('intro.setup.name.hint')}
              value={draft.firstName}
              onChangeText={draft.setFirstName}
              icon="person"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => void go(1)}
            />
          ) : null}
          {step === 'assistant' ? (
            <Input
              label={t('intro.setup.assistant.label')}
              hint={t('intro.setup.assistant.hint')}
              value={draft.assistantName}
              onChangeText={draft.setAssistantName}
              icon="sparkles"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => void go(1)}
            />
          ) : null}
          {step === 'style' ? <StylePicker /> : null}
          {step === 'ready' ? <ReadyCard /> : null}
        </StepPane>
      </Animated.View>
    </Screen>
  );
}

/** Zum Schluss: die App, in die es gleich geht. */
function ReadyCard() {
  const t = useTranslate();
  const theme = useTheme();
  const app = currentApp();

  return (
    <View style={[styles.ready, { gap: theme.spacing.md, paddingVertical: theme.spacing.xl }]}>
      <AppIcon appId={app.id} size="xl" />
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="title" align="center">
          {app.name}
        </Text>
        <Text variant="label" tone="muted" align="center">
          {t(app.taglineKey as TranslationKey)}
        </Text>
      </View>
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
