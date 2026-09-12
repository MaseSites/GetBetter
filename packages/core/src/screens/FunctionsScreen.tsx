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
import { StarButton } from '@/features/quick/StarButton';
import { appNameOf, useFavorites, type Favorites } from '@/features/quick/useFavorites';
import { daysUntil, nextBirthday, relativeDay } from '@/features/shared/days';
import { useI18n, type TranslationKey } from '@/i18n';
import { BUILT_MODULE_IDS, modulesOfApp } from '@/mocks/modules';
import { TOPICS, type ModuleDefinition, type Topic } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { EmptyState, Header, Icon, Screen, Segmented, Text, usePressScale } from '@/ui';

/** Was rechts in einer Zeile steht: ein Wert, laut oder still. */
type RowValue = { text: string; quiet?: boolean };

/** Alle Funktionen dieser App oder die Favoriten des Kontos, auch aus anderen Apps. */
type Listing = 'all' | 'favorites';

/** Der Stern rechts in einer Zeile: gesetzt oder nicht, und was ein Tipp tut. */
type RowFavorite = { active: boolean; onToggle: () => void };

/** In dieser Reihenfolge stehen die Themen — `TOPICS` ist schon so sortiert. */
const ORDER: readonly Topic[] = TOPICS;

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
  const [listing, setListing] = useState<Listing>('all');
  const favorites = useFavorites();

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
      return { text: String(count), quiet: count === 0 };
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
          topic: 'supplies',
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
  const groups = ORDER.map((topic) => ({
    topic,
    modules: all.filter((module) => module.topic === topic),
  })).filter((group) => group.modules.length > 0);

  /** Nur Gebautes laesst sich favorisieren — der Haushalt ist kein Modul der Registry. */
  function favoriteOf(module: ModuleDefinition, built: boolean): RowFavorite | null {
    if (module.id === 'household' || !built) return null;
    return {
      active: favorites.isFavorite(app.id, module.id),
      onToggle: () => favorites.toggle(app.id, module.id),
    };
  }

  return (
    <Screen
      header={<Header large title={main ? t('areas.title') : t('functions.title')} />}
      gap={theme.spacing.sm}
    >
      <Segmented
        options={[
          { value: 'all', label: t('quick.view.all') },
          { value: 'favorites', label: t('quick.view.favorites') },
        ]}
        value={listing}
        onChange={setListing}
        accessibilityLabel={t('quick.view')}
      />

      {listing === 'favorites' ? (
        <FavoriteRows favorites={favorites} valueOf={valueOf} />
      ) : (
        <>
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
            <View key={group.topic} style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <TopicHead topic={group.topic} />
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
                      favorite={favoriteOf(module, built)}
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
        </>
      )}
    </Screen>
  );
}

/**
 * Die Favoriten des Kontos, auch aus anderen Apps, in derselben Zeilenoptik.
 * Ein Tipp oeffnet wie im Schnellzugriff; der Stern nimmt den Favoriten weg.
 */
function FavoriteRows({
  favorites,
  valueOf,
}: {
  favorites: Favorites;
  valueOf: (id: string) => RowValue | null;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  if (favorites.entries.length === 0) {
    return (
      <EmptyState title={t('quick.favorites.emptyTitle')} body={t('quick.favorites.emptyBody')} />
    );
  }

  return (
    <View
      style={[
        styles.card,
        theme.elevation.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          marginTop: theme.spacing.sm,
        },
      ]}
    >
      {favorites.entries.map((entry, index) => {
        const own = entry.appId === favorites.currentAppId;
        return (
          <Row
            key={entry.key}
            module={entry.module}
            first={index === 0}
            built
            value={own ? valueOf(entry.module.id) : null}
            caption={own ? undefined : appNameOf(entry.appId)}
            favorite={{
              active: true,
              onToggle: () => favorites.toggle(entry.appId, entry.module.id),
            }}
            onPress={() => favorites.open(entry.appId, entry.module.id)}
          />
        );
      })}
    </View>
  );
}

/** Nur der Bereichsname. */
function TopicHead({ topic }: { topic: Topic }) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.head, { gap: theme.spacing.sm }]}>
      <Text
        variant="section"
        style={{ letterSpacing: theme.tracking.tag, textTransform: 'uppercase' }}
      >
        {t(`topic.${topic}` as TranslationKey)}
      </Text>
    </View>
  );
}

/**
 * Eine Funktion als Zeile. Mit `favorite` steht rechts der Stern — neben dem
 * drueckbaren Teil, nicht darin: kein Knopf im Knopf. Der Stern ersetzt dann
 * den Pfeil, sonst stuenden zwei Zeichen hintereinander.
 */
function Row({
  module,
  first,
  built,
  value,
  caption,
  favorite = null,
  onPress,
}: {
  module: ModuleDefinition;
  first: boolean;
  built: boolean;
  value: RowValue | null;
  /** Die einzige zweite Zeile: der Name der App, aus der ein Favorit kommt. */
  caption?: string | undefined;
  favorite?: RowFavorite | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);
  // Kein Kurztext unter dem Namen: die Liste soll ruhig sein, nicht erklaeren.
  const subtitle = caption ?? null;

  return (
    <View
      style={[
        styles.row,
        {
          minHeight: value ? 48 : 54,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          // Was noch nicht gebaut ist, steht blass da statt so zu tun.
          opacity: built ? 1 : 0.5,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={module.name}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.rowPress}
      >
        <Animated.View
          style={[
            styles.rowBody,
            {
              paddingLeft: theme.spacing.md,
              paddingRight: favorite ? 0 : theme.spacing.md,
              gap: theme.spacing.md,
              transform: [{ scale: press.scale }],
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
            {value || !subtitle ? null : (
              <Text variant="caption" tone="faint" numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          {value ? <RowValueText value={value} /> : null}
          {favorite ? null : <Icon name="forward" size={15} color={theme.colors.borderStrong} />}
        </Animated.View>
      </Pressable>
      {favorite ? (
        <StarButton active={favorite.active} name={module.name} onPress={favorite.onToggle} />
      ) : null}
    </View>
  );
}

/** Der Wert rechts: immer schlichter Text, egal wie viel dahintersteckt. */
function RowValueText({ value }: { value: RowValue }) {
  const theme = useTheme();

  return (
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
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', height: 44 },
  input: { flex: 1, height: '100%', outlineStyle: 'none' as never },
  card: { overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  // flexGrow statt flex: 1 — sonst wird im Browser flex-basis 0% daraus.
  rowPress: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  rowBody: { flexGrow: 1, flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
});
