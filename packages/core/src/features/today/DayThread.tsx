import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { formatTime, useI18n } from '@/i18n';
import { MIN_TEXT_CONTRAST, ensureContrast, moduleBase, useTheme } from '@/theme';
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
  /** Kurzwort rechts: woher der Eintrag kommt. Fehlt es, hat der Titel die Breite. */
  tag?: string;
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
  /** Statt des Streifens ein Symbol, etwa das Geschenk beim Geburtstag. */
  icon?: IconName;
  /** Kurzwort rechts: woher der Eintrag kommt. */
  tag?: string;
  /** Zweite Zeile, etwa „wird 36 · Heute“. */
  meta?: string;
  onPress?: () => void;
};

/** So viele Eintraege zeigt die Ganztags-Karte, bevor sie zuklappt. */
const ALL_DAY_VISIBLE = 3;
/** Die Spalte fuer Farbstreifen oder Symbol in der Ganztags-Karte. */
const LANE_LEAD = 16;

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
  next,
}: {
  entries: readonly DayEntry[];
  /** Ganztaegiges steht als eigene Zeile ueber dem Band. */
  allDay?: readonly AllDayEntry[];
  now?: Date;
  /** Die Jetzt-Marke gehoert zu heute. An anderen Tagen gibt es kein Jetzt. */
  showNow?: boolean;
  /** Der naechste Tag, ganz unten unter einem roten Strich. */
  next?: NextDay;
}) {
  const { language } = useI18n();
  const lane = allDay.length > 0 ? <AllDayLane entries={allDay} /> : null;
  const peek = next ? <NextDayPeek {...next} /> : null;

  // Auch ohne Eintraege bleibt der Faden stehen — blass, mit der Uhrzeit und
  // einem Satz. So springt die Startseite nicht, wenn der erste Termin kommt.
  if (entries.length === 0) {
    return (
      <View>
        {lane}
        {showNow ? <NowMark now={now} muted={!lane} /> : null}
        {/* Heute steht nach der Jetzt-Linie immer etwas — notfalls „Keine Einträge“. */}
        {showNow || !lane ? <EmptyRow /> : null}
        {peek}
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
      {/* Nach der Jetzt-Linie kommt nichts mehr: dann sagt es das Band. */}
      {passed === timed.length && untimed.length === 0 ? <EmptyRow /> : null}
      {untimed.map((entry) => (
        <Row key={entry.key} entry={entry} time="" live={false} />
      ))}
      {peek}
    </View>
  );
}

/** Der naechste Tag unter dem Band: Name, Eintraege, und wohin ein Tipp fuehrt. */
export type NextDay = {
  /** „Morgen“ — oder der Tag nach dem gezeigten. */
  label: string;
  entries: readonly DayEntry[];
  onPress: () => void;
};

/**
 * Wie stark die Eintraege des naechsten Tages noch zu sehen sind. Sie laufen
 * bewusst aus: eine Vorschau, kein Inhalt — lesbar wird der Tag mit einem Tipp.
 */
const NEXT_FADE = [0.55, 0.25] as const;
/** Deckkraft des roten Strichs, als Hex fuer `#RRGGBBAA`. */
const NEXT_LINE_ALPHA = '8C';

/**
 * Das Ende des Tages: ein leicht roter Strich, darunter „Morgen“ und die
 * ersten ein, zwei Eintraege, die immer blasser werden.
 */
function NextDayPeek({ label, entries, onPress }: NextDay) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const shown = entries.slice(0, NEXT_FADE.length);
  const line = `${theme.colors.danger}${NEXT_LINE_ALPHA}`;
  const summary = [label, ...shown.map((entry) => entry.title)].join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown.length > 0 ? summary : `${label}, ${t('today.thread.emptyDay')}`}
      onPress={onPress}
      style={({ pressed }) => ({ paddingTop: theme.spacing.sm, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={[styles.row, styles.nowRow, { paddingBottom: theme.spacing.xs }]}>
        <View style={styles.time} />
        <View style={styles.railNow}>
          <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
          <View style={[styles.dot, { borderColor: line, backgroundColor: theme.colors.surface }]} />
        </View>
        <LinearGradient
          colors={[line, `${theme.colors.danger}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nowLine}
        />
      </View>
      <View style={[styles.row, { paddingBottom: theme.spacing.sm }]}>
        <View style={styles.time} />
        <View style={styles.rail}>
          <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
        </View>
        <Text variant="overline" tone="muted" numberOfLines={1} style={styles.grow}>
          {label}
        </Text>
      </View>
      {shown.length === 0 ? (
        <View style={{ opacity: NEXT_FADE[0] }}>
          <EmptyRow />
        </View>
      ) : (
        shown.map((entry, index) => (
          <View key={entry.key} style={{ opacity: NEXT_FADE[index] }}>
            <Row
              entry={entry}
              time={entry.at ? formatTime(language, entry.at) : ''}
              live={false}
            />
          </View>
        ))
      )}
    </Pressable>
  );
}

/**
 * Die Marke fuer die aktuelle Uhrzeit — die einzige Signalfarbe im Band.
 * `muted` nimmt die Farbe zurueck, wenn heute nichts ansteht.
 */
function NowMark({ now, muted = false }: { now: Date; muted?: boolean }) {
  const theme = useTheme();
  const { language } = useI18n();
  const signal = muted ? theme.colors.borderStrong : theme.colors.accentMark;

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
 * Das Ganztaegige, ganz oben am Band: eine Karte mit einer Zeile je Eintrag,
 * untereinander statt als Pillen nebeneinander. Ab vier Eintraegen stehen
 * zwei da und eine Zeile „2 weitere“ — nie eine, die nur einen versteckt.
 */
function AllDayLane({ entries }: { entries: readonly AllDayEntry[] }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const collapsible = entries.length > ALL_DAY_VISIBLE;
  const shown = collapsible && !expanded ? entries.slice(0, ALL_DAY_VISIBLE - 1) : entries;
  const hidden = entries.length - shown.length;
  // Die Linien beginnen unter dem Titel, nicht unter der Farbe.
  const textInset = theme.spacing.md + LANE_LEAD + theme.spacing.sm;
  const separator = (
    <View
      style={[styles.laneSeparator, { marginLeft: textInset, backgroundColor: theme.colors.border }]}
    />
  );

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
      <View
        style={[
          styles.grow,
          theme.elevation.card,
          { borderRadius: theme.radii.item, backgroundColor: theme.colors.surface },
        ]}
      >
        {shown.map((entry, index) => (
          <Fragment key={entry.key}>
            {index > 0 ? separator : null}
            <AllDayRow entry={entry} />
          </Fragment>
        ))}
        {collapsible ? (
          <>
            {separator}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded((value) => !value)}
              style={({ pressed }) => [
                styles.laneRow,
                { paddingLeft: textInset, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text variant="label" tone="accent" style={{ fontWeight: theme.fontWeight.semibold }}>
                {expanded ? t('today.allDayLess') : t('today.allDayMore', { count: hidden })}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Eine Zeile der Ganztags-Karte — gebaut wie eine Karte im Band: Farbe oder
 * Symbol, Titel, rechts woher, darunter die zweite Zeile. So sieht ein
 * Geburtstag heute genauso aus wie einer in fuenf Tagen.
 */
function AllDayRow({ entry }: { entry: AllDayEntry }) {
  const theme = useTheme();
  const { t } = useI18n();
  const label = [entry.title, entry.meta ?? t('today.allDay')].join(' — ');

  return (
    <Pressable
      accessibilityRole={entry.onPress ? 'button' : undefined}
      accessibilityLabel={label}
      disabled={!entry.onPress}
      onPress={entry.onPress}
      style={({ pressed }) => [
        styles.card,
        { padding: theme.spacing.md, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.head, { gap: theme.spacing.sm }]}>
        <View style={[styles.laneLead, { height: theme.lineHeight.md }]}>
          {entry.icon ? (
            <Icon name={entry.icon} size={16} color={entry.color} />
          ) : (
            <View style={[styles.laneBar, { backgroundColor: entry.color }]} />
          )}
        </View>
        <Text
          variant="label"
          numberOfLines={2}
          style={[
            styles.title,
            {
              fontSize: theme.fontSize.md,
              lineHeight: theme.lineHeight.md,
              fontWeight: theme.fontWeight.semibold,
              letterSpacing: theme.tracking.body,
            },
          ]}
        >
          {entry.title}
        </Text>
        {entry.tag ? (
          <View style={[styles.lineBox, styles.tag, { height: theme.lineHeight.md }]}>
            <Text
              variant="overline"
              tone="faint"
              numberOfLines={1}
              style={{ letterSpacing: theme.tracking.tag }}
            >
              {entry.tag}
            </Text>
          </View>
        ) : null}
      </View>
      {entry.meta ? (
        <Text
          variant="label"
          tone="muted"
          numberOfLines={2}
          style={{ marginTop: theme.spacing.xs, fontWeight: theme.fontWeight.regular }}
        >
          {entry.meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * „Keine Einträge“: dieselbe Schiene, eine blasse Karte ohne Schatten — nach
 * der Jetzt-Linie, an einem leeren Tag und unter „Morgen“.
 */
function EmptyRow() {
  const theme = useTheme();
  const { t } = useI18n();
  const label = t('today.thread.emptyDay');

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

  // Die aktive Karte ist umgekehrtes Papier; im Hellen traegt sie den Akzent —
  // so weit aufgehellt, dass Kurzwort und Symbol darauf lesbar bleiben.
  const signalOnLive = ensureContrast(
    dark ? theme.colors.onInverse : theme.colors.accent,
    theme.colors.inverse,
    MIN_TEXT_CONTRAST,
  );
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
        <View style={[styles.lineBox, { height: theme.lineHeight.md }]}>
          {entry.onToggle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={entry.title}
              onPress={entry.onToggle}
              hitSlop={theme.spacing.md}
              style={[
                styles.tick,
                { borderColor: live ? theme.colors.onInverse : theme.colors.textFaint },
              ]}
            />
          ) : (
            <Icon name={entry.icon} size={16} color={iconColor} />
          )}
        </View>
        <Text
          variant="label"
          numberOfLines={2}
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
        {entry.tag ? (
          <View style={[styles.lineBox, styles.tag, { height: theme.lineHeight.md }]}>
            <Text
              variant="overline"
              numberOfLines={1}
              style={{ letterSpacing: theme.tracking.tag, color: tagColor }}
            >
              {entry.tag}
            </Text>
          </View>
        ) : null}
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
  // Oben ausgerichtet: bricht ein langer Titel um, bleiben Symbol und
  // Kurzwort auf der Hoehe der ersten Zeile.
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  lineBox: { justifyContent: 'center' },
  tick: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.7 },
  title: { flexShrink: 1 },
  tag: { marginLeft: 'auto', flexShrink: 0 },
  laneIcon: { alignItems: 'flex-end' },
  laneRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  laneLead: { width: LANE_LEAD, alignItems: 'center', justifyContent: 'center' },
  laneBar: { width: 4, height: 18, borderRadius: 999 },
  laneSeparator: { height: StyleSheet.hairlineWidth },
});
