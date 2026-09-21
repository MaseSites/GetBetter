import * as Linking from 'expo-linking';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import { appUrl } from '@/app/bridge';
import { APPS, APP_IDS, currentApp, storeUrl, type AppId } from '@/app/identity';
import {
  appAccess,
  bills as billRepo,
  chats as chatRepo,
  dayKey,
  expenses as expenseRepo,
  meals as mealRepo,
  monthKey,
  sleepMinutes,
  sleeps as sleepRepo,
  useLiveQuery,
  workouts as workoutRepo,
} from '@/db';
import {
  chores as choreRepo,
  events as eventRepo,
  shopping as shoppingRepo,
} from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { formatList, formatMoney, formatTime, useI18n } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { AppIcon, Button, Icon, Text, usePressScale } from '@/ui';

/**
 * Die anderen Better-Apps auf der Startseite von GetBetter — die Verwaltung.
 *
 * Gestaltet wie die Bereiche: eine Ueberschrift, darunter eine Karte mit
 * Zeilen. **Jede App zeigt dasselbe**: auf einen Blick, was in ihr gerade
 * ansteht — moeglich, weil alle dieselbe Datenbank teilen. Wo man schon drin
 * war, fuehrt ein Tipp hinein; wo nicht, steht die Vorschau blass da und
 * daneben der Knopf zum Installieren. Kein Werbesatz.
 */
export function AppFamily() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { account, household } = useApp();
  const { access } = useCalendarAccess();
  const me = currentApp().id;
  const others = APP_IDS.filter((id) => id !== me);
  const householdId = household?.id ?? null;

  const unlockedList = useLiveQuery(
    () => (account ? appAccess.appsOf(account.id) : Promise.resolve([])),
    [account?.id],
  );
  const unlocked = unlockedList.data ?? [];

  const shoppingList = useLiveQuery(
    () => (account ? shoppingRepo.list(account.id, householdId) : Promise.resolve([])),
    [account?.id, householdId],
  );
  const choreList = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])),
    [householdId],
  );
  const gymMinutes = useLiveQuery(
    () => (account ? workoutRepo.minutesSince(account.id, dayKey()) : Promise.resolve(0)),
    [account?.id],
  );
  const gymKcal = useLiveQuery(
    () => (account ? mealRepo.kcalOf(account.id, dayKey()) : Promise.resolve(0)),
    [account?.id],
  );
  const aiChats = useLiveQuery(
    () => (account ? chatRepo.list(account.id) : Promise.resolve([])),
    [account?.id],
  );
  const gymSleep = useLiveQuery(
    () => (account ? sleepRepo.list(account.id, 1) : Promise.resolve([])),
    [account?.id],
  );
  const moneySpent = useLiveQuery(
    () => (account ? expenseRepo.totalOf(account.id, monthKey()) : Promise.resolve(0)),
    [account?.id],
  );
  const moneyBills = useLiveQuery(
    () => (account ? billRepo.listOpen(account.id) : Promise.resolve([])),
    [account?.id],
  );
  const familyNext = useLiveQuery(
    () =>
      access.householdIds.length > 0
        ? eventRepo.listBetween(
            access,
            new Date().toISOString(),
            new Date(Date.now() + 14 * 86_400_000).toISOString(),
            access.householdIds.map((id) => `house:${id}` as const),
          )
        : Promise.resolve([]),
    [access.accountId, access.householdIds],
  );

  /**
   * Installieren fuehrt in den Store, sobald es die App dort gibt. Bis dahin
   * oeffnet der Knopf sie direkt — in der Entwicklung ist das dasselbe Ziel.
   */
  async function install(id: AppId) {
    const store = storeUrl(APPS[id], Platform.OS);
    await Linking.openURL(store ?? appUrl(id));
  }

  /**
   * Die Felder einer App stehen immer da — auch wenn nichts drin ist. So
   * sieht man, was einen erwartet, statt einer leeren Karte.
   */
  function fields(id: AppId): { label: string; value: string | null }[] {
    if (id === 'betterfamily') {
      const next = familyNext.data?.[0];
      // Die Einkaufsliste auf einen Blick: die ersten Posten, sonst nur die Zahl.
      const open = (shoppingList.data ?? []).filter((item) => !item.done);
      const names = open.slice(0, 3).map((item) => item.name);
      const jobs = choreList.data?.length ?? 0;
      return [
        {
          label: t('field.nextAppointment'),
          value: next ? `${formatTime(language, next.startsAt)} · ${next.title}` : null,
        },
        {
          label: t('field.shopping'),
          value:
            open.length === 0
              ? null
              : open.length > names.length
                ? t('field.open', { count: open.length })
                : formatList(language, names),
        },
        { label: t('field.chores'), value: jobs > 0 ? t('field.open', { count: jobs }) : null },
      ];
    }
    if (id === 'bettergym') {
      const trained = gymMinutes.data ?? 0;
      const eaten = gymKcal.data ?? 0;
      const night = gymSleep.data?.[0];
      const slept = night ? sleepMinutes(night) : 0;
      return [
        {
          label: t('field.training'),
          value: trained > 0 ? t('gym.minutes', { minutes: trained }) : null,
        },
        { label: t('field.calories'), value: eaten > 0 ? t('meals.kcal', { kcal: eaten }) : null },
        {
          label: t('field.sleep'),
          value: night
            ? t('sleep.duration', { hours: Math.floor(slept / 60), minutes: slept % 60 })
            : null,
        },
      ];
    }
    if (id === 'bettermoney') {
      const spent = moneySpent.data ?? 0;
      const open = moneyBills.data?.length ?? 0;
      return [
        { label: t('field.budget'), value: spent > 0 ? formatMoney(language, spent) : null },
        { label: t('field.bills'), value: open > 0 ? t('field.open', { count: open }) : null },
      ];
    }
    const lastChat = aiChats.data?.[0];
    return [{ label: t('field.chat'), value: lastChat?.title || null }];
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={[styles.head, { gap: theme.spacing.sm }]}>
        <Text variant="overline">{t('family.title')}</Text>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        {others.map((id, index) => (
          <AppRow
            key={id}
            id={id}
            first={index === 0}
            rows={fields(id)}
            installLabel={t('family.install')}
            open={unlocked.includes(id)}
            onOpen={() => void Linking.openURL(appUrl(id))}
            onInstall={() => void install(id)}
          />
        ))}
      </View>
    </View>
  );
}

type AppRowProps = {
  id: AppId;
  first: boolean;
  rows: { label: string; value: string | null }[];
  /** Schon einmal in dieser App gewesen? Dann fuehrt die Zeile hinein. */
  open: boolean;
  installLabel: string;
  onOpen: () => void;
  onInstall: () => void;
};

/**
 * Eine App in der Karte: oben Logo, Name und — je nachdem — der Pfeil hinein
 * oder der Knopf zum Installieren, darunter immer die Vorschau. Ohne die App
 * steht alles blass da, und die Zeile ist nicht druckbar: sie traegt dann den
 * Knopf, und ein Knopf im Knopf gibt es nicht.
 */
function AppRow({ id, first, rows, open, installLabel, onOpen, onInstall }: AppRowProps) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);

  const inside = (
    <>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <View style={open ? undefined : styles.faded}>
          <AppIcon appId={id} />
        </View>
        <Text
          variant="label"
          numberOfLines={1}
          style={[
            styles.text,
            styles.name,
            open ? undefined : styles.faded,
            { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semibold },
          ]}
        >
          {APPS[id].name}
        </Text>
        {open ? (
          <Icon name="forward" size={theme.fontSize.sm} color={theme.colors.borderStrong} />
        ) : (
          <Button
            label={installLabel}
            icon="download"
            size="sm"
            fullWidth={false}
            onPress={onInstall}
          />
        )}
      </View>

      <View style={[{ marginTop: theme.spacing.sm }, open ? undefined : styles.faded]}>
        {rows.map((field) => (
          <View
            key={field.label}
            style={[
              styles.field,
              {
                paddingVertical: theme.spacing.sm,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.colors.border,
              },
            ]}
          >
            <Text variant="label" tone="muted" style={styles.text}>
              {field.label}
            </Text>
            <Text
              variant="label"
              tone={field.value ? 'default' : 'faint'}
              numberOfLines={1}
              style={{ fontWeight: theme.fontWeight.semibold }}
            >
              {field.value ?? '—'}
            </Text>
          </View>
        ))}
      </View>
    </>
  );

  const edge = {
    padding: theme.spacing.md,
    borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  };

  if (!open) return <View style={edge}>{inside}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={APPS[id].name}
      onPress={onOpen}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View style={[edge, { transform: [{ scale: press.scale }] }]}>{inside}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  card: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, minWidth: 0 },
  name: { gap: 2 },
  faded: { opacity: 0.55 },
  field: { flexDirection: 'row', alignItems: 'center' },
});
