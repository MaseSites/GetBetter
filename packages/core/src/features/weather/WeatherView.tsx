import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { WeatherPlace } from '@/db';
import { formatTime, formatWeekdayLong, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Header,
  Icon,
  Input,
  ListItem,
  Loading,
  Screen,
  Sheet,
  Text,
} from '@/ui';

import { searchPlaces, upcomingHours, weatherIcon, weatherLabelKey, type PlaceHit } from './api';
import { useWeather } from './useWeather';

/** Ab hier lohnt sich die Regenwahrscheinlichkeit als Zahl. */
const RAIN_WORTH_SHOWING = 20;
const SEARCH_DELAY_MS = 350;

/** Jetzt gross, die naechsten Stunden als Streifen, die Woche als Liste. */
export function WeatherView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const weather = useWeather();
  const [choosing, setChoosing] = useState(false);

  const forecast = weather.forecast;
  const today = forecast?.daily[0];
  const degrees = (value: number) => t('weather.degrees', { temp: Math.round(value) });

  return (
    <Screen
      header={
        <Header
          title={weather.place.name}
          subtitle={forecast ? t(weatherLabelKey(forecast.current.code)) : module.short}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={[
            { icon: 'location', label: t('weather.choosePlace'), onPress: () => setChoosing(true) },
          ]}
        />
      }
    >
      {weather.loading && !forecast ? <Loading /> : null}

      {weather.error && !forecast ? (
        <EmptyState
          title={t('weather.error.title')}
          body={t('weather.error.body')}
          actionLabel={t('common.retry')}
          onAction={weather.retry}
        />
      ) : null}

      {forecast ? (
        <>
          <Card>
            <View style={[styles.center, { gap: theme.spacing.xs }]}>
              <Icon name={weatherIcon(forecast.current.code)} size={44} color={theme.colors.text} />
              <Text variant="display">{degrees(forecast.current.temp)}</Text>
              <Text variant="label" tone="muted">
                {t(weatherLabelKey(forecast.current.code))}
              </Text>
              {today ? (
                <Text variant="caption" tone="faint">
                  {t('weather.hiLo', { max: Math.round(today.max), min: Math.round(today.min) })}
                  {' · '}
                  {t('weather.feelsLike', { temp: Math.round(forecast.current.feelsLike) })}
                </Text>
              ) : null}
            </View>
          </Card>

          <Card title={t('weather.hours')}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.lg }}
            >
              {upcomingHours(forecast).map((hour, index) => (
                <View key={hour.at} style={[styles.center, { gap: theme.spacing.xs }]}>
                  <Text variant="caption" tone="faint">
                    {index === 0 ? t('weather.now') : formatTime(language, hour.at)}
                  </Text>
                  <Icon name={weatherIcon(hour.code)} size={20} color={theme.colors.textMuted} />
                  <Text variant="label">{degrees(hour.temp)}</Text>
                  {hour.rain >= RAIN_WORTH_SHOWING ? (
                    <Text variant="caption" tone="accent">
                      {t('weather.rain', { percent: hour.rain })}
                    </Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </Card>

          <Card title={t('weather.week')}>
            {forecast.daily.map((day, index) => (
              <View key={day.day}>
                {index > 0 ? <Divider /> : null}
                <View
                  style={[styles.row, { gap: theme.spacing.md, paddingVertical: theme.spacing.sm }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="label">
                      {index === 0
                        ? t('weather.today')
                        : formatWeekdayLong(language, new Date(day.day))}
                    </Text>
                  </View>
                  {day.rain >= RAIN_WORTH_SHOWING ? (
                    <Text variant="caption" tone="accent">
                      {t('weather.rain', { percent: day.rain })}
                    </Text>
                  ) : null}
                  <Icon name={weatherIcon(day.code)} size={20} color={theme.colors.textMuted} />
                  <Text variant="label" tone="muted" style={styles.range}>
                    {t('weather.range', { min: Math.round(day.min), max: Math.round(day.max) })}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          <Card title={t('weather.details')}>
            <DetailRow
              label={t('weather.wind')}
              value={t('weather.windValue', { speed: Math.round(forecast.current.wind) })}
            />
            <Divider />
            <DetailRow
              label={t('weather.humidity')}
              value={t('weather.percent', { percent: forecast.current.humidity })}
            />
            {today ? (
              <>
                <Divider />
                <DetailRow
                  label={t('weather.sunrise')}
                  value={formatTime(language, today.sunrise)}
                />
                <Divider />
                <DetailRow label={t('weather.sunset')} value={formatTime(language, today.sunset)} />
              </>
            ) : null}
          </Card>

          <Text variant="caption" tone="faint" align="center">
            {t('weather.source')}
          </Text>
        </>
      ) : null}

      <PlacePicker
        visible={choosing}
        onPick={(place) => {
          void weather.setPlace(place);
          setChoosing(false);
        }}
        onClose={() => setChoosing(false)}
      />
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { gap: theme.spacing.md, paddingVertical: theme.spacing.sm }]}>
      <View style={{ flex: 1 }}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
      </View>
      <Text variant="label">{value}</Text>
    </View>
  );
}

/** Ein Ort per Suche — oder, wo das Geraet ihn kennt, der eigene Standort. */
function PlacePicker({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (place: WeatherPlace) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [rawHits, setRawHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const canLocate = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
  const hits = query.trim().length < 2 ? [] : rawHits;

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      return;
    }
    let cancelled = false;
    const startSearching = () => setSearching(true);
    startSearching();
    const timer = setTimeout(() => {
      searchPlaces(needle)
        .then((found) => {
          if (!cancelled) setRawHits(found);
        })
        .catch(() => {
          if (!cancelled) setRawHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function locate() {
    if (!canLocate) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onPick({
          name: t('weather.myLocation'),
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => setLocating(false),
      { timeout: 10_000 },
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('weather.choosePlace')}>
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        <Input
          icon="search"
          placeholder={t('weather.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          returnKeyType="search"
          accessibilityLabel={t('weather.searchPlaceholder')}
        />

        {canLocate ? (
          <Button
            label={t('weather.myLocation')}
            icon="navigate"
            variant="secondary"
            loading={locating}
            onPress={locate}
          />
        ) : null}

        {searching ? <Loading compact /> : null}

        {hits.length > 0 ? (
          <Card>
            {hits.map((hit, index) => (
              <View key={`${hit.lat},${hit.lon}`}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={hit.name}
                  subtitle={hit.region || undefined}
                  onPress={() => onPick({ name: hit.name, lat: hit.lat, lon: hit.lon })}
                />
              </View>
            ))}
          </Card>
        ) : null}

        {!searching && query.trim().length >= 2 && hits.length === 0 ? (
          <Text variant="label" tone="faint" align="center">
            {t('weather.noResults')}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  range: { minWidth: 88, textAlign: 'right' },
});
