import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { currentApp, type AppId } from '@/app/identity';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Text } from '@/ui';

import { TutorialArt, type TutorialArtKind } from './TutorialArt';
import { useReducedMotion } from './useReducedMotion';

export type TutorialProps = {
  /** Fertig oder uebersprungen — beides heisst: rein in die App. */
  onDone: () => void;
};

/**
 * Welche Karten eine App zeigt. GetBetter hat Heute, Schnellzugriff, Mail und
 * den Assistenten; die anderen erklaeren nur, was sie wirklich haben.
 */
const CARDS: Readonly<Record<AppId, readonly TutorialArtKind[]>> = {
  getbetter: ['today', 'quick', 'areas', 'news', 'mail', 'swipe', 'assistant'],
  betterfamily: ['start', 'functions', 'swipe'],
  bettergym: ['start', 'functions', 'swipe'],
  betterai: ['chats', 'swipe'],
  bettermoney: ['start', 'functions', 'swipe'],
};

const ART_HEIGHT = 244;
/** Die Skizze bleibt beim Wischen etwas zurueck — so wirkt sie weiter weg. */
const PARALLAX = 0.3;
const FADED = 0.35;
const DOT = 6;
const DOT_ACTIVE = 20;

/**
 * Kurz erklaert, in wischbaren Karten: oben die Punkte und „Überspringen“,
 * unten „Weiter“ und auf der letzten Karte „Los geht’s“.
 */
export function Tutorial({ onDone }: TutorialProps) {
  const t = useTranslate();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const cards = CARDS[currentApp().id];
  const pager = useRef<ScrollView>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(0);
  const [scrollX] = useState(() => new Animated.Value(0));
  const last = page >= cards.length - 1;

  // Die Zurueck-Taste unter Android ueberspringt, statt darunter eine Seite zurueckzugehen.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDone();
      return true;
    });
    return () => subscription.remove();
  }, [onDone]);

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = event.nativeEvent.contentOffset.x;
    scrollX.setValue(x);
    if (size.width <= 0) return;
    const next = Math.min(cards.length - 1, Math.max(0, Math.round(x / size.width)));
    if (next !== page) setPage(next);
  }

  function next() {
    if (last) {
      onDone();
      return;
    }
    pager.current?.scrollTo({ x: (page + 1) * size.width, animated: true });
  }

  return (
    <View
      style={[
        styles.fill,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.lg,
          gap: theme.spacing.lg,
        },
      ]}
    >
      <View style={[styles.top, { paddingHorizontal: theme.spacing.edge }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.row, { gap: theme.spacing.xs }]}
        >
          {cards.map((kind, index) => (
            <View
              key={kind}
              style={{
                width: index === page ? DOT_ACTIVE : DOT,
                height: DOT,
                borderRadius: theme.radii.pill,
                backgroundColor: index === page ? theme.colors.text : theme.colors.borderStrong,
              }}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.skip')}
          onPress={onDone}
          hitSlop={theme.spacing.md}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text variant="label" tone="muted">
            {t('common.skip')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onLayout={handleLayout}
        style={styles.fill}
      >
        {size.width > 0
          ? cards.map((kind, index) => (
              <Card
                key={kind}
                kind={kind}
                index={index}
                total={cards.length}
                width={size.width}
                height={size.height}
                scrollX={scrollX}
                still={reduced !== false}
              />
            ))
          : null}
      </ScrollView>

      <View style={{ paddingHorizontal: theme.spacing.edge }}>
        <Button label={last ? t('intro.tutorial.done') : t('common.continue')} onPress={next} />
      </View>
    </View>
  );
}

function Card({
  kind,
  index,
  total,
  width,
  height,
  scrollX,
  still,
}: {
  kind: TutorialArtKind;
  index: number;
  total: number;
  width: number;
  height: number;
  scrollX: Animated.Value;
  still: boolean;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const { account } = useApp();
  const assistant = account?.assistantName?.trim() ?? '';

  const range = [(index - 1) * width, index * width, (index + 1) * width];
  const artStyle = still
    ? null
    : {
        opacity: scrollX.interpolate({
          inputRange: range,
          outputRange: [FADED, 1, FADED],
          extrapolate: 'clamp' as const,
        }),
        transform: [
          {
            translateX: scrollX.interpolate({
              inputRange: range,
              outputRange: [-width * PARALLAX, 0, width * PARALLAX],
              extrapolate: 'clamp' as const,
            }),
          },
        ],
      };

  const body =
    kind === 'assistant' && assistant
      ? t('intro.tutorial.assistant.bodyNamed', { assistant })
      : t(`intro.tutorial.${kind}.body`);

  return (
    <View
      style={[
        styles.card,
        { width, height, paddingHorizontal: theme.spacing.edge, gap: theme.spacing.xl },
      ]}
    >
      <View
        style={[
          styles.art,
          {
            height: ART_HEIGHT,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.surfaceMuted,
            padding: theme.spacing.lg,
          },
        ]}
      >
        <Animated.View style={[styles.fillCenter, artStyle]}>
          <TutorialArt kind={kind} />
        </Animated.View>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="overline" tone="faint">
          {t('intro.tutorial.count', { current: index + 1, total })}
        </Text>
        <Text variant="display">{t(`intro.tutorial.${kind}.title`)}</Text>
        <Text variant="body" tone="muted">
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { justifyContent: 'center' },
  art: { overflow: 'hidden' },
  fillCenter: { flex: 1, justifyContent: 'center' },
});
