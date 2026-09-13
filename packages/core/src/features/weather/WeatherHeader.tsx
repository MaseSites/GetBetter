import { Animated, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { weatherLabelKey, type CurrentWeather, type DayForecast } from './api';
import { WEATHER_METRICS } from './metrics';

/** Ab diesem Anteil der Strecke ist der grosse Kopf ausgeblendet … */
const FADE_OUT_SHARE = 0.75;
/** … und ab diesem blendet die gepinnte Zeile ein. */
const PIN_IN_SHARE = 0.6;

type HeaderBigProps = {
  name: string;
  isLocation: boolean;
  current: CurrentWeather | null;
  today: DayForecast | null;
  /** Ohne Scrollwert (in der Vorschau) steht der Kopf still. */
  scrollY: Animated.Value | null;
};

/**
 * Der Kopf fliesst, ohne Karte: Ort, die Temperatur gross mit haengendem
 * Gradzeichen, der Zustand einmal, darunter die Spanne.
 */
export function HeaderBig({ name, isLocation, current, today, scrollY }: HeaderBigProps) {
  const { t } = useI18n();
  const theme = useTheme();

  const fade = scrollY
    ? {
        opacity: scrollY.interpolate({
          inputRange: [0, WEATHER_METRICS.collapseDistance * FADE_OUT_SHARE],
          outputRange: [1, 0],
          extrapolate: 'clamp',
        }),
      }
    : null;

  const tempStyle = {
    fontSize: WEATHER_METRICS.tempSize,
    lineHeight: WEATHER_METRICS.tempLine,
    fontWeight: WEATHER_METRICS.tempWeight,
    fontFamily: theme.fontFamilyDisplay,
    letterSpacing: theme.tracking.hero,
  };

  const condition = current ? t(weatherLabelKey(current.code)) : null;
  const range = today
    ? t('weather.page.hiLo', { max: Math.round(today.max), min: Math.round(today.min) })
    : null;
  const temperature = current ? String(Math.round(current.temp)) : t('weather.page.noValue');

  return (
    <Animated.View
      accessible
      accessibilityRole="header"
      accessibilityLabel={[
        name,
        current ? t('weather.degrees', { temp: temperature }) : null,
        condition,
        range,
      ]
        .filter(Boolean)
        .join(', ')}
      style={[styles.big, { paddingBottom: theme.spacing.lg, gap: theme.spacing.xs }, fade]}
    >
      <View style={[styles.row, { gap: theme.spacing.xs }]}>
        {isLocation ? <Icon name="navigate" size={16} color={theme.colors.text} /> : null}
        <Text
          variant="title"
          numberOfLines={1}
          style={{
            fontSize: theme.fontSize.stat,
            lineHeight: theme.lineHeight.xl,
            fontWeight: theme.fontWeight.medium,
          }}
        >
          {name}
        </Text>
      </View>

      {/* Die Zahl steht mittig; das Gradzeichen haengt rechts ausserhalb der Achse. */}
      <View style={styles.row}>
        <Text style={tempStyle}>{temperature}</Text>
        <View style={styles.degreeAnchor}>
          <Text style={[tempStyle, styles.degree]}>{t('weather.page.degreeSign')}</Text>
        </View>
      </View>

      <View style={{ minHeight: theme.lineHeight.lg }}>
        {condition ? (
          <Text
            align="center"
            style={{ fontSize: theme.fontSize.lg, lineHeight: theme.lineHeight.lg }}
          >
            {condition}
          </Text>
        ) : null}
      </View>
      <View style={{ minHeight: WEATHER_METRICS.rangeLine }}>
        {range ? (
          <Text
            tone="muted"
            align="center"
            style={{ fontSize: WEATHER_METRICS.rangeSize, lineHeight: WEATHER_METRICS.rangeLine }}
          >
            {range}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

type HeaderPinnedProps = {
  name: string;
  current: CurrentWeather | null;
  scrollY: Animated.Value;
  topInset: number;
};

/** Die gepinnte Zeile nach dem Scrollen: „Zürich“, darunter „18° | Bewölkt“. */
export function HeaderPinned({ name, current, scrollY, topInset }: HeaderPinnedProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const opacity = scrollY.interpolate({
    inputRange: [WEATHER_METRICS.collapseDistance * PIN_IN_SHARE, WEATHER_METRICS.collapseDistance],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.pinned,
        {
          height: topInset + WEATHER_METRICS.pinnedHeight,
          paddingTop: topInset,
          paddingHorizontal: theme.spacing.xxl + theme.spacing.xl,
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
          opacity,
        },
      ]}
    >
      <Text
        variant="body"
        align="center"
        numberOfLines={1}
        style={{ fontWeight: theme.fontWeight.semibold }}
      >
        {name}
      </Text>
      {current ? (
        <Text variant="label" tone="muted" align="center" numberOfLines={1}>
          {t('weather.page.pinned', {
            temp: Math.round(current.temp),
            condition: t(weatherLabelKey(current.code)),
          })}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  big: {
    minHeight: WEATHER_METRICS.headerHeight - WEATHER_METRICS.pinnedHeight,
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  degreeAnchor: { width: 0, alignSelf: 'stretch', overflow: 'visible' },
  degree: { position: 'absolute', left: 0, top: 0 },
  pinned: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    pointerEvents: 'none',
  },
});
