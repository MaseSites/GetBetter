import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { EventRow } from '@/db';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { eventColor } from './colors';
import { isToday, minutesOfDay, startOfDay } from './dates';

export const HOUR_HEIGHT = 52;
const GUTTER_WIDTH = 44;

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

export function TimeGrid({ days, events, onPressSlot, onPressEvent, compact }: TimeGridProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);

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
        {Array.from({ length: 24 }, (_, hour) => (
          <View key={hour} style={[styles.hourRow, { top: hour * HOUR_HEIGHT }]}>
            <View style={[styles.gutter, { width: GUTTER_WIDTH }]}>
              {hour === 0 ? null : (
                <Text variant="caption" tone="faint">
                  {String(hour).padStart(2, '0')}:00
                </Text>
              )}
            </View>
            <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
          </View>
        ))}

        {/* Spalten */}
        <View style={[styles.columns, { left: GUTTER_WIDTH }]}>
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
                style={[styles.column, { borderLeftColor: theme.colors.border }]}
              >
                {/* Leere Flaeche: Antippen legt einen Termin zur Stunde an */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <Pressable
                    key={hour}
                    accessibilityRole="button"
                    accessibilityLabel={`${String(hour).padStart(2, '0')}:00`}
                    onPress={() => onPressSlot(day, hour)}
                    style={[styles.slot, { top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }]}
                  />
                ))}

                {placed.map(({ event, top, height, column, columns }) => {
                  const width = `${100 / columns}%` as const;
                  const left = `${(100 / columns) * column}%` as const;
                  return (
                    <Pressable
                      key={event.id}
                      accessibilityRole="button"
                      accessibilityLabel={event.title}
                      onPress={() => onPressEvent(event)}
                      style={[
                        styles.event,
                        {
                          top,
                          height: Math.max(height - 2, 18),
                          width,
                          left,
                          backgroundColor: eventColor(event.color),
                          borderRadius: theme.radii.sm,
                          padding: compact ? 3 : theme.spacing.sm,
                        },
                      ]}
                    >
                      <Text variant="caption" tone="onAccent" numberOfLines={compact ? 2 : 3}>
                        {event.title}
                      </Text>
                      {!compact && height > 44 ? (
                        <Text variant="caption" tone="onAccent" numberOfLines={1}>
                          {new Date(event.startsAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
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
          <View
            pointerEvents="none"
            style={[
              styles.nowLine,
              { top: (nowMinutes / 60) * HOUR_HEIGHT, left: GUTTER_WIDTH - 4 },
            ]}
          >
            <View style={[styles.nowDot, { backgroundColor: theme.colors.danger }]} />
            <View style={[styles.nowBar, { backgroundColor: theme.colors.danger }]} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { position: 'relative' },
  hourRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  gutter: { alignItems: 'flex-end', paddingRight: 6, marginTop: -8 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  columns: { position: 'absolute', top: 0, right: 0, bottom: 0, flexDirection: 'row' },
  column: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, position: 'relative' },
  slot: { position: 'absolute', left: 0, right: 0 },
  event: { position: 'absolute', overflow: 'hidden' },
  nowLine: { position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  nowBar: { flex: 1, height: 1.5 },
});
