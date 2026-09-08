import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { EventRow } from '@/db';
import { formatTime, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { eventColor } from './colors';
import { isSameDay, isSameMonth, isToday, monthGrid, weekDays } from './dates';

export type MonthViewProps = {
  month: Date;
  selected: Date;
  events: readonly EventRow[];
  onSelect: (day: Date) => void;
  onPressEvent: (event: EventRow) => void;
};

const MAX_DOTS = 3;

export function MonthView({ month, selected, events, onSelect, onPressEvent }: MonthViewProps) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const grid = monthGrid(month);
  const headerDays = weekDays(month);

  function eventsOn(day: Date): EventRow[] {
    return events
      .filter((event) => isSameDay(new Date(event.startsAt), day))
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.startsAt.localeCompare(b.startsAt);
      });
  }

  const selectedEvents = eventsOn(selected);

  return (
    <View style={styles.fill}>
      {/* Wochentage */}
      <View style={styles.weekHeader}>
        {headerDays.map((day) => (
          <View key={day.toISOString()} style={styles.headerCell}>
            <Text variant="caption" tone="faint" align="center">
              {new Intl.DateTimeFormat(language === 'de' ? 'de-CH' : language, {
                weekday: 'short',
              })
                .format(day)
                .slice(0, 2)}
            </Text>
          </View>
        ))}
      </View>

      {/* Raster */}
      <View style={[styles.grid, { borderTopColor: theme.colors.border }]}>
        {grid.map((day) => {
          const dayEvents = eventsOn(day);
          const inMonth = isSameMonth(day, month);
          const isSelected = isSameDay(day, selected);
          const today = isToday(day);

          return (
            <Pressable
              key={day.toISOString()}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={new Intl.DateTimeFormat('de-CH', {
                day: 'numeric',
                month: 'long',
              }).format(day)}
              onPress={() => onSelect(day)}
              style={styles.cell}
            >
              <View
                style={[
                  styles.dayCircle,
                  isSelected
                    ? { backgroundColor: theme.colors.accent }
                    : today
                      ? { borderWidth: 1, borderColor: theme.colors.accent }
                      : null,
                ]}
              >
                <Text
                  variant="label"
                  tone={
                    isSelected ? 'onAccent' : inMonth ? (today ? 'accent' : 'default') : 'faint'
                  }
                >
                  {day.getDate()}
                </Text>
              </View>
              <View style={styles.dots}>
                {dayEvents.slice(0, MAX_DOTS).map((event) => (
                  <View
                    key={event.id}
                    style={[styles.dot, { backgroundColor: eventColor(event.color) }]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Agenda des gewaehlten Tages */}
      <View style={[styles.agenda, { borderTopColor: theme.colors.border }]}>
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
          showsVerticalScrollIndicator={false}
        >
          <Text variant="section" tone="muted">
            {new Intl.DateTimeFormat('de-CH', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(selected)}
          </Text>

          {selectedEvents.length === 0 ? (
            <Text variant="label" tone="faint">
              {t('calendar.empty')}
            </Text>
          ) : (
            selectedEvents.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={event.title}
                onPress={() => onPressEvent(event)}
                style={({ pressed }) => [
                  styles.agendaRow,
                  {
                    gap: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.bar,
                    { backgroundColor: eventColor(event.color), borderRadius: theme.radii.sm },
                  ]}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body">{event.title}</Text>
                  <Text variant="caption" tone="muted">
                    {event.allDay
                      ? t('today.allDay')
                      : `${formatTime(language, event.startsAt)}${
                          event.endsAt ? ` – ${formatTime(language, event.endsAt)}` : ''
                        }`}
                    {event.location ? ` · ${event.location}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  weekHeader: { flexDirection: 'row', paddingVertical: 6 },
  headerCell: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth },
  cell: {
    width: `${100 / 7}%`,
    height: 52,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  agenda: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  agendaRow: { flexDirection: 'row', alignItems: 'center' },
  bar: { width: 4, alignSelf: 'stretch', minHeight: 32 },
});
