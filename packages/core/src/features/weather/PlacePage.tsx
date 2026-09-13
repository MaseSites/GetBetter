import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import type { WeatherPlace } from '@/db';
import { useI18n, type Language, type Translate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Text, useReducedMotion } from '@/ui';

import type { Forecast } from './api';
import { DaySheet } from './DaySheet';
import { HoursModule } from './HoursModule';
import { ageOf, dayIndexAt } from './insights';
import { MetricSheet } from './MetricSheet';
import { WEATHER_METRICS } from './metrics';
import { Placeholders } from './Placeholders';
import { PrecipModule } from './PrecipModule';
import { FRESH_MS, refreshForecast, useForecast, type ForecastEntry } from './store';
import { Tiles, type TileMetric } from './Tiles';
import { clockTime, shortDay, useNow } from './time';
import { HeaderBig, HeaderPinned } from './WeatherHeader';
import { WeekModule } from './WeekModule';

const useNativeDriver = Platform.OS !== 'web';

export type PlacePageProps = {
  place: WeatherPlace;
  isLocation: boolean;
  /** In der Vorschau: ohne eigenes Rollen, ohne gepinnte Zeile, ohne Blaetter. */
  embedded?: boolean;
  /** Oberer Sicherheitsabstand des Geraets. */
  topInset?: number;
  /** Platz fuer die Leiste unten. */
  bottomSpace?: number;
  /** Die einmalige Zeile „Wetter für deinen Standort · Erlauben“. */
  prompt?: ReactNode;
};

/** Eine Ortsseite: der fliessende Kopf, darunter die Module als leichte Flaechen. */
export function PlacePage({
  place,
  isLocation,
  embedded = false,
  topInset = 0,
  bottomSpace = 0,
  prompt,
}: PlacePageProps) {
  const theme = useTheme();
  const entry = useForecast(place);
  const now = useNow();
  const [scrollY] = useState(() => new Animated.Value(0));
  const [onScroll] = useState(() =>
    Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver }),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [metric, setMetric] = useState<TileMetric | null>(null);

  const refresh = () => {
    setRefreshing(true);
    void refreshForecast(place).finally(() => setRefreshing(false));
  };

  const body = (
    <PageBody
      place={place}
      isLocation={isLocation}
      entry={entry}
      now={now}
      scrollY={embedded ? null : scrollY}
      prompt={prompt}
      interactive={!embedded}
      onRefresh={refresh}
      onOpenDay={setDayIndex}
      onOpenTile={setMetric}
    />
  );

  if (embedded) return <View style={{ gap: theme.spacing.md }}>{body}</View>;

  // Der Kopf beginnt unter dem Zurueck-Knopf, der mittig in der gepinnten Zeile sitzt.
  const topSpace = topInset + WEATHER_METRICS.pinnedHeight - theme.spacing.lg;

  return (
    <View style={styles.fill}>
      <Animated.ScrollView
        style={styles.fill}
        contentContainerStyle={{
          paddingTop: topSpace,
          paddingBottom: bottomSpace + theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.colors.textMuted}
            progressViewOffset={topSpace}
          />
        }
      >
        {body}
      </Animated.ScrollView>
      <HeaderPinned
        name={place.name}
        current={entry.forecast?.current ?? null}
        scrollY={scrollY}
        topInset={topInset}
      />
      {entry.forecast ? (
        <>
          <DaySheet
            forecast={entry.forecast}
            dayIndex={dayIndex}
            now={now}
            onChangeDay={setDayIndex}
            onClose={() => setDayIndex(null)}
          />
          <MetricSheet
            forecast={entry.forecast}
            metric={metric}
            now={now}
            onClose={() => setMetric(null)}
          />
        </>
      ) : null}
    </View>
  );
}

type PageBodyProps = {
  place: WeatherPlace;
  isLocation: boolean;
  entry: ForecastEntry;
  now: number;
  scrollY: Animated.Value | null;
  prompt?: ReactNode;
  interactive: boolean;
  onRefresh: () => void;
  onOpenDay: (index: number) => void;
  onOpenTile: (metric: TileMetric) => void;
};

function PageBody({
  place,
  isLocation,
  entry,
  now,
  scrollY,
  prompt,
  interactive,
  onRefresh,
  onOpenDay,
  onOpenTile,
}: PageBodyProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { forecast } = entry;
  const todayIndex = forecast ? dayIndexAt(forecast.daily, now) : 0;
  const today = forecast?.daily[todayIndex] ?? null;
  const offline =
    forecast !== null && entry.failedAt !== null && entry.failedAt > forecast.fetchedAt;
  const unreachable = forecast === null && entry.failedAt !== null && !entry.loading;

  return (
    <>
      <HeaderBig
        name={place.name}
        isLocation={isLocation}
        current={forecast?.current ?? null}
        today={today}
        scrollY={scrollY}
      />
      {offline && forecast ? (
        <Text variant="caption" tone="muted" align="center">
          {t('weather.state.offline', { time: clockTime(language, forecast.fetchedAt) })}
        </Text>
      ) : null}
      {prompt}

      {unreachable ? (
        <View
          style={[styles.center, { gap: theme.spacing.md, paddingVertical: theme.spacing.xxl }]}
        >
          <Text variant="body" tone="muted" align="center">
            {t('weather.state.unreachable')}
          </Text>
          <Button label={t('weather.state.retry')} variant="secondary" onPress={onRefresh} />
        </View>
      ) : forecast === null ? (
        <Placeholders reduced={reduced === true} />
      ) : (
        <>
          <HoursModule
            forecast={forecast}
            now={now}
            onPress={interactive ? () => onOpenDay(todayIndex) : undefined}
          />
          <PrecipModule forecast={forecast} now={now} />
          <WeekModule
            forecast={forecast}
            now={now}
            onOpenDay={interactive ? onOpenDay : undefined}
          />
          <Tiles forecast={forecast} now={now} onOpen={interactive ? onOpenTile : undefined} />
          <Footer
            forecast={forecast}
            loading={entry.loading}
            now={now}
            onPress={interactive ? onRefresh : undefined}
          />
        </>
      )}
    </>
  );
}

function footerText(forecast: Forecast, now: number, t: Translate, language: Language): string {
  const age = ageOf(forecast.fetchedAt, now, FRESH_MS);
  switch (age.kind) {
    case 'justNow':
      return t('weather.footer.justNow');
    case 'fresh':
      return t('weather.footer.at', { time: clockTime(language, forecast.fetchedAt) });
    case 'minutes':
      return t('weather.footer.minutes', { count: age.count });
    case 'hours':
      return t('weather.footer.hours', { count: age.count });
    case 'days':
      return t('weather.footer.date', { date: shortDay(language, forecast.fetchedAt) });
  }
}

/**
 * „Wetterdaten: Open-Meteo · aktualisiert 14:32“. Waehrend neu geholt wird,
 * dreht daneben ein kleiner Kreis. Ein Tipp holt neu — im Browser gibt es kein
 * Ziehen zum Aktualisieren.
 */
function Footer({
  forecast,
  loading,
  now,
  onPress,
}: {
  forecast: Forecast;
  loading: boolean;
  now: number;
  onPress?: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const text = footerText(forecast, now, t, language);
  const content = (
    <View style={[styles.footer, { gap: theme.spacing.xs }]}>
      {loading ? <ActivityIndicator size="small" color={theme.colors.textFaint} /> : null}
      <Text variant="caption" tone="faint" align="center">
        {text}
      </Text>
    </View>
  );

  if (!onPress) return <View style={{ paddingVertical: theme.spacing.md }}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={t('weather.footer.refresh')}
      onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: theme.spacing.md, opacity: pressed ? 0.5 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
