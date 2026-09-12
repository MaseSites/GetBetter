import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { currentApp } from '@/app/identity';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme, type Theme } from '@/theme';
import { Button, Sheet, usePhoneFrame } from '@/ui';

import { ClubAvatar, type AvatarPhase } from './ClubAvatar';
import { SpeechBubble } from './SpeechBubble';
import { Tutorial } from './Tutorial';
import { useReducedMotion } from './useReducedMotion';

export type IntroLayerProps = {
  children: ReactNode;
  /** Mit Einrichten fragt die Einrichtung selbst; hier kommt danach nur noch die App angeflogen. */
  hasOnboarding: boolean;
};

/** So lange steht der Avatar still, bevor er sich wegdreht. */
const BEAT_MS = 360;
/** Die App fliegt schon an, waehrend er sich noch dreht. */
const LEAD_MS = 160;
const FLY_MS = 560;
const CURTAIN_MS = 320;
/** Von so weit unten und so klein kommt die App. */
const FLY_RISE = 64;
const FLY_SCALE = 0.9;
const CURTAIN_AVATAR_SHARE = 0.2;
const ASK_AVATAR = 72;
const TOUR_RISE = 24;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Die Ankunft nach dem Einloggen: ein Vorhang mit dem Avatar, der sich
 * wegdreht, waehrend die App von unten anfliegt. Jede Ankunft bekommt ihre
 * eigenen Werte — so beginnt der Vorhang immer deckend, ohne Aufblitzen.
 */
class Arrival {
  readonly curtain = new Animated.Value(1);
  readonly fly = new Animated.Value(0);
  private onLanded: () => void = () => undefined;

  constructor(private readonly motion: Theme['motion']) {}

  setOnLanded(onLanded: () => void) {
    this.onLanded = onLanded;
  }

  land(reduced: boolean) {
    if (reduced) {
      this.fly.setValue(1);
      Animated.timing(this.curtain, {
        toValue: 0,
        duration: this.motion.duration.exit,
        easing: this.motion.easing.out,
        useNativeDriver,
      }).start(() => this.onLanded());
      return;
    }
    Animated.sequence([
      Animated.delay(LEAD_MS),
      Animated.parallel([
        Animated.timing(this.curtain, {
          toValue: 0,
          duration: CURTAIN_MS,
          easing: this.motion.easing.out,
          useNativeDriver,
        }),
        Animated.timing(this.fly, {
          toValue: 1,
          duration: FLY_MS,
          easing: this.motion.easing.out,
          useNativeDriver,
        }),
      ]),
    ]).start(() => this.onLanded());
  }
}

type Flow =
  | { kind: 'none' }
  | { kind: 'arrive'; ask: boolean; arrival: Arrival }
  | { kind: 'ask' }
  | { kind: 'tour' };

/**
 * Liegt ueber dem ganzen App-Stapel. Unterscheidet echtes Einloggen von der
 * Wiederherstellung beim Start: nur wenn nach dem Laden ein Konto dazukommt
 * (oder die Einrichtung eben fertig wurde), dreht sich der Avatar weg und die
 * App kommt angeflogen. Ein Neustart zeigt nichts davon.
 */
export function IntroLayer({ children, hasOnboarding }: IntroLayerProps) {
  const theme = useTheme();
  const { account } = useApp();
  const accountId = account?.id ?? null;
  const settled = account !== null && (!hasOnboarding || account.onboarded);

  const [seen, setSeen] = useState({ id: accountId, settled });
  const [flow, setFlow] = useState<Flow>({ kind: 'none' });

  if (seen.id !== accountId || seen.settled !== settled) {
    setSeen({ id: accountId, settled });
    if (accountId === null) {
      setFlow({ kind: 'none' });
    } else if (settled) {
      // Neu angemeldet fragt er nach; nach dem Einrichten hat er das schon getan.
      setFlow({ kind: 'arrive', ask: seen.id !== accountId, arrival: new Arrival(theme.motion) });
    }
  }

  const arrival = flow.kind === 'arrive' ? flow.arrival : null;
  const appStyle = arrival
    ? {
        opacity: arrival.fly.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        transform: [
          {
            translateY: arrival.fly.interpolate({ inputRange: [0, 1], outputRange: [FLY_RISE, 0] }),
          },
          { scale: arrival.fly.interpolate({ inputRange: [0, 1], outputRange: [FLY_SCALE, 1] }) },
        ],
      }
    : null;

  return (
    <View style={styles.fill}>
      <Animated.View style={[styles.fill, appStyle]}>{children}</Animated.View>
      {flow.kind === 'arrive' ? (
        <Curtain
          arrival={flow.arrival}
          onLanded={() => setFlow(flow.ask ? { kind: 'ask' } : { kind: 'none' })}
        />
      ) : null}
      <AskSheet
        visible={flow.kind === 'ask'}
        onKnown={() => setFlow({ kind: 'none' })}
        onTour={() => setFlow({ kind: 'tour' })}
      />
      {flow.kind === 'tour' ? <TourOverlay onDone={() => setFlow({ kind: 'none' })} /> : null}
    </View>
  );
}

function Curtain({ arrival, onLanded }: { arrival: Arrival; onLanded: () => void }) {
  const theme = useTheme();
  const frame = usePhoneFrame();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<AvatarPhase>('idle');

  useEffect(() => {
    arrival.setOnLanded(onLanded);
    // Wer sich waehrend der Ankunft abmeldet, bekommt danach keine Frage mehr.
    return () => arrival.setOnLanded(() => undefined);
  }, [arrival, onLanded]);

  useEffect(() => {
    if (reduced === null) return;
    const timer = setTimeout(() => {
      setPhase('turnAway');
      arrival.land(reduced);
    }, BEAT_MS);
    return () => clearTimeout(timer);
  }, [arrival, reduced]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: theme.colors.background, opacity: arrival.curtain },
      ]}
    >
      <ClubAvatar size={Math.round(frame.height * CURTAIN_AVATAR_SHARE)} phase={phase} />
    </Animated.View>
  );
}

function AskSheet({
  visible,
  onKnown,
  onTour,
}: {
  visible: boolean;
  onKnown: () => void;
  onTour: () => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const { account } = useApp();
  const app = currentApp().name;
  const name = account?.firstName.trim() ?? '';
  const question = name
    ? t('intro.arrive.questionNamed', { name, app })
    : t('intro.arrive.question', { app });

  return (
    <Sheet visible={visible} onClose={onKnown}>
      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xs }}>
        <View style={[styles.row, { gap: theme.spacing.md }]}>
          <ClubAvatar size={ASK_AVATAR} phase="assemble" />
          <View style={styles.fill}>
            <SpeechBubble text={question} tail="left" />
          </View>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t('intro.arrive.yes')} onPress={onKnown} />
          <Button label={t('intro.arrive.no')} variant="secondary" onPress={onTour} />
        </View>
      </View>
    </Sheet>
  );
}

function TourOverlay({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
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

  function close() {
    Animated.timing(enter, {
      toValue: 0,
      duration: theme.motion.duration.exit,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start(() => onDone());
  }

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [reduced === false ? TOUR_RISE : 0, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Tutorial onDone={close} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
