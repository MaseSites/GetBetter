import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/theme';
import { Icon } from '@/ui';

import { useReducedMotion } from '../intro/useReducedMotion';
import { celebrationOf, type CelebrationKind } from './celebrations';

/** So lange faehrt es durchs Bild. */
const TRAVEL_MS = 1300;
/** Und so lange faellt ein Ding hinein, versetzt nacheinander. */
const DROP_MS = 420;
const DROP_GAP_MS = 140;
const CARRIER = 56;
const ITEM = 22;
/** Wie hoch ueber dem Wagen die Dinge starten. */
const DROP_HEIGHT = 70;

type Celebrate = (kind: CelebrationKind) => void;

const CelebrateContext = createContext<Celebrate>(() => undefined);

/**
 * Kleine Feiern quer durch die Apps: wer etwas einträgt, sieht es kurz
 * vorbeifahren — der Einkaufswagen sammelt ein, was dazukommt, der Kalender
 * bekommt seinen Haken. Nur Augenschmaus: die Ebene nimmt keine Tipps an, und
 * bei reduzierter Bewegung blitzt nur das Zeichen kurz auf.
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState<{ id: number; kind: CelebrationKind } | null>(null);
  const celebrate = useMemo<Celebrate>(
    () => (kind) => setRun((current) => ({ id: (current?.id ?? 0) + 1, kind })),
    [],
  );

  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      {run ? (
        <Celebration
          key={run.id}
          kind={run.kind}
          onDone={() => setRun((current) => (current?.id === run.id ? null : current))}
        />
      ) : null}
    </CelebrateContext.Provider>
  );
}

/** `celebrate('shopping')` — einmal pro Eintrag, sonst wird es Kirmes. */
export function useCelebrate(): Celebrate {
  return useContext(CelebrateContext);
}

function Celebration({ kind, onDone }: { kind: CelebrationKind; onDone: () => void }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion() !== false;
  const { carrier, items } = celebrationOf(kind);
  // Einmal angelegt und danach nur noch bewegt — im Rendern wird nichts veraendert.
  const [drive] = useState(() => new Animated.Value(0));
  const [drops] = useState(() => items.map(() => new Animated.Value(0)));
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) {
      // Ohne Bewegung: kurz aufblitzen, mehr nicht.
      const still = Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.delay(420),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]);
      still.start(({ finished }) => {
        if (finished) onDone();
      });
      return () => still.stop();
    }

    const show = Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(TRAVEL_MS - 320),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    const travel = Animated.timing(drive, {
      toValue: 1,
      duration: TRAVEL_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    // Die Dinge fallen nacheinander, waehrend der Wagen unten durchfaehrt.
    const falling = Animated.stagger(
      DROP_GAP_MS,
      drops.map((drop) =>
        Animated.timing(drop, {
          toValue: 1,
          duration: DROP_MS,
          delay: TRAVEL_MS / 3,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    const all = Animated.parallel([show, travel, falling]);
    all.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => all.stop();
  }, [drive, drops, fade, onDone, reduced]);

  const lane = Math.round(height * 0.62);
  const travelX = drive.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARRIER * 2, width + CARRIER],
  });
  // Ein bisschen Holpern, damit es faehrt und nicht schwebt.
  const bump = drive.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -6, 0, -6, 0],
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none">
      <Animated.View
        style={[
          styles.lane,
          {
            top: lane,
            opacity: fade,
            transform: reduced
              ? [{ translateX: Math.round(width / 2 - CARRIER / 2) }]
              : [{ translateX: travelX }, { translateY: bump }],
          },
        ]}
      >
        {reduced
          ? null
          : drops.map((drop, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.item,
                  {
                    left: CARRIER / 2 - ITEM / 2 + (index - (drops.length - 1) / 2) * (ITEM - 4),
                    opacity: drop.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                    transform: [
                      {
                        translateY: drop.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-DROP_HEIGHT, -CARRIER / 3],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Icon name={items[index] ?? carrier} size={ITEM} color={theme.colors.accentStrong} />
              </Animated.View>
            ))}

        <View
          style={[
            styles.carrier,
            theme.elevation.card,
            {
              width: CARRIER,
              height: CARRIER,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.accentSoft,
              borderColor: theme.colors.accentStrong,
            },
          ]}
        >
          <Icon name={carrier} size={theme.fontSize.stat} color={theme.colors.accentStrong} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { alignItems: 'flex-start', justifyContent: 'flex-start' },
  lane: { position: 'absolute', left: 0 },
  item: { position: 'absolute' },
  carrier: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
