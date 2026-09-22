import { StyleSheet, View } from 'react-native';

import { currentApp } from '@/app/identity';
import {
  bills as billRepo,
  chats as chatRepo,
  dayKey,
  drinks as drinkRepo,
  expenses as expenseRepo,
  habits as habitRepo,
  monthKey,
  notes as noteRepo,
  recipes as recipeRepo,
  savings as savingsRepo,
  sleepMinutes,
  sleeps as sleepRepo,
  subscriptions as subscriptionRepo,
  tasks as taskRepo,
  useLiveQuery,
  workouts as workoutRepo,
} from '@/db';
import {
  chores as choreRepo,
  events as eventRepo,
  shopping as shoppingRepo,
} from '@/db/repositories';
import { fit } from '@/db/fit';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { useFit } from '@/features/fit/useFit';
import { shiftDay } from '@/features/shared/days';
import { formatMoney, formatNumber, useI18n } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import { useScope } from '@/state/AppContext';
import { moduleBase, useTheme } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

/** Sieben Tage nach vorne oder zurueck — so weit schaut der Ueberblick. */
const WEEK_MS = 7 * 86_400_000;
/** Nichts da: kein Text, nur der Strich. */
const NONE = '—';

/**
 * Der Ueberblick auf der Profilseite: je Funktion **dieser** App eine Zahl —
 * offene Aufgaben, Termine der Woche, Kalorien von heute. Keine Saetze, nur
 * Zeichen, Name und Wert; die Farbe kommt vom Bereich der Funktion.
 *
 * Nie die Funktionen einer anderen App: jede App zeigt hier ihre eigenen.
 */
export function ProfileStats() {
  const app = currentApp().id;
  if (app === 'betterfamily') return <FamilyStats />;
  if (app === 'bettergym') return <GymStats />;
  if (app === 'bettermoney') return <MoneyStats />;
  if (app === 'betterai') return <AiStats />;
  return <GetBetterStats />;
}

type Tile = {
  /** Die Funktion — sie gibt der Kachel Zeichen und Farbe. */
  module: string;
  icon: IconName;
  label: string;
  value: string;
};

function GetBetterStats() {
  const { t, language } = useI18n();
  const { accountId, householdId } = useScope();
  const { access } = useCalendarAccess();

  const open = useLiveQuery(
    () => taskRepo.countOpen(accountId, householdId),
    [accountId, householdId],
  );
  const soon = useLiveQuery(
    () => countWeek(eventRepo.listUpcoming(access, new Date().toISOString())),
    [access.accountId, access.householdIds],
  );
  const written = useLiveQuery(() => noteRepo.count(accountId), [accountId]);
  const routine = useLiveQuery(() => habitRepo.list(accountId), [accountId]);
  const ticks = useLiveQuery(() => habitRepo.ticks(accountId), [accountId]);

  const today = dayKey();
  const done = (ticks.data ?? []).filter((tick) => tick.day === today).length;
  const habits = routine.data ?? [];

  return (
    <StatGrid
      tiles={[
        {
          module: 'tasks',
          icon: 'checkCircle',
          label: moduleName(t, 'tasks'),
          value: formatNumber(language, open.data ?? 0),
        },
        {
          module: 'calendar',
          icon: 'calendar',
          label: moduleName(t, 'calendar'),
          value: formatNumber(language, soon.data ?? 0),
        },
        {
          module: 'notes',
          icon: 'note',
          label: moduleName(t, 'notes'),
          value: formatNumber(language, written.data ?? 0),
        },
        {
          module: 'habits',
          icon: 'repeat',
          label: moduleName(t, 'habits'),
          value:
            habits.length === 0
              ? NONE
              : `${formatNumber(language, done)}/${formatNumber(language, habits.length)}`,
        },
      ]}
    />
  );
}

function FamilyStats() {
  const { t, language } = useI18n();
  const { accountId, householdId } = useScope();
  const { access } = useCalendarAccess();

  const open = useLiveQuery(
    () => shoppingRepo.countOpen(accountId, householdId),
    [accountId, householdId],
  );
  const jobs = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])),
    [householdId],
  );
  const soon = useLiveQuery(
    () =>
      access.householdIds.length === 0
        ? Promise.resolve([])
        : eventRepo.listBetween(
            access,
            new Date().toISOString(),
            new Date(Date.now() + WEEK_MS).toISOString(),
            access.householdIds.map((id) => `house:${id}` as const),
          ),
    [access.accountId, access.householdIds],
  );
  const cooking = useLiveQuery(
    () => recipeRepo.list(accountId, householdId),
    [accountId, householdId],
  );

  return (
    <StatGrid
      tiles={[
        {
          module: 'shopping',
          icon: 'cart',
          label: moduleName(t, 'shopping'),
          value: formatNumber(language, open.data ?? 0),
        },
        {
          module: 'chores',
          icon: 'broom',
          label: moduleName(t, 'chores'),
          value: formatNumber(language, jobs.data?.length ?? 0),
        },
        {
          module: 'calendar',
          icon: 'calendar',
          label: moduleName(t, 'calendar'),
          value: formatNumber(language, soon.data?.length ?? 0),
        },
        {
          module: 'recipes',
          icon: 'book',
          label: moduleName(t, 'recipes'),
          value: formatNumber(language, cooking.data?.length ?? 0),
        },
      ]}
    />
  );
}

function GymStats() {
  const { t } = useI18n();
  const { accountId } = useScope();
  const today = dayKey();

  const minutes = useLiveQuery(
    () => workoutRepo.minutesSince(accountId, shiftDay(-6)),
    [accountId, today],
  );
  // Gegessen zaehlt Better Fit (geschuetzt im Dienst), nicht mehr der fruehere Menueplan.
  const fitDay = useFit(() => fit.day(), [accountId, today]);
  const kcal = Math.round(fitDay.data?.total.kcal ?? 0);
  const drunk = useLiveQuery(() => drinkRepo.ofDay(accountId, today), [accountId, today]);
  const nights = useLiveQuery(() => sleepRepo.list(accountId, 1), [accountId]);

  const night = nights.data?.[0];
  const slept = night ? sleepMinutes(night) : 0;

  return (
    <StatGrid
      tiles={[
        {
          module: 'trainingplan',
          icon: 'fitness',
          label: moduleName(t, 'trainingplan'),
          value: t('gym.minutes', { minutes: minutes.data ?? 0 }),
        },
        {
          module: 'nutrition',
          icon: 'meal',
          label: moduleName(t, 'nutrition'),
          value: t('meals.kcal', { kcal }),
        },
        {
          module: 'water',
          icon: 'water',
          label: moduleName(t, 'water'),
          value: t('water.amount', { amount: ((drunk.data ?? 0) / 10).toFixed(1) }),
        },
        {
          module: 'sleep',
          icon: 'sleep',
          label: moduleName(t, 'sleep'),
          value: night
            ? t('sleep.duration', { hours: Math.floor(slept / 60), minutes: slept % 60 })
            : NONE,
        },
      ]}
    />
  );
}

function AiStats() {
  const { t, language } = useI18n();
  const { accountId } = useScope();
  const talks = useLiveQuery(async () => {
    const rows = await chatRepo.list(accountId);
    const since = new Date(Date.now() - WEEK_MS).toISOString();
    return { all: rows.length, week: rows.filter((row) => row.updatedAt >= since).length };
  }, [accountId]);

  const counted = talks.data ?? { all: 0, week: 0 };

  return (
    <StatGrid
      tiles={[
        {
          module: 'ai',
          icon: 'sparkles',
          label: t('profile.stat.chats'),
          value: formatNumber(language, counted.all),
        },
        {
          module: 'ai',
          icon: 'clock',
          label: t('profile.stat.week'),
          value: formatNumber(language, counted.week),
        },
      ]}
    />
  );
}

function MoneyStats() {
  const { t, language } = useI18n();
  const { accountId } = useScope();
  const month = monthKey();

  const spent = useLiveQuery(() => expenseRepo.totalOf(accountId, month), [accountId, month]);
  const open = useLiveQuery(() => billRepo.listOpen(accountId), [accountId]);
  const monthly = useLiveQuery(() => subscriptionRepo.monthlyTotal(accountId), [accountId]);
  const goals = useLiveQuery(() => savingsRepo.list(accountId), [accountId]);

  return (
    <StatGrid
      tiles={[
        {
          module: 'budget',
          icon: 'wallet',
          label: moduleName(t, 'budget'),
          value: formatMoney(language, spent.data ?? 0),
        },
        {
          module: 'bills',
          icon: 'doc',
          label: moduleName(t, 'bills'),
          value: formatNumber(language, open.data?.length ?? 0),
        },
        {
          module: 'subscriptions',
          icon: 'repeat',
          label: moduleName(t, 'subscriptions'),
          value: formatMoney(language, monthly.data ?? 0),
        },
        {
          module: 'savings',
          icon: 'flag',
          label: moduleName(t, 'savings'),
          value: formatNumber(language, goals.data?.length ?? 0),
        },
      ]}
    />
  );
}

/** Wie viele der kommenden Termine in den naechsten sieben Tagen liegen. */
async function countWeek(pending: Promise<readonly { startsAt: string }[]>): Promise<number> {
  const rows = await pending;
  const until = new Date(Date.now() + WEEK_MS).toISOString();
  return rows.filter((row) => row.startsAt < until).length;
}

/** Die Kacheln selbst: zwei nebeneinander, gleich hoch, gleich ruhig. */
function StatGrid({ tiles }: { tiles: readonly Tile[] }) {
  const theme = useTheme();

  return (
    <View style={[styles.grid, { gap: theme.spacing.sm }]}>
      {tiles.map((tile) => (
        <View
          key={`${tile.module}:${tile.label}`}
          style={[
            styles.cell,
            theme.elevation.card,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.item,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
            },
          ]}
        >
          <View style={[styles.head, { gap: theme.spacing.xs }]}>
            <Icon name={tile.icon} size={15} color={moduleBase(theme, tile.module)} />
            <Text variant="caption" tone="muted" numberOfLines={1} style={styles.grow}>
              {tile.label}
            </Text>
          </View>
          <Text
            variant="display"
            numberOfLines={1}
            style={{
              fontSize: theme.fontSize.stat,
              lineHeight: theme.lineHeight.stat,
              fontWeight: theme.fontWeight.semibold,
            }}
          >
            {tile.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Zwei je Reihe: der Rest der Breite geht an die Luecke dazwischen.
  cell: { flexGrow: 1, flexBasis: '46%', minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
});
