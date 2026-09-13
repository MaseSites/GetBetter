import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { WeatherPlace } from '@/db';
import { formatNumber, useI18n } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, Screen, Text, useUndo } from '@/ui';

import { locationStore, useMyLocation, type LocationState } from './location';
import { WEATHER_METRICS } from './metrics';
import { PlacePage } from './PlacePage';
import { placeKey, withPlace } from './places';
import { LOCATION_KEY, pageSelection, useSelectedPage } from './selection';
import { surfaceColor } from './Surface';

export type RequestedPlace = { lat: number; lon: number; name?: string };

type Page = { key: string; place: WeatherPlace; isLocation: boolean; saved: boolean };

/** Nur die Seite davor und danach werden gebaut; weiter weg steht eine leere Flaeche. */
const RENDER_DISTANCE = 1;
const COORD_DIGITS = 100;

/**
 * Das Blaettern ausserhalb von React: welche Seite gezeigt wird und wohin die
 * Flaeche rollen muss, wenn sich die Seiten aendern.
 */
class PagerController {
  private node: ScrollView | null = null;
  private shown = -1;
  private width = 0;
  private onIndex: (index: number) => void = () => undefined;

  readonly attach = (node: ScrollView | null) => {
    this.node = node;
  };

  setOnIndex(onIndex: (index: number) => void) {
    this.onIndex = onIndex;
  }

  show(index: number, width: number) {
    if (!this.node || width <= 0) return;
    if (index === this.shown && width === this.width) return;
    this.shown = index;
    this.width = width;
    this.node.scrollTo({ x: index * width, animated: false });
  }

  goTo(index: number) {
    this.node?.scrollTo({ x: index * this.width, animated: true });
  }

  scrolled(x: number) {
    if (this.width <= 0) return;
    const index = Math.round(x / this.width);
    if (index === this.shown) return;
    this.shown = index;
    this.onIndex(index);
  }
}

function pagesOf(
  location: LocationState,
  locationName: string,
  saved: readonly WeatherPlace[],
  requested: WeatherPlace | null,
): Page[] {
  const pages: Page[] = [
    ...(location.status === 'granted'
      ? [
          {
            key: LOCATION_KEY,
            place: { name: locationName, lat: location.lat, lon: location.lon },
            isLocation: true,
            saved: true,
          },
        ]
      : []),
    ...saved.map((place) => ({ key: placeKey(place), place, isLocation: false, saved: true })),
  ];
  // Ein Ort aus einem Link, der nicht gemerkt ist: eine voruebergehende Seite am Ende.
  if (requested && !pages.some((page) => page.key === placeKey(requested))) {
    return [
      ...pages,
      { key: placeKey(requested), place: requested, isLocation: false, saved: false },
    ];
  }
  return pages;
}

/**
 * Eine Seite pro Ort, seitlich blaetterbar. Oben links Zurueck, unten die eigene
 * Leiste mit Seitenpunkten und dem Listen-Symbol.
 */
export function PlacePages({ requested }: { requested: RequestedPlace | null }) {
  const { t, language } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const undo = useUndo();
  const { account, weatherPlaces, updateWeatherPlaces } = useApp();
  const location = useMyLocation();
  const selected = useSelectedPage();
  const [pager] = useState(() => new PagerController());
  const [width, setWidth] = useState(0);

  const requestedPlace: WeatherPlace | null = requested
    ? {
        lat: requested.lat,
        lon: requested.lon,
        name:
          requested.name ??
          t('weather.page.coords', {
            lat: formatNumber(language, Math.round(requested.lat * COORD_DIGITS) / COORD_DIGITS),
            lon: formatNumber(language, Math.round(requested.lon * COORD_DIGITS) / COORD_DIGITS),
          }),
      }
    : null;
  const pages = pagesOf(location, t('weather.myLocation'), weatherPlaces, requestedPlace);

  // Offen ist, was zuletzt gewaehlt wurde; sonst der Ort aus dem Link; sonst der
  // Ort, dessen Temperatur auf der Startseite stand.
  const homeKey = account?.weatherPlace ? placeKey(account.weatherPlace) : null;
  const wanted = [selected, requestedPlace ? placeKey(requestedPlace) : null, homeKey].find(
    (key) => key !== null && pages.some((page) => page.key === key),
  );
  const index = Math.max(
    0,
    pages.findIndex((page) => page.key === wanted),
  );
  const current = pages[index];

  useEffect(() => {
    pager.setOnIndex((next) => {
      const page = pages[next];
      if (page) pageSelection.select(page.key);
    });
  });

  useEffect(() => {
    pager.show(index, width);
  }, [pager, index, width]);

  // Wer das Wetter verlaesst, beginnt beim naechsten Mal wieder beim eigenen Ort.
  useEffect(() => () => pageSelection.select(null), []);

  const step = (direction: -1 | 1) =>
    pager.goTo(Math.min(pages.length - 1, Math.max(0, index + direction)));

  const add = (place: WeatherPlace) => {
    if (withPlace(weatherPlaces, place).result === 'full') {
      undo.show({ message: t('weather.places.full') });
      return;
    }
    void updateWeatherPlaces((places) => withPlace(places, place).places);
  };

  const bottomSpace = WEATHER_METRICS.bottomBar + insets.bottom;
  const prompt = location.status === 'ask' ? <LocationPrompt /> : null;

  return (
    <Screen scroll={false} padded={false} gap={0}>
      <View style={styles.fill}>
        <ScrollView
          ref={pager.attach}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => pager.scrolled(event.nativeEvent.contentOffset.x)}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={styles.fill}
        >
          {width > 0
            ? pages.map((page, position) => (
                <View key={page.key} style={{ width }}>
                  {Math.abs(position - index) <= RENDER_DISTANCE ? (
                    <PlacePage
                      place={page.place}
                      isLocation={page.isLocation}
                      topInset={insets.top}
                      bottomSpace={bottomSpace}
                      prompt={position === 0 ? prompt : undefined}
                    />
                  ) : null}
                </View>
              ))
            : null}
        </ScrollView>

        <TopButtons
          topInset={insets.top}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          onAdd={current && !current.saved ? () => add(current.place) : undefined}
        />
        <BottomBar
          pages={pages}
          index={index}
          bottomInset={insets.bottom}
          onStep={step}
          onList={() => router.push('/run/weather?view=places')}
        />
      </View>
    </Screen>
  );
}

function TopButtons({
  topInset,
  onBack,
  onAdd,
}: {
  topInset: number;
  onBack: () => void;
  onAdd?: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const top = topInset + (WEATHER_METRICS.pinnedHeight - HIT_TARGET) / 2;
  const round = [
    styles.round,
    theme.elevation.card,
    { backgroundColor: theme.colors.surface, borderRadius: theme.radii.pill },
  ];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={onBack}
        style={({ pressed }) => [
          styles.corner,
          { top, left: theme.spacing.lg, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <View style={round}>
          <Icon name="back" size={20} color={theme.colors.text} />
        </View>
      </Pressable>
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('weather.page.add')}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.corner,
            styles.pill,
            theme.elevation.card,
            {
              top,
              right: theme.spacing.lg,
              paddingHorizontal: theme.spacing.lg,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surface,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text variant="label" tone="accent" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t('weather.page.add')}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

function BottomBar({
  pages,
  index,
  bottomInset,
  onStep,
  onList,
}: {
  pages: readonly Page[];
  index: number;
  bottomInset: number;
  onStep: (direction: -1 | 1) => void;
  onList: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const dot = WEATHER_METRICS.dot;

  return (
    <View
      style={[
        styles.bar,
        {
          height: WEATHER_METRICS.bottomBar + bottomInset,
          paddingBottom: bottomInset,
          paddingHorizontal: theme.spacing.sm,
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.side} />
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('weather.page.dots', { current: index + 1, total: pages.length })}
        accessibilityValue={{ text: pages[index]?.place.name ?? '' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
        style={[styles.dots, { gap: theme.spacing.xs }]}
      >
        {pages.map((page, position) => {
          const color = position === index ? theme.colors.text : theme.colors.textFaint;
          return page.isLocation ? (
            <Icon key={page.key} name="navigate" size={dot + theme.spacing.xs} color={color} />
          ) : (
            <View
              key={page.key}
              style={{
                width: dot,
                height: dot,
                borderRadius: theme.radii.pill,
                backgroundColor: color,
              }}
            />
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('weather.page.places')}
        onPress={onList}
        style={({ pressed }) => [styles.side, styles.centered, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Icon name="lines" size={24} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

/** Einmal oben auf der Seite, bis erlaubt oder weggetippt wird. */
function LocationPrompt() {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.prompt,
        {
          gap: theme.spacing.sm,
          paddingLeft: theme.spacing.lg,
          borderRadius: theme.radii.md,
          backgroundColor: surfaceColor(theme),
        },
      ]}
    >
      <Icon name="navigate" size={18} color={theme.colors.text} />
      <Text variant="label" style={styles.fill}>
        {t('weather.location.prompt')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('weather.location.allow')}
        onPress={locationStore.request}
        style={({ pressed }) => [
          styles.centered,
          {
            minHeight: HIT_TARGET,
            paddingHorizontal: theme.spacing.sm,
            opacity: pressed ? 0.5 : 1,
          },
        ]}
      >
        <Text variant="label" tone="accent" style={{ fontWeight: theme.fontWeight.semibold }}>
          {t('weather.location.allow')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={locationStore.dismiss}
        style={({ pressed }) => [styles.side, styles.centered, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Icon name="close" size={18} color={theme.colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  corner: { position: 'absolute' },
  round: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  side: { width: HIT_TARGET, height: HIT_TARGET },
  centered: { alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  prompt: { flexDirection: 'row', alignItems: 'center' },
});
