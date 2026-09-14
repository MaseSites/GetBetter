import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { weatherIcon, weatherLabelKey, type DayForecast, type Forecast } from './api';
import { RAIN_WORTH_SHOWING } from './HoursModule';
import { dayIndexAt, nowShare, rangeBar, weekSpan } from './insights';
import { WEATHER_METRICS } from './metrics';
import { ModuleLabel, Surface, share, trackColor } from './Surface';
import { weekdayShort } from './time';

/**
 * 7 Tage in Zeilen von 44 pt: Tag, Symbol mit Regen, Tiefstwert, ein Balken auf
 * der Spanne der ganzen Woche (bei Heute mit einem Punkt fuer jetzt), Hoechstwert.
 * Jede Zeile oeffnet den Tag.
 */
export function WeekModule({
  forecast,
  now,
  onOpenDay,
}: {
  forecast: Forecast;
  now: number;
  onOpenDay?: (index: number) => void;
}) {
  const { t } = useI18n();
  const span = weekSpan(forecast.daily);
  const todayIndex = dayIndexAt(forecast.daily, now);

  return (
    <Surface>
      <ModuleLabel icon="calendar" label={t('weather.week.title')} />
      <View>
        {forecast.daily.map((day, index) => (
          <DayRow
            key={day.day}
            day={day}
            isToday={index === todayIndex}
            showRule={index > 0}
            span={span}
            currentTemp={forecast.current.temp}
            zone={forecast.timezone}
            onPress={onOpenDay ? () => onOpenDay(index) : undefined}
          />
        ))}
      </View>
    </Surface>
  );
}

type DayRowProps = {
  day: DayForecast;
  isToday: boolean;
  showRule: boolean;
  span: { min: number; max: number };
  currentTemp: number;
  zone: string;
  onPress?: () => void;
};

function DayRow({ day, isToday, showRule, span, currentTemp, zone, onPress }: DayRowProps) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const label = isToday ? t('weather.today') : weekdayShort(language, day.ts, zone);
  const min = Math.round(day.min);
  const max = Math.round(day.max);
  const bar = rangeBar(day.min, day.max, span.min, span.max);
  const dot = WEATHER_METRICS.nowDot;
  const barHeight = WEATHER_METRICS.rangeBarHeight;

  const content = (
    <>
      <Text variant="body" numberOfLines={1} style={{ width: WEATHER_METRICS.weekDayWidth }}>
        {label}
      </Text>
      <View style={[styles.iconCell, { width: WEATHER_METRICS.weekIconWidth }]}>
        <Icon name={weatherIcon(day.code)} size={20} color={theme.colors.text} />
        {day.rain >= RAIN_WORTH_SHOWING ? (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ fontWeight: theme.fontWeight.semibold }}
          >
            {t('weather.percent', { percent: Math.round(day.rain) })}
          </Text>
        ) : null}
      </View>
      <Text
        variant="body"
        tone="faint"
        align="right"
        style={{ width: WEATHER_METRICS.weekTempWidth }}
      >
        {t('weather.degrees', { temp: min })}
      </Text>
      <View
        style={[
          styles.track,
          {
            height: barHeight,
            marginHorizontal: theme.spacing.sm,
            borderRadius: theme.radii.pill,
            backgroundColor: trackColor(theme),
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              left: share(bar.start),
              width: share(bar.end - bar.start),
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.textMuted,
            },
          ]}
        />
        {isToday ? (
          <View
            style={[
              styles.dot,
              {
                left: share(nowShare(currentTemp, span.min, span.max)),
                top: (barHeight - dot) / 2,
                width: dot,
                height: dot,
                marginLeft: -dot / 2,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.text,
                borderColor: theme.colors.background,
              },
            ]}
          />
        ) : null}
      </View>
      <Text variant="body" align="right" style={{ width: WEATHER_METRICS.weekTempWidth }}>
        {t('weather.degrees', { temp: max })}
      </Text>
    </>
  );

  const rowStyle = [
    styles.row,
    {
      minHeight: WEATHER_METRICS.weekRow,
      borderTopWidth: showRule ? StyleSheet.hairlineWidth : 0,
      borderTopColor: theme.colors.border,
    },
  ];
  const a11y = t('weather.week.row', {
    day: label,
    condition: t(weatherLabelKey(day.code)),
    min,
    max,
  });

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y} style={rowStyle}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconCell: { alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, bottom: 0 },
  dot: { position: 'absolute', borderWidth: 1 },
});
