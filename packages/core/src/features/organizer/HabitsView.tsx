import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey, habits as habitRepo, useLiveQuery, type HabitRow, type HabitTickRow } from '@/db';
import { weekDays } from '@/features/calendar/dates';
import { shiftDay } from '@/features/shared/days';
import { formatWeekday, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FloatingButton,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  Sheet,
  Text,
} from '@/ui';

/** Wie oft pro Woche man etwas will — die ueblichen Vorsaetze. */
const TARGETS = [7, 5, 3, 1] as const;
const DOT = 32;

/** Tage in Folge bis heute — oder bis gestern, wenn heute noch offen ist. */
export function streakOf(days: ReadonlySet<string>): number {
  const today = dayKey();
  let cursor = days.has(today) ? 0 : -1;
  let count = 0;
  while (days.has(shiftDay(cursor))) {
    count += 1;
    cursor -= 1;
  }
  return count;
}

/** Je Gewohnheit die Menge ihrer Haken-Tage. */
export function ticksByHabit(ticks: readonly HabitTickRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const tick of ticks) {
    const set = map.get(tick.habitId) ?? new Set<string>();
    set.add(tick.day);
    map.set(tick.habitId, set);
  }
  return map;
}

/**
 * Gewohnheiten wie in Streaks: eine Zeile pro Vorsatz, die Woche als sieben
 * Punkte, ein Tipp hakt ab. Die Serie zaehlt, was man durchgehalten hat.
 */
export function HabitsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();
  const week = weekDays(new Date()).map((date) => ({
    key: dayKey(date),
    label: formatWeekday(language, date.toISOString()).replace('.', ''),
  }));

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState<number>(TARGETS[0]);
  const [error, setError] = useState(false);

  const list = useLiveQuery(() => habitRepo.list(account.id), [account.id]);
  const tickList = useLiveQuery(() => habitRepo.ticks(account.id), [account.id]);
  const rows = list.data ?? [];
  const ticks = ticksByHabit(tickList.data ?? []);
  const doneToday = rows.filter((row) => ticks.get(row.id)?.has(today)).length;

  async function save() {
    if (name.trim().length === 0) {
      setError(true);
      return;
    }
    await habitRepo.add({ accountId: account.id, name, targetPerWeek: target });
    setName('');
    setError(false);
    setAdding(false);
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            rows.length > 0
              ? t('habits.today', { done: doneToday, total: rows.length })
              : t('habits.empty.title')
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon="repeat" title={t('habits.empty.title')} body={t('habits.empty.body')} />
      ) : null}

      {rows.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          days={ticks.get(habit.id) ?? new Set<string>()}
          week={week}
          today={today}
          onToggle={(day) => void habitRepo.toggle(habit.id, account.id, day)}
          onRemove={() => void habitRepo.remove(habit.id)}
        />
      ))}

      <FloatingButton label={t('habits.add')} onPress={() => setAdding(true)} />

      <Sheet
        visible={adding}
        onClose={() => {
          setError(false);
          setAdding(false);
        }}
        title={t('habits.add')}
      >
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <Input
            label={t('habits.name')}
            placeholder={t('habits.namePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            {...(error ? { error: t('money.error.name') } : {})}
          />
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('habits.target')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {TARGETS.map((entry) => (
                <Chip
                  key={entry}
                  label={
                    entry === 7
                      ? t('habits.target.daily')
                      : t('habits.target.times', { count: entry })
                  }
                  selected={target === entry}
                  onPress={() => setTarget(entry)}
                />
              ))}
            </View>
          </View>
          <Button label={t('common.done')} icon="check" onPress={save} />
        </View>
      </Sheet>
    </Screen>
  );
}

function HabitCard({
  habit,
  days,
  week,
  today,
  onToggle,
  onRemove,
}: {
  habit: HabitRow;
  days: ReadonlySet<string>;
  week: readonly { key: string; label: string }[];
  today: string;
  onToggle: (day: string) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const streak = streakOf(days);
  const weekCount = week.filter((day) => days.has(day.key)).length;

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <View style={[styles.head, { gap: theme.spacing.sm }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{habit.name}</Text>
            <View style={[styles.head, { gap: theme.spacing.xs }]}>
              {streak > 0 ? <Icon name="flame" size={14} color={theme.colors.accentStrong} /> : null}
              <Text variant="caption" tone={streak > 0 ? 'accent' : 'faint'}>
                {streak > 0
                  ? t(streak === 1 ? 'habits.streak.one' : 'habits.streak', { days: streak })
                  : t('habits.noStreak')}
              </Text>
            </View>
          </View>
          <Text variant="label" tone={weekCount >= habit.targetPerWeek ? 'accent' : 'muted'}>
            {t('habits.week', { done: weekCount, target: habit.targetPerWeek })}
          </Text>
          <IconButton icon="trash" label={t('common.remove')} onPress={onRemove} />
        </View>

        {/* Die Woche als sieben Punkte — die Zukunft bleibt blass und stumm. */}
        <View style={styles.week}>
          {week.map((day) => {
            const ticked = days.has(day.key);
            const future = day.key > today;
            const isToday = day.key === today;
            return (
              <View key={day.key} style={{ alignItems: 'center', gap: theme.spacing.xs }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ticked, disabled: future }}
                  accessibilityLabel={t('habits.tick', { name: habit.name, day: day.label })}
                  disabled={future}
                  onPress={() => onToggle(day.key)}
                  style={({ pressed }) => ({
                    width: DOT,
                    height: DOT,
                    borderRadius: DOT / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: future ? 0.35 : pressed ? 0.6 : 1,
                    backgroundColor: ticked ? theme.colors.accent : theme.colors.surfaceMuted,
                    borderWidth: isToday && !ticked ? 2 : 0,
                    borderColor: theme.colors.accent,
                  })}
                >
                  {ticked ? (
                    <Icon name="check" size={16} color={theme.colors.textOnAccent} />
                  ) : null}
                </Pressable>
                <Text variant="caption" tone={isToday ? 'default' : 'faint'}>
                  {day.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
});
