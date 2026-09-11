import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { EventRow } from '@/db';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { eventColor } from './colors';
import { isToday, minutesOfDay, startOfDay } from './dates';

/** Eine Stunde im Raster. Jeder Termin ist so hoch, wie er dauert. */
export const HOUR_HEIGHT = 56;
export const GUTTER_WIDTH = 44;

type Placed = {
  event: EventRow;
  top: number;
  height: number;
  column: number;
  columns: number;
};

/**
 * Ueberlappende Termine nebeneinander legen: erst in Gruppen zerlegen, die
 * sich beruehren, dann innerhalb der Gruppe die erste freie Spalte nehmen.
 */
function place(events: readonly EventRow[], day: Date): Placed[] {
  const dayStart = startOfDay(day).getTime();
  const timed = events
    .filter((event) => !event.allDay)
    .map((event) => {
      const start = new Date(event.startsAt);
      const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 3600_000);
      const startMin = Math.max(0, (start.getTime() - dayStart) / 60000);
      const endMin = Math.min(24 * 60, (end.getTime() - dayStart) / 60000);
      return { event, startMin, endMin: Math.max(endMin, startMin + 20) };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const result: Placed[] = [];
  let group: typeof timed = [];
  let groupEnd = -1;

  const flush = () => {
    if (group.length === 0) return;
    const columnEnds: number[] = [];
    const assigned = group.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.startMin);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.endMin);
      } else {
        columnEnds[column] = item.endMin;
      }
      return { item, column };
    });
    const columns = columnEnds.length;
    assigned.forEach(({ item, column }) => {
      result.push({
        event: item.event,
        top: (item.startMin / 60) * HOUR_HEIGHT,
        height: ((item.endMin - item.startMin) / 60) * HOUR_HEIGHT,
        column,
        columns,
      });
    });
    group = [];
    groupEnd = -1;
  };

  for (const item of timed) {
    if (group.length > 0 && item.startMin >= groupEnd) flush();
    group.push(item);
    groupEnd = Math.max(groupEnd, item.endMin);
  }
  flush();

  return result;
}

export type TimeGridProps = {
  days: readonly Date[];
  events: readonly EventRow[];
  onPressSlot: (day: Date, hour: number) => void;
  onPressEvent: (event: EventRow) => void;
  /** In der Wochenansicht bleibt nur Platz fuer den Titel. */
  compact?: boolean;
};

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;

/**
 * Das Zeitraster: Stunden links, Termine als weisse Karten mit farbiger
 * Kante, und eine Linie in Signalgruen fuer jetzt — die einzige Farbe, die
 * im Raster nicht von einem Termin kommt.
 */
export function TimeGrid({ days, events, onPressSlot, onPressEvent, compact }: TimeGridProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const single = days.length === 1;
  const right = single ? theme.spacing.edge : 0;

  // Beim Oeffnen nicht bei Mitternacht stehen, sondern beim Arbeitstag.
  useEffect(() => {
    const target = Math.max(0, 7 * HOUR_HEIGHT);
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: target, animated: false }), 50);
    return () => clearTimeout(timer);
  }, []);

  const nowMinutes = minutesOfDay(new Date());
  const showNow = days.some((day) => isToday(day));

  return (
    <ScrollView ref={scrollRef} style={styles.fill} showsVerticalScrollIndicator={false}>
      <View style={[styles.body, { height: 24 * HOUR_HEIGHT }]}>
        {/* Stundenlinien und Beschriftung */}
        {Array.from({ length: 24 }, (_, hour) => {
          // Liegt die Jetzt-Zeit zu nah an der Stunde, nimmt sie deren Platz.
          const hideLabel = hour === 0 || (showNow && Math.abs(hour * 60 - nowMinutes) < 25);
          return (
            <View key={hour} style={[styles.hourRow, { top: hour * HOUR_HEIGHT, right }]}>
              <View style={[styles.gutter, { width: GUTTER_WIDTH }]}>
                {hideLabel ? null : (
                  <Text
                    variant="caption"
                    tone="faint"
                    style={{ fontWeight: theme.fontWeight.semibold }}
                  >
                    {clock(hour * 60)}
                  </Text>
                )}
              </View>
              <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
            </View>
          );
        })}

        {/* Spalten */}
        <View style={[styles.columns, { left: GUTTER_WIDTH + theme.spacing.xs, right }]}>
          {days.map((day) => {
            const placed = place(
              events.filter((event) => {
                const start = new Date(event.startsAt);
                return (
                  start.getFullYear() === day.getFullYear() &&
                  start.getMonth() === day.getMonth() &&
                  start.getDate() === day.getDate()
                );
              }),
              day,
            );

            return (
              <View
                key={day.toISOString()}
                style={[
                  styles.column,
                  {
                    borderLeftWidth: single ? 0 : StyleSheet.hairlineWidth,
                    borderLeftColor: theme.colors.border,
                  },
                ]}
              >
                {/* Leere Flaeche: Antippen legt einen Termin zur Stunde an */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <Pressable
                    key={hour}
                    accessibilityRole="button"
                    accessibilityLabel={clock(hour * 60)}
                    onPress={() => onPressSlot(day, hour)}
                    style={[styles.slot, { top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }]}
                  />
                ))}

                {placed.map(({ event, top, height, column, columns }) => {
                  const width = `${100 / columns}%` as const;
                  const left = `${(100 / columns) * column}%` as const;
                  const short = height < 44;
                  return (
                    <Pressable
                      key={event.id}
                      accessibilityRole="button"
                      accessibilityLabel={event.title}
                      onPress={() => onPressEvent(event)}
                      style={[
                        styles.event,
                        theme.elevation.card,
                        {
                          top,
                          height: Math.max(height - 3, 18),
                          width,
                          left,
                          backgroundColor: theme.colors.surface,
                          borderRadius: theme.radii.sm,
                          paddingLeft: compact ? theme.spacing.sm : theme.spacing.md,
                          paddingRight: compact ? theme.spacing.xs : theme.spacing.sm,
                          paddingVertical: compact || short ? 2 : theme.spacing.xs,
                          justifyContent: short ? 'center' : 'flex-start',
                        },
                      ]}
                    >
                      <View style={[styles.rail, { backgroundColor: eventColor(event.color) }]} />
                      <Text
                        variant="label"
                        numberOfLines={compact ? 2 : short ? 1 : 2}
                        style={{
                          fontWeight: theme.fontWeight.semibold,
                          fontSize: compact ? theme.fontSize.xs : theme.fontSize.sm,
                        }}
                      >
                        {event.title}
                      </Text>
                      {!compact && !short ? (
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {clock(minutesOfDay(new Date(event.startsAt)))}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>

        {showNow ? (
          <>
            <View
              style={[
                styles.nowLabel,
                { pointerEvents: 'none', top: (nowMinutes / 60) * HOUR_HEIGHT - 8, width: GUTTER_WIDTH },
              ]}
            >
              <Text
                variant="caption"
                style={{ color: theme.colors.accentStrong, fontWeight: theme.fontWeight.bold }}
              >
                {clock(nowMinutes)}
              </Text>
            </View>
            <View
              style={[
                styles.nowLine,
                {
                  pointerEvents: 'none',
                  top: (nowMinutes / 60) * HOUR_HEIGHT,
                  left: GUTTER_WIDTH,
                  right,
                },
              ]}
            >
              <View
                style={[
                  styles.nowDot,
                  { backgroundColor: theme.colors.accent, borderColor: theme.colors.background },
                ]}
              />
              <View style={[styles.nowBar, { backgroundColor: theme.colors.accent }]} />
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { position: 'relative' },
  hourRow: { position: 'absolute', left: 0, flexDirection: 'row', alignItems: 'center' },
  gutter: { alignItems: 'flex-end', paddingRight: 8, marginTop: -8 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  columns: { position: 'absolute', top: 0, bottom: 0, flexDirection: 'row' },
  column: { flex: 1, position: 'relative' },
  slot: { position: 'absolute', left: 0, right: 0 },
  event: { position: 'absolute', overflow: 'hidden' },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  nowLabel: { position: 'absolute', left: 0, alignItems: 'flex-end', paddingRight: 8 },
  nowLine: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 9, height: 9, borderRadius: 999, borderWidth: 2, marginLeft: -4 },
  nowBar: { flex: 1, height: 1.5 },
});
