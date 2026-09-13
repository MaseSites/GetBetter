import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { WeatherPlace } from '@/db';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  ContextMenu,
  Header,
  Icon,
  Input,
  Loading,
  PlainList,
  PlainRow,
  Screen,
  Sheet,
  SwipeRow,
  Text,
  useUndo,
  type MenuEntry,
  type SwipeAction,
} from '@/ui';

import { searchPlaces, weatherLabelKey, type PlaceHit } from './api';
import { dayIndexAt } from './insights';
import { locationStore, useMyLocation, type LocationState } from './location';
import { WEATHER_METRICS } from './metrics';
import { PlacePage } from './PlacePage';
import { findPlace, insertedPlace, movedPlace, placeKey, withPlace, withoutPlace } from './places';
import { LOCATION_KEY, pageSelection } from './selection';
import { useForecast } from './store';
import { clockTime, isOtherZone, useNow } from './time';

const SEARCH_DELAY_MS = 250;
const MIN_QUERY = 2;

type SearchResult = { query: string; hits: readonly PlaceHit[]; failed: boolean };

/**
 * Die Orte-Liste als Vollbild: suchen, wechseln, sortieren, entfernen.
 * „Mein Standort“ steht immer zuerst und laesst sich nicht entfernen.
 */
export function PlacesList() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const undo = useUndo();
  const { weatherPlaces, updateWeatherPlaces } = useApp();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [preview, setPreview] = useState<WeatherPlace | null>(null);

  const needle = query.trim();
  const searchingActive = needle.length >= MIN_QUERY;
  const searching = searchingActive && result?.query !== needle;

  useEffect(() => {
    if (needle.length < MIN_QUERY) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlaces(needle, language)
        .then((hits) => {
          if (!cancelled) setResult({ query: needle, hits, failed: false });
        })
        .catch(() => {
          if (!cancelled) setResult({ query: needle, hits: [], failed: true });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needle, language]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/run/weather'));

  /** Ein Tipp oeffnet den Ort: die Seiten darunter blaettern dorthin. */
  const open = (key: string, place?: WeatherPlace) => {
    pageSelection.select(key);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(place ? `/run/weather?place=${place.lat},${place.lon}` : '/run/weather');
  };

  const remove = (place: WeatherPlace, index: number) => {
    void updateWeatherPlaces((places) => withoutPlace(places, placeKey(place)));
    undo.show({
      message: t('weather.places.removed', { name: place.name }),
      onUndo: () => void updateWeatherPlaces((places) => insertedPlace(places, place, index)),
    });
  };

  const add = (place: WeatherPlace) => {
    setPreview(null);
    setQuery('');
    if (withPlace(weatherPlaces, place).result === 'full') {
      undo.show({ message: t('weather.places.full') });
      return;
    }
    void updateWeatherPlaces((places) => withPlace(places, place).places);
  };

  const pick = (hit: PlaceHit) => {
    const place = { name: hit.name, lat: hit.lat, lon: hit.lon };
    const saved = findPlace(weatherPlaces, placeKey(place));
    if (saved) open(placeKey(saved), saved);
    else setPreview(place);
  };

  return (
    <Screen
      header={<Header title={t('weather.places.title')} showBack onBack={back} />}
      gap={theme.spacing.md}
    >
      <Input
        icon="search"
        placeholder={t('weather.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="words"
        returnKeyType="search"
        accessibilityLabel={t('weather.searchPlaceholder')}
      />

      {searchingActive ? (
        <SearchResults
          query={needle}
          searching={searching}
          result={result?.query === needle ? result : null}
          onPick={pick}
        />
      ) : (
        <>
          <LocationRow onOpen={() => open(LOCATION_KEY)} />
          {weatherPlaces.map((place, index) => (
            <SavedRow
              key={placeKey(place)}
              place={place}
              index={index}
              count={weatherPlaces.length}
              onOpen={() => open(placeKey(place), place)}
              onMove={(direction) =>
                void updateWeatherPlaces((places) => movedPlace(places, placeKey(place), direction))
              }
              onRemove={() => remove(place, index)}
            />
          ))}
        </>
      )}

      <Sheet
        visible={preview !== null}
        onClose={() => setPreview(null)}
        detent="large"
        header={
          preview ? (
            <PreviewHeader
              name={preview.name}
              onCancel={() => setPreview(null)}
              onAdd={() => add(preview)}
            />
          ) : undefined
        }
      >
        {preview ? <PlacePage place={preview} isLocation={false} embedded /> : null}
      </Sheet>
    </Screen>
  );
}

function SearchResults({
  query,
  searching,
  result,
  onPick,
}: {
  query: string;
  searching: boolean;
  result: SearchResult | null;
  onPick: (hit: PlaceHit) => void;
}) {
  const { t } = useI18n();
  if (searching || !result) return <Loading compact />;
  if (result.failed) {
    return (
      <Text variant="label" tone="muted" align="center">
        {t('weather.places.searchFailed')}
      </Text>
    );
  }
  if (result.hits.length === 0) {
    return (
      <Text variant="label" tone="muted" align="center">
        {t('weather.places.noResult', { query })}
      </Text>
    );
  }
  return (
    <PlainList separatorInset="none">
      {result.hits.map((hit) => (
        <PlainRow
          key={placeKey(hit)}
          title={hit.name}
          {...(hit.region ? { subtitle: hit.region } : {})}
          onPress={() => onPick(hit)}
        />
      ))}
    </PlainList>
  );
}

function PreviewHeader({
  name,
  onCancel,
  onAdd,
}: {
  name: string;
  onCancel: () => void;
  onAdd: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={[styles.row, { gap: theme.spacing.md }]}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.headerButton}>
        <Text variant="body" tone="muted">
          {t('common.cancel')}
        </Text>
      </Pressable>
      <Text
        variant="body"
        align="center"
        numberOfLines={1}
        style={[styles.fill, { fontWeight: theme.fontWeight.semibold }]}
      >
        {name}
      </Text>
      <Pressable accessibilityRole="button" onPress={onAdd} style={styles.headerButton}>
        <Text variant="body" tone="accent" style={{ fontWeight: theme.fontWeight.semibold }}>
          {t('weather.page.add')}
        </Text>
      </Pressable>
    </View>
  );
}

function SavedRow({
  place,
  index,
  count,
  onOpen,
  onMove,
  onRemove,
}: {
  place: WeatherPlace;
  index: number;
  count: number;
  onOpen: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  // Ein Ort bleibt immer: den letzten gibt die Liste nicht her.
  const removable = count > 1;
  const removeAction: SwipeAction = {
    key: 'remove',
    label: t('weather.places.remove'),
    icon: 'trash',
    tone: 'danger',
    onPress: onRemove,
  };
  const items: MenuEntry[] = [
    {
      key: 'up',
      label: t('weather.places.moveUp'),
      disabled: index === 0,
      onPress: () => onMove(-1),
    },
    {
      key: 'down',
      label: t('weather.places.moveDown'),
      disabled: index === count - 1,
      onPress: () => onMove(1),
    },
    ...(removable
      ? [
          { key: 'divider', divider: true as const },
          {
            key: 'remove',
            label: t('weather.places.remove'),
            icon: 'trash' as const,
            destructive: true,
            onPress: onRemove,
          },
        ]
      : []),
  ];

  return (
    <SwipeRow
      {...(removable ? { trailing: [removeAction], trailingFull: removeAction } : {})}
      radius={theme.radii.md}
      backgroundColor={theme.colors.surface}
    >
      <ContextMenu items={items} onPress={onOpen} accessibilityLabel={place.name}>
        <PlaceSummary place={place} isLocation={false} />
      </ContextMenu>
    </SwipeRow>
  );
}

/** Eine Zeile, 96 pt: links Ort, Ortszeit und Zustand, rechts Temperatur mit H/T. */
function PlaceSummary({ place, isLocation }: { place: WeatherPlace; isLocation: boolean }) {
  const { t, language } = useI18n();
  const now = useNow();
  const { forecast } = useForecast(place);
  const today = forecast ? forecast.daily[dayIndexAt(forecast.daily, now)] : undefined;
  const condition = forecast ? t(weatherLabelKey(forecast.current.code)) : '';
  const subline =
    forecast && isOtherZone(forecast.utcOffsetSeconds, now)
      ? t('weather.places.timeAndCondition', {
          time: clockTime(language, now, forecast.timezone),
          condition,
        })
      : condition;

  return (
    <RowFrame
      name={place.name}
      isLocation={isLocation}
      subline={subline}
      temperature={
        forecast
          ? t('weather.degrees', { temp: Math.round(forecast.current.temp) })
          : t('weather.page.noValue')
      }
      range={
        today
          ? t('weather.page.hiLo', { max: Math.round(today.max), min: Math.round(today.min) })
          : null
      }
    />
  );
}

function RowFrame({
  name,
  isLocation,
  subline,
  subtone = 'muted',
  temperature,
  range,
}: {
  name: string;
  isLocation: boolean;
  subline: string;
  subtone?: 'muted' | 'accent';
  temperature: string | null;
  range: string | null;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        { minHeight: WEATHER_METRICS.placeRow, padding: theme.spacing.lg, gap: theme.spacing.md },
      ]}
    >
      <View style={[styles.fill, { gap: theme.spacing.xs }]}>
        <View style={[styles.row, { gap: theme.spacing.xs }]}>
          {isLocation ? <Icon name="navigate" size={16} color={theme.colors.text} /> : null}
          <Text
            numberOfLines={1}
            style={[
              styles.shrink,
              {
                fontSize: theme.fontSize.lg,
                lineHeight: theme.lineHeight.lg,
                fontWeight: theme.fontWeight.semibold,
                fontFamily: theme.fontFamilyDisplay,
              },
            ]}
          >
            {name}
          </Text>
        </View>
        {subline ? (
          <Text variant="label" tone={subtone} numberOfLines={1}>
            {subline}
          </Text>
        ) : null}
      </View>
      {temperature ? (
        <View style={styles.end}>
          <Text
            style={{
              fontSize: theme.fontSize.xl,
              lineHeight: theme.lineHeight.xl,
              fontWeight: WEATHER_METRICS.tempWeight,
            }}
          >
            {temperature}
          </Text>
          {range ? (
            <Text variant="caption" tone="muted">
              {range}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** „Mein Standort“ — je nach Erlaubnis eine Ortszeile, ein Angebot oder „aus“. */
function LocationRow({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const location = useMyLocation();
  const card = [
    styles.card,
    { borderRadius: theme.radii.md, backgroundColor: theme.colors.surface },
  ];

  if (location.status === 'granted') {
    return (
      <Pressable accessibilityRole="button" onPress={onOpen} style={card}>
        <PlaceSummary
          place={{ name: t('weather.myLocation'), lat: location.lat, lon: location.lon }}
          isLocation
        />
      </Pressable>
    );
  }

  const { name, subline, canAsk } = locationRowText(location, t);
  const frame = (
    <RowFrame
      name={name}
      isLocation
      subline={subline}
      subtone={canAsk ? 'accent' : 'muted'}
      temperature={null}
      range={null}
    />
  );
  if (!canAsk) return <View style={card}>{frame}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={locationStore.request} style={card}>
      {frame}
    </Pressable>
  );
}

function locationRowText(
  location: Exclude<LocationState, { status: 'granted' }>,
  t: ReturnType<typeof useI18n>['t'],
): { name: string; subline: string; canAsk: boolean } {
  switch (location.status) {
    case 'ask':
    case 'dismissed':
      return { name: t('weather.myLocation'), subline: t('weather.location.allow'), canAsk: true };
    case 'failed':
      return { name: t('weather.myLocation'), subline: t('weather.location.failed'), canAsk: true };
    case 'checking':
    case 'locating':
      return {
        name: t('weather.myLocation'),
        subline: t('weather.location.locating'),
        canAsk: false,
      };
    case 'denied':
      return {
        name: t('weather.location.off'),
        subline: t('weather.location.settings'),
        canAsk: false,
      };
    case 'unsupported':
      return {
        name: t('weather.location.off'),
        subline: t('weather.location.unsupported'),
        canAsk: false,
      };
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  end: { alignItems: 'flex-end' },
  card: { overflow: 'hidden' },
  headerButton: { minHeight: 44, justifyContent: 'center' },
});
