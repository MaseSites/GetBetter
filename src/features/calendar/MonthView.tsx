import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { EventRow } from '@/db';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { eventColor } from './colors';
import { isSameDay, isSameMonth, isToday, monthGrid, weekDays } from './dates';

export type MonthViewProps = {
  month: Date;
  selected: Date;
  events: readonly EventRow[];
  /** Ein Tag antippen heisst: diesen Tag im Detail ansehen. */
  onOpenDay: (day: Date) => void;
};

/** Mehr passt in ein Kaestchen nicht, ohne dass es unleserlich wird. */
const MAX_CHIPS = 3;

export function MonthView({ month, selected, events, onOpenDay }: MonthViewProps) {
  const { language } = useI18n();
  const theme = useTheme();

  const grid = monthGrid(month);
  const headerDays = weekDays(month);
  const weekdayFormat = new Intl.DateTimeFormat(language === 'de' ? 'de-CH' : language, {
    weekday: 'short',
  });
  const dayLabel = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long' });

  function eventsOn(day: Date): EventRow[] {
    return events
      .filter((event) => isSameDay(new Date(event.startsAt), day))
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.startsAt.localeCompare(b.startsAt);
      });
  }

  return (
    <View style={styles.fill}>
      <View style={styles.weekHeader}>
        {headerDays.map((day) => (
          <View key={day.toISOString()} style={styles.headerCell}>
            <Text variant="caption" tone="faint" align="center">
              {weekdayFormat.format(day).slice(0, 2)}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.fill} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {grid.map((day) => {
            const dayEvents = eventsOn(day);
            const inMonth = isSameMonth(day, month);
            const isSelected = isSameDay(day, selected);
            const today = isToday(day);
            const overflow = dayEvents.length - MAX_CHIPS;

            return (
              <Pressable
                key={day.toISOString()}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${dayLabel.format(day)}, ${dayEvents.length} Termine`}
                onPress={() => onOpenDay(day)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    backgroundColor: pressed
                      ? theme.colors.surfaceMuted
                      : inMonth
                        ? theme.colors.surface
                        : 'transparent',
                    borderRadius: theme.radii.sm,
                  },
                ]}
              >
                <View
                  style={[
                    styles.dayCircle,
                    today ? { backgroundColor: theme.colors.accent } : null,
                  ]}
                >
                  <Text
                    variant="caption"
                    tone={today ? 'onAccent' : inMonth ? 'default' : 'faint'}
                    style={{ fontWeight: today ? theme.fontWeight.semibold : undefined }}
                  >
                    {day.getDate()}
                  </Text>
                </View>

                <View style={styles.chips}>
                  {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                    <View
                      key={event.id}
                      style={[styles.chip, { backgroundColor: eventColor(event.color) }]}
                    >
                      <Text
                        numberOfLines={1}
                        variant="caption"
                        tone="onAccent"
                        style={styles.chipText}
                      >
                        {event.title}
                      </Text>
                    </View>
                  ))}
                  {overflow > 0 ? (
                    <Text variant="caption" tone="faint" style={styles.chipText}>
                      +{overflow}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  weekHeader: { flexDirection: 'row', paddingBottom: 6 },
  headerCell: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 2 },
  cell: {
    // Sieben Spalten mit 2px Abstand dazwischen.
    width: '14.05%',
    minHeight: 86,
    paddingTop: 3,
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 3,
  },
  dayCircle: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { alignSelf: 'stretch', gap: 2 },
  chip: { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },
  chipText: { fontSize: 9, lineHeight: 12 },
});
