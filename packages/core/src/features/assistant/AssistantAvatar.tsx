import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ClubAvatar, type AvatarTarget } from '@/features/intro/ClubAvatar';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

/** So gross steht er im leeren Assistenten — gross genug, dass man ihn ansieht. */
const AVATAR_SIZE = 128;

const useNativeDriver = Platform.OS !== 'web';

type Box = { x: number; y: number; width: number; height: number };

export type AssistantAvatarProps = {
  /** Sein Name, wenn er einen hat. */
  name?: string | undefined;
  /** Die Frage ist raus: er zerfaellt und fliegt ihr hinterher. */
  leaving: boolean;
  /** Angekommen — jetzt darf er aus dem Baum. */
  onGone: () => void;
};

/**
 * Der Avatar im leeren Assistenten: er steht da, schaut sich um und wartet.
 * Schickt man etwas ab, zerfaellt er in seine Stuecke und fliegt als Welle in
 * die Nachricht hinein, die gerade unten rechts erschienen ist.
 *
 * Er liegt als Schicht ueber dem Gespraech und nimmt keine Tipps an — sonst
 * verschoebe sich das Gespraech, waehrend er noch unterwegs ist.
 */
export function AssistantAvatar({ name = '', leaving, onGone }: AssistantAvatarProps) {
  const t = useTranslate();
  const theme = useTheme();
  const [area, setArea] = useState<Box | null>(null);
  const [seat, setSeat] = useState<Box | null>(null);
  // Kein `useRef`: der Wert wird beim Rendern gelesen, dafuer ist `useState` da.
  const [words] = useState(() => new Animated.Value(1));

  // Der Text geht mit ihm — er soll nicht ueber dem Gespraech stehen bleiben.
  useEffect(() => {
    if (!leaving) return;
    Animated.timing(words, {
      toValue: 0,
      duration: theme.motion.duration.exit,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }, [leaving, words, theme.motion]);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.area,
        { gap: theme.spacing.lg, padding: theme.spacing.edge },
      ]}
      onLayout={(event: LayoutChangeEvent) => setArea(event.nativeEvent.layout)}
    >
      <View onLayout={(event: LayoutChangeEvent) => setSeat(event.nativeEvent.layout)}>
        <ClubAvatar
          size={AVATAR_SIZE}
          phase={leaving ? 'scatter' : 'assemble'}
          gazeOnly
          target={targetOf(area, seat, theme.spacing.xxl)}
          onScattered={onGone}
        />
      </View>

      <Animated.View style={[styles.words, { gap: theme.spacing.xs, opacity: words }]}>
        <Text variant="title" align="center">
          {name ? t('personalize.assistant.greeting', { name }) : t('assistant.empty.title')}
        </Text>
        <Text variant="body" tone="muted" align="center">
          {t('assistant.empty.body')}
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * Der Weg vom Avatar zur Nachricht: die eigene Blase erscheint unten rechts,
 * also fliegen die Stuecke dorthin. Ohne Mass fliegen sie einfach auseinander.
 */
function targetOf(area: Box | null, seat: Box | null, inset: number): AvatarTarget | undefined {
  if (!area || !seat) return undefined;
  const fromX = seat.x + seat.width / 2;
  const fromY = seat.y + seat.height / 2;
  return {
    x: Math.round(area.width - inset - fromX),
    y: Math.round(area.height - inset - fromY),
  };
}

const styles = StyleSheet.create({
  // `pointerEvents` gehoert in den Stil — als Prop warnt der Browser.
  area: { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  words: { alignItems: 'center' },
});
