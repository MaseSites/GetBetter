import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import type { Forecast } from './api';
import { WEATHER_METRICS } from './metrics';
import { rainOutlook, type RainOutlook } from './rain';
import { ModuleLabel, Surface, share, trackColor } from './Surface';
import { clockTime } from './time';

const QUARTER_MS = 15 * 60_000;
/** Der Massstab reicht mindestens bis 1 mm je Viertelstunde, damit Niesel klein bleibt. */
const SCALE_FLOOR_MM = 1;

/** Nur, wenn in den naechsten 2 Stunden Regen kommt: Balken je 15 Minuten und ein Satz. */
export function PrecipModule({ forecast, now }: { forecast: Forecast; now: number }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const outlook = rainOutlook(forecast.quarters, now);
  if (!outlook) return null;

  const headline = headlineOf(outlook, t);
  const scale = Math.max(outlook.max, SCALE_FLOOR_MM);
  const middle = outlook.slots[Math.floor(outlook.slots.length / 2)];
  const last = outlook.slots[outlook.slots.length - 1];

  return (
    <Surface>
      <ModuleLabel icon="rain" label={t('weather.precip.title')} />
      <Text variant="body" style={{ fontWeight: theme.fontWeight.semibold }}>
        {headline}
      </Text>
      <View
        accessible
        accessibilityLabel={headline}
        style={[styles.bars, { height: WEATHER_METRICS.precipHeight, gap: theme.spacing.xs }]}
      >
        {outlook.slots.map((slot) => (
          <View
            key={slot.ts}
            style={[
              styles.track,
              { backgroundColor: trackColor(theme), borderRadius: theme.radii.xs },
            ]}
          >
            <View
              style={{
                height: share(slot.precip / scale),
                backgroundColor: theme.colors.textMuted,
                borderRadius: theme.radii.xs,
              }}
            />
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <Text variant="caption" tone="faint">
          {t('weather.now')}
        </Text>
        {middle ? (
          <Text variant="caption" tone="faint">
            {clockTime(language, middle.ts, forecast.timezone)}
          </Text>
        ) : null}
        {last ? (
          <Text variant="caption" tone="faint">
            {clockTime(language, last.ts + QUARTER_MS, forecast.timezone)}
          </Text>
        ) : null}
      </View>
    </Surface>
  );
}

function headlineOf(outlook: RainOutlook, t: ReturnType<typeof useI18n>['t']): string {
  if (outlook.state === 'continues') return t('weather.precip.continues');
  if (outlook.state === 'stops') return t('weather.precip.stops', { minutes: outlook.minutes });
  return outlook.minutes === 0
    ? t('weather.precip.startsNow')
    : t('weather.precip.starts', { minutes: outlook.minutes });
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'stretch' },
  track: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
