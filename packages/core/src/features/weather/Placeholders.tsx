import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

import { WEATHER_METRICS } from './metrics';
import { surfaceColor } from './Surface';

/** Ein Atemzug des Schimmers. */
const PULSE_MS = 700;
const PULSE_LOW = 0.45;

/**
 * Das erste Laden ohne Vorrat: die Module stehen schon in ihrer fertigen
 * Groesse da und schimmern leicht — bei weniger Bewegung stehen sie still.
 */
export function Placeholders({ reduced }: { reduced: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) return;
    const step = (toValue: number) =>
      Animated.timing(pulse, {
        toValue,
        duration: PULSE_MS,
        easing: theme.motion.easing.inOut,
        useNativeDriver: Platform.OS !== 'web',
      });
    const loop = Animated.loop(Animated.sequence([step(PULSE_LOW), step(1)]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced, theme.motion.easing.inOut]);

  const block = {
    backgroundColor: surfaceColor(theme),
    borderRadius: theme.radii.md,
    opacity: reduced ? 1 : pulse,
  };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={{ gap: theme.spacing.md }}
    >
      <Animated.View style={[block, { height: WEATHER_METRICS.hoursPlaceholder }]} />
      <Animated.View style={[block, { height: WEATHER_METRICS.weekPlaceholder }]} />
      {['first', 'second'].map((row) => (
        <View key={row} style={[styles.row, { gap: theme.spacing.md }]}>
          <Animated.View style={[block, styles.tile]} />
          <Animated.View style={[block, styles.tile]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tile: { flex: 1, aspectRatio: 1 },
});
