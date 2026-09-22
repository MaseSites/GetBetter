import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { NotificationRow } from '@/db';

import { NotificationItem } from './NotificationItem';
import { STACK_CARD_HEIGHT, STACK_STEP, frontAt, stackFrames, stackHeight } from './stack';

const useNativeDriver = Platform.OS !== 'web';
/** So lange muss das Rollen im Browser ruhen, bevor der Stapel einrastet. */
const SETTLE_MS = 120;

/**
 * Rollposition, Einrasten im Browser und welche Karte vorn liegt — ausserhalb
 * von React, damit beim Rollen nichts gerendert wird. Nur wenn eine andere
 * Karte nach vorn kommt, meldet es `onFront`. Entsteht einmal per
 * `useState(() => new …)`.
 */
class StackMotion {
  readonly scrollY = new Animated.Value(0);
  private findView: () => ScrollView | null = () => null;
  private onFront: (index: number) => void = () => undefined;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private count = 0;
  private front = 0;

  readonly onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: this.scrollY } } }], {
    useNativeDriver,
    listener: (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      this.moved(event.nativeEvent.contentOffset.y),
  });

  private moved(y: number) {
    const front = frontAt(y, this.count);
    if (front !== this.front) {
      this.front = front;
      this.onFront(front);
    }
    // Auf dem Geraet rastet `snapToInterval`; im Browser erst, wenn es still ist.
    if (Platform.OS !== 'web') return;
    this.clear();
    this.timer = setTimeout(() => this.goTo(frontAt(y, this.count)), SETTLE_MS);
  }

  /** Die Karte `index` nach vorn holen. */
  goTo(index: number) {
    this.findView()?.scrollTo({ y: index * STACK_STEP, animated: true });
  }

  /** Aus einem Effekt nachgereicht — der Ref haengt erst nach dem Rendern. */
  connect(findView: () => ScrollView | null, onFront: (index: number) => void) {
    this.findView = findView;
    this.onFront = onFront;
  }

  setCount(count: number) {
    this.count = count;
  }

  clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

/**
 * Die ungelesenen Mitteilungen als Stapel statt als endlose Liste: sie liegen
 * fast uebereinander, die vorderste ganz hell, jede dahinter kleiner und
 * durchsichtiger. Rollen schiebt die vorderste nach oben weg und holt die
 * naechste von unten nach vorn. Wischen nach rechts heisst gelesen, nach links
 * weg; eine Anfrage hat ✓ und ✕, eine E-Mail oeffnet sich per Tipp.
 */
export function NewsStack({ rows }: { rows: readonly NotificationRow[] }) {
  const [motion] = useState(() => new StackMotion());
  const scrollRef = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(0);
  const count = rows.length;
  const front = Math.min(current, Math.max(count - 1, 0));
  const height = stackHeight(count);

  useEffect(() => {
    motion.connect(() => scrollRef.current, setCurrent);
    return () => motion.clear();
  }, [motion]);

  // Faellt die letzte Karte weg, rueckt der Stapel zur neuen letzten.
  useEffect(() => {
    motion.setCount(count);
    if (count > 0 && current > count - 1) motion.goTo(count - 1);
  }, [motion, count, current]);

  return (
    <View style={{ height }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ height: height + Math.max(count - 1, 0) * STACK_STEP }}
        onScroll={motion.onScroll}
        scrollEventThrottle={16}
        snapToInterval={STACK_STEP}
        decelerationRate="fast"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row, index) => (
          <StackSlot
            key={row.id}
            index={index}
            count={count}
            front={index === front}
            scrollY={motion.scrollY}
          >
            <NotificationItem notification={row} place="news" stacked />
          </StackSlot>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

/**
 * Ein Platz im Stapel. Groesse, Versatz und Deckkraft folgen der Rollposition;
 * nur die vorderste Karte nimmt Tipps und Wische an.
 */
function StackSlot({
  index,
  count,
  front,
  scrollY,
  children,
}: {
  index: number;
  count: number;
  front: boolean;
  scrollY: Animated.Value;
  children: ReactNode;
}) {
  const animated = useMemo(() => {
    const frames = stackFrames(index);
    const along = (outputRange: number[]) =>
      scrollY.interpolate({ inputRange: frames.inputRange, outputRange, extrapolate: 'clamp' });
    return {
      opacity: along(frames.opacity),
      transform: [{ translateY: along(frames.translateY) }, { scale: along(frames.scale) }],
    };
  }, [index, scrollY]);

  return (
    <Animated.View
      style={[
        styles.slot,
        {
          top: index * STACK_STEP,
          // Die vorderste liegt oben, jede weitere darunter.
          zIndex: count - index,
          pointerEvents: front ? 'auto' : 'none',
        },
        animated,
      ]}
      accessibilityElementsHidden={!front}
      importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', left: 0, right: 0, height: STACK_CARD_HEIGHT },
});
