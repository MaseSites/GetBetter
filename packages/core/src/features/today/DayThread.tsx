import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { formatTime, useI18n } from '@/i18n';
import {
  MIN_MARK_CONTRAST,
  MIN_TEXT_CONTRAST,
  ensureContrast,
  moduleBase,
  useTheme,
} from '@/theme';
import { flatten } from '@/theme/contrast';
import { Icon, Text, usePressScale, type IconName } from '@/ui';

import { useNow } from '@/features/weather/time';

import {
  minutesLeftOf,
  minutesUntilOf,
  nowIndexOf,
  progressOf,
  threadStates,
  type ThreadState,
} from './threadState';

/** So viel groesser steht ein Termin da, solange er dran ist. */
const LIVE_SCALE = 1.03;
/** Die Uhr des Bands: Jetzt-Linie und „in 20 Min.“ ruecken alle zehn Sekunden nach. */
const NOW_TICK_MS = 10_000;
/** Wie kraeftig die Jetzt-Linie in der laufenden Karte ist, als Hex-Deckkraft. */
const RUNNING_LINE_ALPHA = '4D';
/** Wie leise die zweite Zeile auf dem Gruen ist, als Hex-Deckkraft — mindestens lesbar. */
const LIVE_META_ALPHA = 'B3';

/**
 * „noch 1 Std. 55 Min.“ fuer einen laufenden Termin, „in 20 Min.“ fuer einen,
 * der noch kommt.
 */
export function spanText(
  t: ReturnType<typeof useI18n>['t'],
  minutes: number,
  kind: 'left' | 'in',
): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (kind === 'left') {
    if (hours === 0) return t('today.thread.leftMinutes', { minutes: rest });
    if (rest === 0) return t('today.thread.leftHours', { hours });
    return t('today.thread.leftHoursMinutes', { hours, minutes: rest });
  }
  if (hours === 0) return t('today.thread.inMinutes', { minutes: rest });
  if (rest === 0) return t('today.thread.inHours', { hours });
  return t('today.thread.inHoursMinutes', { hours, minutes: rest });
}

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
  /** Wann er endet — im grossen Zeitstrahl ist die Karte so hoch, wie er dauert. */
  until?: string | null;
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
  /** Die Farbe des Symbols — die des Bereichs. */
  color: string;
  /** Das Symbol links: der Kalender beim Termin, das Geschenk beim Geburtstag. */
  icon: IconName;
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
export const THREAD_TIME = 44;
export const THREAD_RAIL = 18;
/** Abstand zwischen Zeitspalte, Schiene und Karte — im Entwurf 10 px. */
export const THREAD_GUTTER = 10;
const TIME = THREAD_TIME;
const RAIL = THREAD_RAIL;
const GUTTER = THREAD_GUTTER;
export const THREAD_INDENT = TIME + RAIL + GUTTER * 2;

/**
 * Der Tag als ein Faden statt als Kachelbrett.
 *
 * Wecker, Termin, Aufgabe, Rechnung und Einkauf haengen an derselben Achse,
 * mit einer Marke fuer *jetzt*. Was eine Uhrzeit hat, steht an ihr; der Rest
 * folgt darunter, ehrlich ohne erfundene Zeit.
 *
 * Mit `onOpen` ist das Band die kurze Fassung eines groesseren: jeder Tipp
 * hinein — auf eine Karte, die Jetzt-Linie, „Keine Einträge“ — oeffnet den
 * grossen Zeitstrahl, bei einer Karte mit ihrem Schluessel. Nur der Kreis
 * links hakt weiter direkt ab.
 */
export function DayThread({
  entries,
  allDay = [],
  now,
  showNow = true,
  next,
  onOpen,
}: {
  entries: readonly DayEntry[];
  /** Ganztaegiges steht als eigene Zeile ueber dem Band. */
  allDay?: readonly AllDayEntry[];
  now?: Date;
  /** Die Jetzt-Marke gehoert zu heute. An anderen Tagen gibt es kein Jetzt. */
  showNow?: boolean;
  /** Der naechste Tag, ganz unten unter einem roten Strich. */
  next?: NextDay;
  /** Oeffnet den grossen Zeitstrahl — mit dem Schluessel der angetippten Karte. */
  onOpen?: (key?: string) => void;
}) {
  const { t, language } = useI18n();
  // Ohne eigene Zeit tickt das Band selbst — sonst stuende die Linie still.
  const tick = useNow(NOW_TICK_MS);
  const current = now ?? new Date(tick);
  const lane = allDay.length > 0 ? <AllDayLane entries={allDay} onOpen={onOpen} /> : null;
  const peek = next ? <NextDayPeek {...next} /> : null;
  const openAt = (key: string) => (onOpen ? () => onOpen(key) : undefined);
  const openAll = onOpen ? () => onOpen() : undefined;

  // Auch ohne Eintraege bleibt der Faden stehen — blass, mit der Uhrzeit und
  // einem Satz. So springt die Startseite nicht, wenn der erste Termin kommt.
  if (entries.length === 0) {
    return (
      <View>
        {lane}
        {showNow ? <NowMark now={current} muted={!lane} onPress={openAll} /> : null}
        {/* Heute steht nach der Jetzt-Linie immer etwas — notfalls „Keine Einträge“. */}
        {showNow || !lane ? <EmptyRow onPress={openAll} /> : null}
        {peek}
      </View>
    );
  }

  const timed = entries
    .filter((entry): entry is DayEntry & { at: string } => Boolean(entry.at))
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
  const untimed = entries.filter((entry) => !entry.at);

  // Vorbei ist ein Termin erst an seinem Ende: solange er laeuft, steht die
  // Jetzt-Linie ueber ihm, und er ist dran (dunkel, leicht groesser). Der
  // naechste danach ist leicht grau. An einem anderen Tag gibt es kein Jetzt.
  const states: readonly ThreadState[] = showNow
    ? threadStates(timed, current)
    : timed.map((): ThreadState => 'later');
  // -1 trifft keinen Platz: an einem anderen Tag faellt die Marke ganz weg.
  const passed = showNow ? nowIndexOf(states) : -1;

  return (
    <View>
      {lane}
      {timed.map((entry, index) => {
        // Laeuft der Eintrag schon, steht die Linie in seiner Karte und wandert
        // durch sie hindurch — sonst davor.
        const progress = index === passed ? progressOf(entry, current) : null;
        const left = progress === null ? null : minutesLeftOf(entry, current);
        // Was noch kommt, sagt, wann: „in 20 Min.“ — nur heute, wo es ein Jetzt gibt.
        const until = showNow && progress === null ? minutesUntilOf(entry, current) : null;
        return (
          <Fragment key={entry.key}>
            {index === passed && progress === null ? (
              <NowMark now={current} onPress={openAll} />
            ) : null}
            <DayRow
              entry={entry}
              time={formatTime(language, entry.at)}
              live={states[index] === 'live'}
              countdown={until === null ? null : spanText(t, until, 'in')}
              {...(progress === null
                ? {}
                : {
                    running: {
                      progress,
                      now: formatTime(language, current.toISOString()),
                      left: left === null ? null : spanText(t, left, 'left'),
                    },
                  })}
              onPress={openAt(entry.key)}
            />
          </Fragment>
        );
      })}
      {passed === timed.length ? <NowMark now={current} onPress={openAll} /> : null}
      {/* Nach der Jetzt-Linie kommt nichts mehr: dann sagt es das Band. */}
      {passed === timed.length && untimed.length === 0 ? <EmptyRow onPress={openAll} /> : null}
      {untimed.map((entry) => (
        <DayRow key={entry.key} entry={entry} time="" live={false} onPress={openAt(entry.key)} />
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
          <View
            style={[styles.dot, { borderColor: line, backgroundColor: theme.colors.surface }]}
          />
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
            <DayRow
              entry={entry}
              time={entry.at ? formatTime(language, entry.at) : ''}
              live={false}
              inert
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
function NowMark({
  now,
  muted = false,
  onPress,
}: {
  now: Date;
  muted?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const signal = muted ? theme.colors.borderStrong : theme.colors.accentMark;

  return (
    <Tappable
      label={t('today.timeline.open')}
      onPress={onPress}
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
    </Tappable>
  );
}

/**
 * Eine Zeile, die mit `onPress` zum Knopf wird und sonst eine Flaeche bleibt —
 * so enthaelt nie ein Knopf einen anderen.
 */
function Tappable({
  label,
  onPress,
  style,
  children,
}: {
  label: string;
  onPress?: () => void;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Das Ganztaegige, ganz oben am Band: eine Karte mit einer Zeile je Eintrag,
 * untereinander statt als Pillen nebeneinander. Ab vier Eintraegen stehen
 * zwei da und eine Zeile „2 weitere“ — nie eine, die nur einen versteckt.
 */
export function AllDayLane({
  entries,
  onOpen,
}: {
  entries: readonly AllDayEntry[];
  /** Statt die Funktion zu oeffnen, oeffnet ein Tipp den grossen Zeitstrahl. */
  onOpen?: (key?: string) => void;
}) {
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
      style={[
        styles.laneSeparator,
        { marginLeft: textInset, backgroundColor: theme.colors.border },
      ]}
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
            <AllDayRow entry={entry} onPress={onOpen ? () => onOpen(entry.key) : entry.onPress} />
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
 * Eine Zeile der Ganztags-Karte — gebaut wie eine Karte im Band: Symbol,
 * Titel, rechts woher, darunter die zweite Zeile. So sieht ein
 * Geburtstag heute genauso aus wie einer in fuenf Tagen.
 */
function AllDayRow({ entry, onPress }: { entry: AllDayEntry; onPress?: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  const label = [entry.title, entry.meta ?? t('today.allDay')].join(' — ');

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { padding: theme.spacing.md, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.head, { gap: theme.spacing.sm }]}>
        <View style={[styles.laneLead, { height: theme.lineHeight.md }]}>
          <Icon name={entry.icon} size={16} color={entry.color} />
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
export function EmptyRow({ onPress }: { onPress?: () => void } = {}) {
  const theme = useTheme();
  const { t } = useI18n();
  const label = t('today.thread.emptyDay');

  return (
    <Tappable
      label={onPress ? t('today.timeline.open') : label}
      onPress={onPress}
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
    </Tappable>
  );
}

/**
 * Eine Karte am Faden. Ein Tipp tut `onPress` — auf der Startseite oeffnet er
 * den grossen Zeitstrahl, dort die Funktion (`entry.onPress`). Hat die Karte
 * einen Kreis, ist nur ihr Text der Knopf: ein Knopf im Knopf waere im Browser
 * ungueltig. `inert` (die Vorschau auf morgen) hat gar keinen.
 */
export function DayRow({
  entry,
  time,
  live,
  running,
  countdown = null,
  onPress,
  inert = false,
}: {
  entry: DayEntry;
  time: string;
  /** Dran: laeuft gerade (ab genau seinem Beginn) — Better-Gruen und leicht groesser. */
  live: boolean;
  /**
   * Laeuft gerade: die Jetzt-Linie steht in der Karte, bei `progress` (0 oben
   * am Beginn, 1 unten am Ende), links die Uhrzeit. Was darueber liegt, ist
   * schon vorbei und wird in Echtzeit wieder Papier, darunter bleibt Gruen —
   * und „noch …“ steht in der Karte.
   */
  running?: { progress: number; now: string; left: string | null };
  /** Bei einem, der noch kommt: „in 20 Min.“ in der zweiten Zeile. */
  countdown?: string | null;
  onPress?: () => void;
  inert?: boolean;
}) {
  const theme = useTheme();
  // Wo die Karte in der Zeile steht — fuer die Uhrzeit und die Nadel links auf der Linie.
  const [box, setBox] = useState<{ y: number; height: number } | null>(null);
  const signal = theme.colors.accentMark;
  const press = usePressScale(theme.motion.pressScale.row);
  const area = moduleBase(theme, entry.moduleId);
  const open = inert ? undefined : (onPress ?? entry.onPress);
  const toggle = inert ? undefined : entry.onToggle;

  // Der laufende Termin ist Better-Gruen: der Akzent als Flaeche, darauf
  // `textOnAccent`; die zweite Zeile etwas leiser, aber immer lesbar.
  const onLive = theme.colors.textOnAccent;
  const liveMeta = ensureContrast(
    flatten(`${onLive}${LIVE_META_ALPHA}`, theme.colors.accent),
    theme.colors.accent,
    MIN_TEXT_CONTRAST,
  );
  /** Die Farben einer Karte — auf dem Gruen (dran) oder auf Papier. */
  const colorsFor = (onGreen: boolean) => ({
    title: onGreen ? onLive : theme.colors.text,
    meta: onGreen ? liveMeta : theme.colors.textMuted,
    tag: onGreen ? onLive : theme.colors.textFaint,
    icon: onGreen ? onLive : area,
    tick: onGreen ? onLive : theme.colors.textFaint,
  });
  // Die Jetzt-Linie in der Karte: nur ein Hauch. Die Grenze zwischen Weiss und
  // Gruen zeigt schon, wo jetzt ist — und laeuft die Linie durch den Text,
  // bleibt er lesbar.
  const runningColor = `${ensureContrast(theme.colors.text, theme.colors.accent, MIN_MARK_CONTRAST)}${RUNNING_LINE_ALPHA}`;
  type FaceColors = ReturnType<typeof colorsFor>;

  const meta = [entry.meta, running?.left, countdown].filter(Boolean).join(' · ');
  const nowY = running && box ? box.y + box.height * running.progress : null;
  // Liegt die Jetzt-Zeit auf der Hoehe der Beginn-Zeit, nimmt sie deren Platz.
  const startHidden = nowY !== null && nowY < theme.spacing.md + theme.lineHeight.caption * 1.5;

  const textOf = (colors: FaceColors) => (
    <View style={[styles.head, styles.grow, { gap: theme.spacing.sm }]}>
      <View style={styles.grow}>
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
              color: colors.title,
            },
          ]}
        >
          {entry.title}
        </Text>
        {meta ? (
          <Text
            variant="label"
            numberOfLines={2}
            style={{
              marginTop: theme.spacing.xs,
              fontWeight: theme.fontWeight.regular,
              color: colors.meta,
            }}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {entry.tag ? (
        <View style={[styles.lineBox, styles.tag, { height: theme.lineHeight.md }]}>
          <Text
            variant="overline"
            numberOfLines={1}
            style={{ letterSpacing: theme.tracking.tag, color: colors.tag }}
          >
            {entry.tag}
          </Text>
        </View>
      ) : null}
    </View>
  );

  /** Kreis oder Symbol links — als Knopf nur in der echten Karte, nie in ihrer Kopie. */
  const leadOf = (colors: FaceColors, interactive: boolean) => (
    <View style={[styles.lineBox, { height: theme.lineHeight.md }]}>
      {toggle && interactive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={entry.title}
          onPress={toggle}
          hitSlop={theme.spacing.md}
          style={[styles.tick, { borderColor: colors.tick }]}
        />
      ) : toggle ? (
        <View style={[styles.tick, { borderColor: colors.tick }]} />
      ) : (
        <Icon name={entry.icon} size={16} color={colors.icon} />
      )}
    </View>
  );

  const face = colorsFor(live);
  const text = textOf(face);

  const card = (
    <Animated.View
      style={[
        styles.card,
        live ? theme.elevation.raised : theme.elevation.card,
        {
          borderRadius: theme.radii.item,
          padding: theme.spacing.md,
          backgroundColor: live ? theme.colors.accent : theme.colors.surface,
          // Dran heisst auch: ein wenig groesser, mit Luft zu den Nachbarn.
          ...(live ? { marginVertical: theme.spacing.xs } : {}),
          transform: [
            ...(live ? [{ scale: LIVE_SCALE }] : []),
            ...(open ? [{ scale: press.scale }] : []),
          ],
        },
      ]}
      onLayout={
        running
          ? (event) => {
              const { y, height } = event.nativeEvent.layout;
              setBox((current) =>
                current && current.y === y && current.height === height ? current : { y, height },
              );
            }
          : undefined
      }
    >
      <View style={[styles.head, { gap: theme.spacing.sm }]}>
        {leadOf(face, true)}
        {toggle && open ? (
          // Neben dem Kreis ist nur der Text der Knopf.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={entry.meta ? `${entry.title}, ${entry.meta}` : entry.title}
            onPress={open}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            style={styles.grow}
          >
            {text}
          </Pressable>
        ) : (
          text
        )}
      </View>
      {running && live && box ? (
        // Was schon vorbei ist, wird in Echtzeit wieder Papier: oben hell, unten
        // noch dunkel — die Grenze ist die Jetzt-Linie. Eine Kopie der Karte in
        // hellen Farben, oben an der Linie abgeschnitten; sie nimmt keine Tipps an.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.wipe,
            {
              height: `${running.progress * 100}%`,
              borderTopLeftRadius: theme.radii.item,
              borderTopRightRadius: theme.radii.item,
            },
          ]}
        >
          <View
            style={[
              styles.wipeFace,
              {
                height: box.height,
                padding: theme.spacing.md,
                borderRadius: theme.radii.item,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <View style={[styles.head, { gap: theme.spacing.sm }]}>
              {leadOf(colorsFor(false), false)}
              {textOf(colorsFor(false))}
            </View>
          </View>
        </View>
      ) : null}
      {running ? (
        <View
          style={[
            styles.runningLine,
            { top: `${running.progress * 100}%`, backgroundColor: runningColor },
          ]}
        />
      ) : null}
    </Animated.View>
  );

  const rail = (
    <>
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
        {startHidden ? '' : time}
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
      {running && nowY !== null ? (
        // Links auf der Hoehe der Linie: die Uhrzeit und die Nadel auf der Schiene.
        <View
          style={[
            styles.runningMark,
            {
              top: nowY - theme.lineHeight.caption / 2,
              height: theme.lineHeight.caption,
              gap: GUTTER,
            },
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
                color: theme.colors.text,
              },
            ]}
          >
            {running.now}
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
        </View>
      ) : null}
    </>
  );

  // Ohne Kreis ist die ganze Zeile der Knopf — Zeit, Schiene und Karte.
  if (open && !toggle) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={entry.meta ? `${entry.title}, ${entry.meta}` : entry.title}
        onPress={open}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.row, { paddingBottom: theme.spacing.sm }]}
      >
        {rail}
        <View style={styles.grow}>{card}</View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, { paddingBottom: theme.spacing.sm }]}>
      {rail}
      <View style={styles.grow}>{card}</View>
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
  laneSeparator: { height: StyleSheet.hairlineWidth },
  wipe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  wipeFace: { position: 'absolute', top: 0, left: 0, right: 0 },
  runningLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  runningMark: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  pinBox: { width: RAIL, alignItems: 'center' },
});
