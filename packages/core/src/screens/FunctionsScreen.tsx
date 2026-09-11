import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { currentApp, hasHouseholds } from '@/app/identity';
import {
  contacts as contactRepo,
  dayKey,
  documents as documentRepo,
  habits as habitRepo,
  trips as tripRepo,
  useLiveQuery,
} from '@/db';
import {
  alarms as alarmRepo,
  events as eventRepo,
  notes as noteRepo,
  tasks as taskRepo,
} from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { daysUntil, nextBirthday, relativeDay } from '@/features/shared/days';
import { useI18n, type TranslationKey } from '@/i18n';
import { BUILT_MODULE_IDS, modulesOfApp } from '@/mocks/modules';
import type { Area, ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { hueTint, useTheme } from '@/theme';
import { Header, Icon, Screen, Text, usePressScale } from '@/ui';

/** Was rechts in einer Zeile steht: ein Wert, eine hervorgehobene Zahl oder still. */
type RowValue = { text: string; pill?: boolean; quiet?: boolean };

/** In dieser Reihenfolge stehen die Bereiche, vom Kalender zum Konto. */
const ORDER: readonly Area[] = ['organisation', 'health', 'household', 'money'];

/**
 * Die Funktionen dieser App, nach Bereich sortiert.
 *
 * Kein Kachelbrett: als Zeilen unter einer Bereichsueberschrift erkennt man
 * die Gliederung auf einen Blick, und rechts steht, was eine Funktion gerade
 * weiss — so sieht man gleich, welche etwas von einem will.
 */
export function FunctionsScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const app = currentApp();
  const main = app.id === 'getbetter';
  const account = useAccount();
  const { household } = useApp();
  const { access } = useCalendarAccess();
  const householdId = household?.id ?? null;
  const today = dayKey();
  const [query, setQuery] = useState('');

  const upcoming = useLiveQuery(
    () => eventRepo.listUpcoming(access, new Date().toISOString(), 20),
    [access.accountId, access.householdIds, access.calendarIds],
  );
  const openTasks = useLiveQuery(
    () => taskRepo.countOpen(account.id, householdId),
    [account.id, householdId],
  );
  const noteCount = useLiveQuery(() => noteRepo.count(account.id), [account.id]);
  const nextAlarm = useLiveQuery(() => alarmRepo.nextEnabled(account.id), [account.id]);
  const documentList = useLiveQuery(() => documentRepo.list(account.id), [account.id]);
  const habitList = useLiveQuery(() => habitRepo.list(account.id), [account.id]);
  const habitTicks = useLiveQuery(() => habitRepo.ticks(account.id), [account.id]);
  const tripList = useLiveQuery(() => tripRepo.list(account.id), [account.id]);
  const contactList = useLiveQuery(() => contactRepo.list(account.id), [account.id]);

  /** Der Wert einer Funktion — vorerst nur in GetBetter, die anderen Apps folgen. */
  function valueOf(id: string): RowValue | null {
    if (!main) return null;
    if (id === 'calendar') {
      const count = (upcoming.data ?? []).filter(
        (row) => row.startsAt.slice(0, 10) === today,
      ).length;
      return { text: t('value.today', { count }), quiet: count === 0 };
    }
    if (id === 'tasks') {
      const count = openTasks.data ?? 0;
      return { text: String(count), pill: count > 0, quiet: count === 0 };
    }
    if (id === 'notes') {
      return { text: String(noteCount.data ?? 0), quiet: true };
    }
    if (id === 'alarm') {
      return nextAlarm.data
        ? { text: nextAlarm.data.time }
        : { text: t('today.noAlarm'), quiet: true };
    }
    if (id === 'documents') {
      const count = (documentList.data ?? []).filter(
        (row) => row.expiresOn !== null && daysUntil(row.expiresOn) <= 60,
      ).length;
      return count > 0 ? { text: t('value.deadlines', { count }) } : { text: '—', quiet: true };
    }
    if (id === 'habits') {
      const total = (habitList.data ?? []).length;
      const done = new Set(
        (habitTicks.data ?? []).filter((tick) => tick.day === today).map((tick) => tick.habitId),
      ).size;
      return total > 0 ? { text: t('value.ofTotal', { done, total }) } : { text: '—', quiet: true };
    }
    if (id === 'travel') {
      const next = (tripList.data ?? []).find((trip) => trip.endDay >= today);
      return next
        ? {
            text:
              next.startDay <= today ? t('trips.ongoing') : relativeDay(t, language, next.startDay),
          }
        : { text: t('value.none'), quiet: true };
    }
    if (id === 'contacts') {
      const count = (contactList.data ?? []).filter(
        (row) => row.birthday && nextBirthday(row.birthday).days <= 30,
      ).length;
      return count > 0 ? { text: t('value.birthdays', { count }) } : { text: '—', quiet: true };
    }
    return null;
  }

  const mine = modulesOfApp();
  // Der Haushalt ist in BetterFamily eine Funktion wie jede andere.
  const householdModule: ModuleDefinition[] = hasHouseholds()
    ? [
        {
          id: 'household',
          area: 'household',
          name: t('tabs.household'),
          short: '',
          description: '',
          icon: 'people',
          priority: 1,
          permissions: { read: [], write: [] },
        },
      ]
    : [];

  const needle = query.trim().toLocaleLowerCase('de-CH');
  const all = [...householdModule, ...mine].filter(
    (module) =>
      needle.length === 0 ||
      module.name.toLocaleLowerCase('de-CH').includes(needle) ||
      module.short.toLocaleLowerCase('de-CH').includes(needle),
  );
  const groups = ORDER.map((area) => ({
    area,
    modules: all.filter((module) => module.area === area),
  })).filter((group) => group.modules.length > 0);

  return (
    <Screen
      header={
        <Header large title={main ? t('areas.title') : t('functions.title')}>
          {main ? (
            <Text
              variant="body"
              tone="muted"
              style={{
                maxWidth: 280,
                fontSize: theme.fontSize.lede,
                lineHeight: theme.lineHeight.lede,
              }}
            >
              {t('areas.lede', { count: mine.length })}
            </Text>
          ) : null}
        </Header>
      }
      gap={theme.spacing.sm}
    >
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.xs,
          },
        ]}
      >
        <Icon name="search" size={17} color={theme.colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('areas.search')}
          placeholderTextColor={theme.colors.textFaint}
          autoCorrect={false}
          accessibilityLabel={t('areas.search')}
          style={[
            styles.input,
            {
              fontFamily: theme.fontFamily,
              fontSize: theme.fontSize.lede,
              color: theme.colors.text,
            },
          ]}
        />
      </View>

      {groups.map((group) => (
        <View key={group.area} style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <AreaHead area={group.area} count={group.modules.length} />
          <View
            style={[
              styles.card,
              theme.elevation.card,
              { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
            ]}
          >
            {group.modules.map((module, index) => {
              const built = module.id === 'household' || BUILT_MODULE_IDS.includes(module.id);
              return (
                <Row
                  key={module.id}
                  module={module}
                  first={index === 0}
                  built={built}
                  value={valueOf(module.id)}
                  onPress={() =>
                    router.push(
                      module.id === 'household'
                        ? '/household'
                        : built
                          ? `/run/${module.id}`
                          : `/module/${module.id}`,
                    )
                  }
                />
              );
            })}
          </View>
        </View>
      ))}
    </Screen>
  );
}

/** Farbquadrat, Bereichsname, Anzahl — die Farbe traegt die Ueberschrift. */
function AreaHead({ area, count }: { area: Area; count: number }) {
  const theme = useTheme();
  const { t } = useI18n();
  const tint = hueTint(theme, area);

  return (
    <View style={[styles.head, { gap: theme.spacing.sm }]}>
      <View style={[styles.swatch, { backgroundColor: tint.base }]} />
      <Text variant="section" style={{ letterSpacing: theme.tracking.tag, textTransform: 'uppercase' }}>
        {t(`area.${area}` as TranslationKey)}
      </Text>
      <Text
        variant="caption"
        tone="faint"
        style={[
          styles.count,
          { fontSize: theme.fontSize.caption, fontWeight: theme.fontWeight.semibold },
        ]}
      >
        {t('areas.count', { count })}
      </Text>
    </View>
  );
}

function Row({
  module,
  first,
  built,
  value,
  onPress,
}: {
  module: ModuleDefinition;
  first: boolean;
  built: boolean;
  value: RowValue | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={module.name}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.row,
          {
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.md,
            minHeight: value ? 48 : 54,
            borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
            transform: [{ scale: press.scale }],
            // Was noch nicht gebaut ist, steht blass da statt so zu tun.
            opacity: built ? 1 : 0.5,
          },
        ]}
      >
        <Icon name={module.icon} size={18} color={theme.colors.textMuted} />
        <View style={styles.text}>
          <Text
            variant="label"
            numberOfLines={1}
            style={{ fontSize: theme.fontSize.md, letterSpacing: theme.tracking.body }}
          >
            {module.name}
          </Text>
          {value || !module.short ? null : (
            <Text variant="caption" tone="faint" numberOfLines={1}>
              {module.short}
            </Text>
          )}
        </View>
        {value ? (
          value.pill ? (
            <View
              style={[
                styles.pill,
                { backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill },
              ]}
            >
              <Text
                variant="caption"
                style={{ color: theme.colors.textOnAccent, fontWeight: theme.fontWeight.bold }}
              >
                {value.text}
              </Text>
            </View>
          ) : (
            <Text
              variant="label"
              numberOfLines={1}
              style={{
                color: value.quiet ? theme.colors.textFaint : theme.colors.textMuted,
                fontWeight: value.quiet ? theme.fontWeight.regular : theme.fontWeight.semibold,
              }}
            >
              {value.text}
            </Text>
          )
        ) : null}
        <Icon name="forward" size={15} color={theme.colors.borderStrong} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', height: 44 },
  input: { flex: 1, height: '100%', outlineStyle: 'none' as never },
  card: { overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  count: { marginLeft: 'auto' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
  pill: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
