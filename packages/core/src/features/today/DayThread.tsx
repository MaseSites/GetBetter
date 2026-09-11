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
export function DayThread({ entries, now = new Date() }: { entries: readonly DayEntry[]; now?: Date }) {
  const { language } = useI18n();
  if (entries.length === 0) return null;

  const timed = entries
    .filter((entry): entry is DayEntry & { at: string } => Boolean(entry.at))
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
  const untimed = entries.filter((entry) => !entry.at);

  const nowIso = now.toISOString();
  const nextIndex = timed.findIndex((entry) => entry.at >= nowIso);
  const passed = nextIndex === -1 ? timed.length : nextIndex;

  return (
    <View>
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

/** Die Marke fuer die aktuelle Uhrzeit — die einzige Signalfarbe im Band. */
function NowMark({ now }: { now: Date }) {
  const theme = useTheme();
  const { language } = useI18n();

  return (
    <View style={[styles.row, styles.nowRow, { paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.sm }]}>
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
        {formatTime(language, now.toISOString())}
      </Text>
      <View style={styles.railNow}>
        <View style={[styles.line, { backgroundColor: theme.colors.accent }]} />
        <View
          style={[
            styles.pin,
            {
              backgroundColor: theme.colors.accent,
              borderColor: theme.colors.background,
              boxShadow: `0 0 0 1.5px ${theme.colors.accent}`,
            },
          ]}
        />
      </View>
      <LinearGradient
        colors={[theme.colors.accent, `${theme.colors.accent}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.nowLine}
      />
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
            { marginTop: theme.spacing.lg, borderColor: area, backgroundColor: theme.colors.surface },
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
});
