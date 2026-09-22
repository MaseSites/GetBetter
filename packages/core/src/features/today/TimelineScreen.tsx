import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dayKey } from '@/db';
import { parseDay, relativeDay, shiftDay } from '@/features/shared/days';
import { formatLongDate, formatTime, useI18n } from '@/i18n';
import { MIN_TEXT_CONTRAST, ensureContrast, moduleBase, useTheme, type Theme } from '@/theme';
import { flatten } from '@/theme/contrast';
import { Button, FlashRing, Header, Icon, Screen, Text, useSwipeSteps } from '@/ui';

import {
  AllDayLane,
  DayRow,
  EmptyRow,
  THREAD_GUTTER,
  THREAD_INDENT,
  THREAD_RAIL,
  THREAD_TIME,
  spanText,
  type DayEntry,
} from './DayThread';
import { minutesLeftOf, minutesUntilOf } from './threadState';
import {
  TIMELINE_HOUR,
  minutesIn,
  offsetOf,
  placeDay,
  scrollTargetOf,
  type Placement,
} from './timeline';
import { useNow } from '@/features/weather/time';

import { useDayThread } from './useDayThread';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/u;
const GRID_HEIGHT = 24 * TIMELINE_HOUR;
/** Die Mitte der Schiene, von links gemessen — dort sitzen Linie und Punkte. */
const RAIL_CENTER = THREAD_TIME + THREAD_GUTTER + THREAD_RAIL / 2;
/** So viel Luft bleibt zwischen der Jetzt-Zeit und einer Stunde, die ihr ausweicht. */
const LABEL_CLEARANCE = 2;
/** So viele Zeilen darf ein Titel hoechstens nehmen, auch in einer langen Karte. */
const MAX_TITLE_LINES = 3;
/** Luft zwischen zwei Karten, die aneinanderstossen. */
const CARD_GAP = 3;
/** Die Uhr des Bands: Jetzt-Linie und „in 20 Min.“ ruecken alle zehn Sekunden nach. */
const NOW_TICK_MS = 10_000;
/** Wie leise die zweite Zeile auf dem Gruen ist, als Hex-Deckkraft — mindestens lesbar. */
const LIVE_DETAIL_ALPHA = 'B3';

type Timed = DayEntry & { at: string };

const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/**
 * Der grosse Zeitstrahl: der ganze Tag als Stundenraster, zum Rollen. Er
 * zeigt dasselbe wie das Band auf der Startseite (`useDayThread`), nur alles —
 * auch was heute schon vorbei ist — und jede Karte so hoch, wie sie dauert.
 * Oben das Ganztaegige und was keine Uhrzeit hat, darunter die Stunden, dazu
 * die Jetzt-Linie. Wischen blaettert den Tag, oben links geht es zurueck.
 *
 * Geoeffnet mit `/timeline?day=YYYY-MM-DD&focus=<schluessel>`: er rollt zur
 * angetippten Karte und hebt sie hervor, sonst zu jetzt.
 */
export function TimelineScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ day?: string; focus?: string }>();
  const today = dayKey();

  const [day, setDay] = useState(() =>
    typeof params.day === 'string' && DAY_KEY.test(params.day) ? params.day : today,
  );
  // Die angetippte Karte gilt nur fuer den Tag, an dem sie angetippt wurde.
  const [focus, setFocus] = useState<string | null>(() =>
    typeof params.focus === 'string' && params.focus.length > 0 ? params.focus : null,
  );
  const band = useDayThread(day, { full: true });
  const scrollRef = useRef<ScrollView>(null);
  const [gridTop, setGridTop] = useState<number | null>(null);
  // Einmal je Tag rollen — sonst sprang er bei jedem Abgleich zurueck.
  const scrolledFor = useRef<string | null>(null);

  function go(next: string) {
    setDay(next);
    setFocus(null);
  }

  /** Nach links wischen heisst morgen, nach rechts gestern — wie auf der Startseite. */
  const swipe = useSwipeSteps((direction) => go(shiftDay(direction, parseDay(day))));

  const dayStart = parseDay(day);
  // Die Uhr tickt alle zehn Sekunden — die Jetzt-Linie wandert durchs Raster.
  const tick = useNow(NOW_TICK_MS);
  const now = new Date(tick);
  const nowIso = now.toISOString();
  const nowMinutes = band.isToday ? Math.floor(minutesIn(nowIso, dayStart)) : null;
  const timed = band.entries.filter((entry): entry is Timed => Boolean(entry.at));
  const untimed = band.entries.filter((entry) => !entry.at);
  const placed = placeDay(timed, dayStart);
  const byKey = new Map(timed.map((entry) => [entry.key, entry]));

  const focused = focus ? placed.find((placement) => placement.key === focus) : undefined;
  // Eine angetippte Karte ohne Uhrzeit steht oben — dann bleibt er oben.
  const target =
    focus !== null && !focused
      ? null
      : scrollTargetOf(focused?.start ?? null, nowMinutes, placed[0]?.start ?? null);
  const scrollKey = `${day}|${focus ?? ''}`;

  useEffect(() => {
    if (!band.ready || gridTop === null || scrolledFor.current === scrollKey) return;
    const y = target === null ? 0 : gridTop + target;
    const timer = setTimeout(() => {
      scrolledFor.current = scrollKey;
      scrollRef.current?.scrollTo({ y, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [band.ready, gridTop, scrollKey, target]);

  const empty = band.entries.length === 0 && band.allDay.length === 0;

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <Header
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          overline={formatLongDate(language, dayStart.toISOString())}
          title={relativeDay(t, language, day)}
          {...(band.isToday
            ? {}
            : {
                right: (
                  <Button
                    label={t('day.today')}
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    onPress={() => go(today)}
                  />
                ),
              })}
        />
      }
    >
      <Animated.View style={[styles.fill, swipe.style]} {...swipe.panHandlers}>
        {/* Das Ganztaegige steht fest oben — das Raster rollt darunter durch. */}
        {band.allDay.length > 0 ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.edge,
              paddingTop: theme.spacing.xs,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.colors.border,
            }}
          >
            <AllDayLane entries={band.allDay} />
          </View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.edge,
            paddingTop: theme.spacing.xs,
            paddingBottom: theme.spacing.xl + insets.bottom,
            gap: theme.spacing.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {untimed.length > 0 ? (
            <View>
              <Text
                variant="overline"
                tone="muted"
                style={{ marginLeft: THREAD_INDENT, marginBottom: theme.spacing.sm }}
              >
                {t('today.thread.untimed')}
              </Text>
              {untimed.map((entry) => (
                <DayRow key={entry.key} entry={entry} time="" live={false} />
              ))}
            </View>
          ) : null}
          {empty && band.ready ? <EmptyRow /> : null}

          <View
            onLayout={(event) => setGridTop(event.nativeEvent.layout.y)}
            style={{ height: GRID_HEIGHT, marginTop: theme.spacing.sm }}
          >
            <HourLines nowY={nowMinutes === null ? null : offsetOf(nowMinutes)} />
            <View style={[styles.cards, { left: THREAD_INDENT }]}>
              {placed.map((placement) => {
                const entry = byKey.get(placement.key);
                if (!entry) return null;
                const live =
                  Boolean(entry.until) && entry.at <= nowIso && nowIso < (entry.until ?? '');
                // Heute sagt die Karte, wie lange sie noch geht oder wann sie beginnt.
                const minutes = !band.isToday
                  ? null
                  : live
                    ? minutesLeftOf(entry, now)
                    : minutesUntilOf(entry, now);
                return (
                  <GridCard
                    key={placement.key}
                    entry={entry}
                    placement={placement}
                    live={band.isToday && live}
                    // Bis wohin die laufende Karte schon wieder Papier ist: die Jetzt-Linie.
                    elapsed={
                      band.isToday && live && nowMinutes !== null
                        ? offsetOf(nowMinutes) - placement.top
                        : null
                    }
                    focused={placement.key === focus}
                    countdown={minutes === null ? null : spanText(t, minutes, live ? 'left' : 'in')}
                  />
                );
              })}
            </View>
            {placed.map((placement) => {
              const entry = byKey.get(placement.key);
              return entry ? (
                <RailDot key={placement.key} placement={placement} moduleId={entry.moduleId} />
              ) : null;
            })}
            {nowMinutes === null ? null : (
              <NowLine top={offsetOf(nowMinutes)} label={formatTime(language, nowIso)} />
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}

/**
 * Die Stunden: links die Zeit, quer eine feine Linie, dazu die Schiene ueber
 * den ganzen Tag. Jede Stunde traegt ihre Zahl, auch Mitternacht; liegt die
 * Jetzt-Zeit (`nowY`) zu nah, weicht die Zahl ein Stueck von ihr weg — die
 * Linie bleibt, wo sie ist.
 */
function HourLines({ nowY }: { nowY: number | null }) {
  const theme = useTheme();
  const half = theme.lineHeight.caption / 2;
  const clearance = theme.lineHeight.caption + LABEL_CLEARANCE;

  return (
    <>
      <View
        style={[
          styles.railLine,
          { left: RAIL_CENTER - 0.75, backgroundColor: theme.colors.border },
        ]}
      />
      {Array.from({ length: 24 }, (_, hour) => {
        const y = hour * TIMELINE_HOUR;
        const distance = nowY === null ? Infinity : y - nowY;
        // Vor der Jetzt-Zeit nach oben, danach nach unten.
        const shift =
          Math.abs(distance) < clearance
            ? (distance <= 0 ? -1 : 1) * (clearance - Math.abs(distance))
            : 0;
        return (
          <View
            key={hour}
            style={[
              styles.hour,
              { top: hour * TIMELINE_HOUR - half, height: theme.lineHeight.caption },
            ]}
          >
            <Text
              variant="caption"
              tone="faint"
              style={[
                styles.hourLabel,
                {
                  fontSize: theme.fontSize.caption,
                  lineHeight: theme.lineHeight.caption,
                  fontWeight: theme.fontWeight.semibold,
                  transform: [{ translateY: shift }],
                },
              ]}
            >
              {clock(hour)}
            </Text>
            <View
              style={[
                styles.hourLine,
                { marginLeft: THREAD_INDENT - THREAD_TIME, backgroundColor: theme.colors.border },
              ]}
            />
          </View>
        );
      })}
    </>
  );
}

/**
 * Wie eine Karte ihre Hoehe aufteilt: Luft oben und unten, so viele
 * Titelzeilen, wie ueber der Zeit Platz haben — nie so viele, dass die Zeit an
 * den Rand rutscht. Ist die Karte zu niedrig fuer zwei Zeilen, steht alles in
 * einer, mittig. `dotTop`: wo der Punkt auf der Schiene sitzt — auf der Hoehe
 * der ersten Zeile.
 */
function cardLayoutOf(theme: Theme, height: number) {
  const face = height - CARD_GAP;
  const padding = theme.spacing.md;
  const detail = theme.spacing.xs + theme.lineHeight.caption;
  const inner = face - padding * 2;
  const roomy = inner >= theme.lineHeight.md + detail;
  const titleLines = roomy
    ? Math.min(MAX_TITLE_LINES, Math.max(1, Math.floor((inner - detail) / theme.lineHeight.md)))
    : 1;
  return {
    roomy,
    titleLines,
    padding: roomy ? padding : 0,
    dotTop: roomy ? padding + (theme.lineHeight.md - DOT) / 2 : (face - DOT) / 2,
  };
}

/** Der Punkt auf der Schiene, wo eine Karte beginnt — in der Farbe ihrer Funktion. */
function RailDot({ placement, moduleId }: { placement: Placement; moduleId: string }) {
  const theme = useTheme();
  const { dotTop } = cardLayoutOf(theme, placement.height);
  return (
    <View
      style={[
        styles.dot,
        {
          top: placement.top + dotTop,
          left: RAIL_CENTER - DOT / 2,
          borderColor: moduleBase(theme, moduleId),
          backgroundColor: theme.colors.surface,
        },
      ]}
    />
  );
}

const DOT = 9;
const PIN = 11;

/** Die Jetzt-Linie: Uhrzeit links, Nadel auf der Schiene, Signalfarbe quer. Faengt keine Tipps ab. */
function NowLine({ top, label }: { top: number; label: string }) {
  const theme = useTheme();
  const signal = theme.colors.accentMark;
  const height = theme.lineHeight.caption;

  return (
    <View style={[styles.now, { top: top - height / 2, height, gap: THREAD_GUTTER }]}>
      <Text
        variant="caption"
        style={{
          width: THREAD_TIME,
          textAlign: 'right',
          fontSize: theme.fontSize.caption,
          lineHeight: theme.lineHeight.caption,
          fontWeight: theme.fontWeight.bold,
          color: theme.colors.text,
        }}
      >
        {label}
      </Text>
      <View style={styles.pinBox}>
        <View
          style={[
            styles.pin,
            {
              backgroundColor: signal,
              borderColor: theme.colors.background,
              boxShadow: `0 0 0 1.5px ${signal}`,
            },
          ]}
        />
      </View>
      <LinearGradient
        colors={[signal, `${signal}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.nowLine}
      />
    </View>
  );
}

/**
 * Eine Karte im Raster, so hoch, wie sie dauert. Ein Tipp oeffnet die
 * Funktion; hat sie einen Kreis, hakt der ab und nur der Text oeffnet. Die
 * Karte, die gerade laeuft, ist umgekehrtes Papier wie im Band; die
 * angetippte leuchtet kurz auf.
 */
function GridCard({
  entry,
  placement,
  live,
  elapsed,
  focused,
  countdown,
}: {
  entry: Timed;
  placement: Placement;
  live: boolean;
  /**
   * Bei der laufenden Karte: wie weit von oben sie schon vorbei ist, in Punkten
   * — bis zur Jetzt-Linie wird sie in Echtzeit wieder Papier.
   */
  elapsed: number | null;
  focused: boolean;
  /**
   * Heute statt der Uhrzeit: „noch 40 Min.“ bei der laufenden Karte, „in 20
   * Min.“ bei einer, die noch kommt — die Uhrzeit steht schon am Raster.
   */
  countdown: string | null;
}) {
  const theme = useTheme();
  const { language } = useI18n();
  const area = moduleBase(theme, entry.moduleId);
  const { roomy, titleLines, padding } = cardLayoutOf(theme, placement.height);
  const time = entry.until
    ? `${formatTime(language, entry.at)}–${formatTime(language, entry.until)}`
    : formatTime(language, entry.at);
  const shown = countdown ?? time;
  const detail = [shown, entry.meta].filter(Boolean).join(' · ');
  const width = 100 / placement.columns;

  // Der laufende Termin ist Better-Gruen, wie im Band: der Akzent als Flaeche,
  // darauf `textOnAccent`, die zweite Zeile etwas leiser, aber lesbar.
  const onLive = theme.colors.textOnAccent;
  const liveDetail = ensureContrast(
    flatten(`${onLive}${LIVE_DETAIL_ALPHA}`, theme.colors.accent),
    theme.colors.accent,
    MIN_TEXT_CONTRAST,
  );
  const label = [entry.title, time, countdown, entry.meta].filter(Boolean).join(', ');
  const faceHeight = placement.height - CARD_GAP;

  /** Die Schrift auf dunklem (laeuft) oder hellem Grund. */
  const textOf = (onDark: boolean) => (
    <View style={[styles.grow, roomy ? null : [styles.inline, { gap: theme.spacing.sm }]]}>
      <Text
        variant="label"
        numberOfLines={titleLines}
        style={[
          styles.shrink,
          {
            fontSize: theme.fontSize.md,
            lineHeight: theme.lineHeight.md,
            fontWeight: theme.fontWeight.semibold,
            letterSpacing: theme.tracking.body,
            color: onDark ? onLive : theme.colors.text,
          },
        ]}
      >
        {entry.title}
      </Text>
      <Text
        variant="caption"
        numberOfLines={1}
        style={{
          fontSize: theme.fontSize.caption,
          lineHeight: theme.lineHeight.caption,
          fontWeight: theme.fontWeight.medium,
          color: onDark ? liveDetail : theme.colors.textMuted,
          ...(roomy ? { marginTop: theme.spacing.xs } : { marginLeft: 'auto', flexShrink: 0 }),
        }}
      >
        {roomy ? detail : shown}
      </Text>
    </View>
  );

  /** Kreis oder Symbol — als Knopf nur in der echten Karte, nie in ihrer Kopie. */
  const leadOf = (onDark: boolean, interactive: boolean) => {
    const tick = { borderColor: onDark ? onLive : theme.colors.textFaint };
    if (entry.onToggle && interactive) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={entry.title}
          onPress={entry.onToggle}
          hitSlop={theme.spacing.md}
          style={[styles.tick, tick]}
        />
      );
    }
    if (entry.onToggle) return <View style={[styles.tick, tick]} />;
    return <Icon name={entry.icon} size={16} color={onDark ? onLive : area} />;
  };

  const text = textOf(live);
  const lead = leadOf(live, true);
  const wiped = live && elapsed !== null ? Math.max(0, Math.min(elapsed, faceHeight)) : 0;
  // Was schon vorbei ist, wird in Echtzeit wieder Papier: eine helle Kopie der
  // Karte, unten an der Jetzt-Linie abgeschnitten. Sie nimmt keine Tipps an.
  const wipe =
    wiped > 0 ? (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.wipe,
          {
            height: wiped,
            borderTopLeftRadius: theme.radii.item,
            borderTopRightRadius: theme.radii.item,
          },
        ]}
      >
        <View
          style={[
            styles.wipeFace,
            roomy ? styles.top : styles.middle,
            {
              height: faceHeight,
              borderRadius: theme.radii.item,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: padding,
              gap: theme.spacing.sm,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View style={[styles.lead, { height: theme.lineHeight.md }]}>{leadOf(false, false)}</View>
          {textOf(false)}
        </View>
      </View>
    ) : null;

  const face = {
    borderRadius: theme.radii.item,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: padding,
    backgroundColor: live ? theme.colors.accent : theme.colors.surface,
    gap: theme.spacing.sm,
  };
  // Die angetippte Karte leuchtet kurz auf — kein Rahmen, der stehen bleibt.
  const flash = focused ? <FlashRing radius={theme.radii.item} /> : null;

  const content = entry.onToggle ? (
    <View
      style={[
        styles.face,
        roomy ? styles.top : styles.middle,
        live ? theme.elevation.raised : theme.elevation.card,
        face,
      ]}
    >
      <View style={[styles.lead, { height: theme.lineHeight.md }]}>{lead}</View>
      {entry.onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={entry.onPress}
          style={({ pressed }) => [styles.grow, { opacity: pressed ? 0.6 : 1 }]}
        >
          {text}
        </Pressable>
      ) : (
        text
      )}
      {wipe}
      {flash}
    </View>
  ) : (
    <Pressable
      accessibilityRole={entry.onPress ? 'button' : undefined}
      accessibilityLabel={label}
      disabled={!entry.onPress}
      onPress={entry.onPress}
      style={({ pressed }) => [
        styles.face,
        roomy ? styles.top : styles.middle,
        live ? theme.elevation.raised : theme.elevation.card,
        face,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.lead, { height: theme.lineHeight.md }]}>{lead}</View>
      {text}
      {wipe}
      {flash}
    </Pressable>
  );

  return (
    <View
      style={[
        styles.slot,
        {
          top: placement.top,
          height: placement.height - CARD_GAP,
          left: `${width * placement.column}%`,
          width: `${width}%`,
          paddingLeft: placement.column > 0 ? CARD_GAP : 0,
        },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5 },
  hour: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  hourLabel: { width: THREAD_TIME, textAlign: 'right' },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth },
  cards: { position: 'absolute', top: 0, bottom: 0, right: 0 },
  slot: { position: 'absolute' },
  wipe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  wipeFace: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row' },
  face: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  top: { alignItems: 'flex-start' },
  middle: { alignItems: 'center' },
  lead: { justifyContent: 'center' },
  tick: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.7 },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: 999, borderWidth: 2 },
  now: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  pinBox: { width: THREAD_RAIL, alignItems: 'center' },
  pin: { width: PIN, height: PIN, borderRadius: 999, borderWidth: 2.5 },
  nowLine: { flex: 1, height: 1.5 },
});
