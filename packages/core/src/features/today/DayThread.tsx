import { LinearGradient } from 'expo-linear-gradient';
import { Fragment } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { formatTime, useI18n } from '@/i18n';
import { moduleBase, useTheme } from '@/theme';
import { Icon, Text, usePressScale, type IconName } from '@/ui';

/** Eine Zeile im Tagesband. Woher sie kommt, sagt `moduleId` ueber die Farbe. */
export type DayEntry = {
  key: string;
  /** Bestimmt die Bereichsfarbe von Punkt und Symbol. */
  moduleId: string;
  icon: IconName;
  title: string;
  meta?: string;
  /** ISO-Zeitpunkt, wenn der Eintrag eine Uhrzeit hat. */
  at?: string | null;
  /** Kurzwort rechts: woher der Eintrag kommt. */
  tag: string;
  /** Oeffnet die Funktion. */
  onPress?: () => void;
  /**
   * Abhaken, bezahlen, erledigen — der Kreis links. Wer ihn hat, dessen Karte
   * ist selbst nicht drueckbar: ein Knopf im Knopf waere im Browser ungueltig.
   */
  onToggle?: () => void;
};

/**
 * Was den ganzen Tag gilt: ein ganztaegiger Termin, ein Geburtstag. Es hat
 * keine Uhrzeit und steht darum nicht im Band, sondern als Zeile darueber.
 */
export type AllDayEntry = {
  key: string;
  title: string;
  /** Die Farbe des Punkts — die des Termins oder des Bereichs. */
  color: string;
  /** Statt des Punkts ein Symbol, etwa das Geschenk beim Geburtstag. */
  icon?: IconName;
  onPress?: () => void;
};

/** Zeitspalte, Schiene und Abstand — so weit ruecken die Karten ein. */
const TIME = 44;
const RAIL = 18;
/** Abstand zwischen Zeitspalte, Schiene und Karte — im Entwurf 10 px. */
const GUTTER = 10;
export const THREAD_INDENT = TIME + RAIL + GUTTER * 2;

/**
 * Der Tag als ein Faden statt als Kachelbrett.
 *
 * Wecker, Termin, Aufgabe, Rechnung und Einkauf haengen an derselben Achse,
 * mit einer Marke fuer *jetzt*. Was eine Uhrzeit hat, steht an ihr; der Rest
 * folgt darunter, ehrlich ohne erfundene Zeit.
 */
export function DayThread({
  entries,
  allDay = [],
  now = new Date(),
  showNow = true,
}: {
  entries: readonly DayEntry[];
  /** Ganztaegiges steht als eigene Zeile ueber dem Band. */
  allDay?: readonly AllDayEntry[];
  now?: Date;
  /** Die Jetzt-Marke gehoert zu heute. An anderen Tagen gibt es kein Jetzt. */
  showNow?: boolean;
}) {
  const { language } = useI18n();
  const lane = allDay.length > 0 ? <AllDayLane entries={allDay} /> : null;

  // Auch ohne Eintraege bleibt der Faden stehen — blass, mit der Uhrzeit und
  // einem Satz. So springt die Startseite nicht, wenn der erste Termin kommt.
  if (entries.length === 0) {
    return (
      <View>
        {lane}
        {showNow ? <NowMark now={now} muted={!lane} /> : null}
        {lane ? null : <EmptyRow today={showNow} />}
      </View>
    );
  }

  const timed = entries
    .filter((entry): entry is DayEntry & { at: string } => Boolean(entry.at))
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
  const untimed = entries.filter((entry) => !entry.at);

  const nowIso = now.toISOString();
  const nextIndex = timed.findIndex((entry) => entry.at >= nowIso);
  // -1 trifft keinen Platz: an einem anderen Tag faellt die Marke ganz weg.
  const passed = showNow ? (nextIndex === -1 ? timed.length : nextIndex) : -1;

  return (
    <View>
      {lane}
      {timed.map((entry, index) => (
        <Fragment key={entry.key}>
          {index === passed ? <NowMark now={now} /> : null}
          <Row entry={entry} time={formatTime(language, entry.at)} live={index === passed} />
        </Fragment>
      ))}
      {passed === timed.length ? <NowMark now={now} /> : null}
      {untimed.map((entry) => (
        <Row key={entry.key} entry={entry} time="" live={false} />
      ))}
    </View>
  );
}

/**
 * Die Marke fuer die aktuelle Uhrzeit — die einzige Signalfarbe im Band.
 * `muted` nimmt die Farbe zurueck, wenn heute nichts ansteht.
 */
function NowMark({ now, muted = false }: { now: Date; muted?: boolean }) {
  const theme = useTheme();
  const { language } = useI18n();
  const signal = muted ? theme.colors.borderStrong : theme.colors.accent;

  return (
    <View
      style={[
        styles.row,
        styles.nowRow,
        { paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.sm },
      ]}
    >
      <Text
        variant="caption"
        style={[
          styles.time,
          {
            fontSize: theme.fontSize.caption,
            lineHeight: theme.lineHeight.caption,
            fontWeight: theme.fontWeight.bold,
            color: muted ? theme.colors.textFaint : theme.colors.text,
          },
        ]}
      >
        {formatTime(language, now.toISOString())}
      </Text>
      <View style={styles.railNow}>
        <View style={[styles.line, { backgroundColor: signal }]} />
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
 * Die Zeile fuer den ganzen Tag, ganz oben am Band — wie die Ganztags-Leiste
 * im Kalender. Links statt einer Uhrzeit ein Kalenderblatt, rechts je Eintrag
 * eine Pille; sie brechen um, statt seitlich zu rollen.
 */
function AllDayLane({ entries }: { entries: readonly AllDayEntry[] }) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.row, { paddingBottom: theme.spacing.sm }]}>
      <View
        accessible
        accessibilityLabel={t('today.allDayLane')}
        style={[styles.time, styles.laneIcon, { paddingTop: theme.spacing.md }]}
      >
        <Icon name="calendar" size={14} color={theme.colors.textFaint} />
      </View>
      <View style={styles.rail}>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
        <View
          style={[
            styles.dot,
            {
              marginTop: theme.spacing.lg,
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
            },
          ]}
        />
      </View>
      <View style={[styles.grow, styles.pills, { gap: theme.spacing.sm }]}>
        {entries.map((entry) => (
          <Pressable
            key={entry.key}
            accessibilityRole={entry.onPress ? 'button' : undefined}
            accessibilityLabel={`${entry.title} — ${t('today.allDay')}`}
            disabled={!entry.onPress}
            onPress={entry.onPress}
            style={({ pressed }) => [
              styles.pill,
              theme.elevation.card,
              {
                gap: theme.spacing.xs,
                borderRadius: theme.radii.pill,
                paddingHorizontal: theme.spacing.md,
                backgroundColor: theme.colors.surface,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {entry.icon ? (
              <Icon name={entry.icon} size={14} color={entry.color} />
            ) : (
              <View style={[styles.pillDot, { backgroundColor: entry.color }]} />
            )}
            <Text
              variant="label"
              numberOfLines={1}
              style={[styles.title, { fontWeight: theme.fontWeight.semibold }]}
            >
              {entry.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Der leere Tag: dieselbe Schiene, eine blasse Karte ohne Schatten. */
function EmptyRow({ today }: { today: boolean }) {
  const theme = useTheme();
  const { t } = useI18n();
  // An einem anderen Tag waere „heute“ gelogen — dort steht die kurze Fassung.
  const label = t(today ? 'today.thread.empty' : 'today.thread.emptyDay');

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.row, { paddingBottom: theme.spacing.sm }]}
    >
      <View style={styles.time} />
      <View style={styles.rail}>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
        <View
          style={[
            styles.dot,
            {
              marginTop: theme.spacing.lg,
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
            },
          ]}
        />
      </View>
      <View
        style={[
          styles.grow,
          styles.card,
          {
            borderRadius: theme.radii.item,
            padding: theme.spacing.md,
            backgroundColor: theme.colors.surfaceMuted,
          },
        ]}
      >
        <Text variant="label" tone="faint" style={{ fontWeight: theme.fontWeight.medium }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function Row({ entry, time, live }: { entry: DayEntry; time: string; live: boolean }) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);
  const area = moduleBase(theme, entry.moduleId);
  const dark = theme.scheme === 'dark';

  // Die aktive Karte ist umgekehrtes Papier; im Hellen traegt sie Signalgruen.
  const signalOnLive = dark ? theme.colors.onInverse : theme.colors.accent;
  const titleColor = live ? theme.colors.onInverse : theme.colors.text;
  const metaColor = live ? theme.colors.disabledText : theme.colors.textMuted;
  const tagColor = live ? signalOnLive : theme.colors.textFaint;
  const iconColor = live ? signalOnLive : area;
  const pressable = Boolean(entry.onPress) && !entry.onToggle;

  const card = (
    <Animated.View
      style={[
        styles.card,
        live ? theme.elevation.raised : theme.elevation.card,
        {
          borderRadius: theme.radii.item,
          padding: theme.spacing.md,
          backgroundColor: live ? theme.colors.inverse : theme.colors.surface,
          transform: pressable ? [{ scale: press.scale }] : [],
        },
      ]}
    >
      <View style={[styles.head, { gap: theme.spacing.sm }]}>
        {entry.onToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={entry.title}
            onPress={entry.onToggle}
            hitSlop={theme.spacing.md}
            style={[
              styles.tick,
              { borderColor: live ? theme.colors.onInverse : theme.colors.borderStrong },
            ]}
          />
        ) : (
          <Icon name={entry.icon} size={16} color={iconColor} />
        )}
        <Text
          variant="label"
          numberOfLines={1}
          style={[
            styles.title,
            {
              fontSize: theme.fontSize.md,
              lineHeight: theme.lineHeight.md,
              fontWeight: theme.fontWeight.semibold,
              letterSpacing: theme.tracking.body,
              color: titleColor,
            },
          ]}
        >
          {entry.title}
        </Text>
        <Text
          variant="overline"
          numberOfLines={1}
          style={[styles.tag, { letterSpacing: theme.tracking.tag, color: tagColor }]}
        >
          {entry.tag}
        </Text>
      </View>
      {entry.meta ? (
        <Text
          variant="label"
          numberOfLines={2}
          style={{
            marginTop: theme.spacing.xs,
            fontWeight: theme.fontWeight.regular,
            color: metaColor,
          }}
        >
          {entry.meta}
        </Text>
      ) : null}
    </Animated.View>
  );

  return (
    <View style={[styles.row, { paddingBottom: theme.spacing.sm }]}>
      <Text
        variant="caption"
        tone="faint"
        style={[
          styles.time,
          {
            paddingTop: theme.spacing.md,
            fontSize: theme.fontSize.caption,
            lineHeight: theme.lineHeight.caption,
            fontWeight: theme.fontWeight.semibold,
          },
        ]}
      >
        {time}
      </Text>
      <View style={styles.rail}>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
        <View
          style={[
            styles.dot,
            {
              marginTop: theme.spacing.lg,
              borderColor: area,
              backgroundColor: theme.colors.surface,
            },
          ]}
        />
      </View>
      {pressable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={entry.title}
          onPress={entry.onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          style={styles.grow}
        >
          {card}
        </Pressable>
      ) : (
        <View style={styles.grow}>{card}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: GUTTER },
  nowRow: { alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  time: { width: TIME, textAlign: 'right' },
  rail: { width: RAIL, alignItems: 'center' },
  railNow: { width: RAIL, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', top: 0, bottom: 0, width: 1.5 },
  dot: { width: 9, height: 9, borderRadius: 999, borderWidth: 2 },
  pin: { width: 11, height: 11, borderRadius: 999, borderWidth: 2.5 },
  nowLine: { flex: 1, height: 1.5 },
  card: { minHeight: 44, justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center' },
  tick: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.7 },
  title: { flexShrink: 1 },
  tag: { marginLeft: 'auto', flexShrink: 0 },
  laneIcon: { alignItems: 'flex-end' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', minHeight: 34, maxWidth: '100%' },
  pillDot: { width: 8, height: 8, borderRadius: 999 },
});
