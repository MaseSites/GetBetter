import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  bills as billRepo,
  contacts as contactRepo,
  meds as medRepo,
  recipes as recipeRepo,
  savings as savingsRepo,
  subscriptions as subscriptionRepo,
  useLiveQuery,
} from '@/db';
import {
  events as eventRepo,
  notes as noteRepo,
  shopping as shoppingRepo,
  tasks as taskRepo,
} from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { formatShortDate, useI18n } from '@/i18n';
import { modulesOfApp } from '@/mocks/modules';
import { useAccount, useApp } from '@/state/AppContext';
import { moduleBase, useTheme } from '@/theme';
import { Header, Icon, Screen, Text, usePressScale, type IconName } from '@/ui';

type Hit = {
  key: string;
  moduleId: string;
  icon: IconName;
  title: string;
  meta?: string;
  onPress: () => void;
};

type Found = { key: string; title: string; meta?: string; match: boolean };

/**
 * Suche ueber alles, was diese App fuehrt.
 *
 * Ein Feld, darunter die Treffer — erst die Funktionen, dann was in ihnen
 * steht. Jede App sucht nur in ihren eigenen Funktionen. Solange nichts
 * eingetippt ist, stehen alle Funktionen da, statt einer leeren Flaeche.
 */
export function SearchScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const { access } = useCalendarAccess();
  const householdId = household?.id ?? null;
  const [query, setQuery] = useState('');

  const taskList = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const noteList = useLiveQuery(() => noteRepo.list(account.id), [account.id]);
  const contactList = useLiveQuery(() => contactRepo.list(account.id), [account.id]);
  const eventList = useLiveQuery(
    () => eventRepo.listUpcoming(access, new Date().toISOString(), 50),
    [access.accountId, access.householdIds, access.calendarIds],
  );
  const shoppingList = useLiveQuery(
    () => shoppingRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const recipeList = useLiveQuery(
    () => recipeRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const medList = useLiveQuery(() => medRepo.list(account.id), [account.id]);
  const billList = useLiveQuery(() => billRepo.listOpen(account.id), [account.id]);
  const subscriptionList = useLiveQuery(() => subscriptionRepo.list(account.id), [account.id]);
  const goalList = useLiveQuery(() => savingsRepo.list(account.id), [account.id]);

  const needle = query.trim().toLocaleLowerCase('de-CH');
  const has = (value: string | null | undefined) =>
    Boolean(value && value.toLocaleLowerCase('de-CH').includes(needle));

  const modules = modulesOfApp();
  const owned = new Set(modules.map((module) => module.id));
  // Die Suche spricht die Sprache der laufenden App. In BetterMoney nach
  // "Aufgabe, Termin, Notiz" zu fragen waere technisch harmlos, aber fuer
  // Menschen ein falsches Versprechen.
  const examples = modules
    .slice(0, 4)
    .map((module) => module.name)
    .join(', ');
  const searchPlaceholder = examples || t('search.placeholder');

  /** Eintraege einer Funktion — nur, wenn diese App sie fuehrt. */
  function from<T>(
    moduleId: string,
    icon: IconName,
    rows: readonly T[] | undefined,
    read: (row: T) => Found,
  ): Hit[] {
    if (!owned.has(moduleId)) return [];
    return (rows ?? [])
      .map(read)
      .filter((entry) => entry.match)
      .map((entry) => ({
        key: entry.key,
        moduleId,
        icon,
        title: entry.title,
        meta: entry.meta,
        onPress: () => router.push(`/run/${moduleId}`),
      }));
  }

  const moduleHits: Hit[] = modules
    .filter((module) => needle.length === 0 || has(module.name) || has(module.short))
    .map((module) => ({
      key: `m-${module.id}`,
      moduleId: module.id,
      icon: module.icon,
      title: module.name,
      meta: module.short,
      onPress: () => router.push(`/run/${module.id}`),
    }));

  // Ohne Eingabe stehen alle Funktionen da; Eintraege kommen erst mit einem Wort.
  const hits: Hit[] =
    needle.length === 0
      ? moduleHits
      : [
          ...moduleHits,
          ...from('tasks', 'checkCircle', taskList.data, (row) => ({
            key: `t-${row.id}`,
            title: row.title,
            match: has(row.title),
          })),
          ...from('calendar', 'calendar', eventList.data, (row) => ({
            key: `e-${row.id}`,
            title: row.title,
            meta: formatShortDate(language, row.startsAt),
            match: has(row.title),
          })),
          ...from('notes', 'note', noteList.data, (row) => ({
            key: `n-${row.id}`,
            title: row.title || t('notes.untitled'),
            meta: row.body.slice(0, 60) || undefined,
            match: has(row.title) || has(row.body),
          })),
          ...from('contacts', 'person', contactList.data, (row) => ({
            key: `c-${row.id}`,
            title: row.name,
            match: has(row.name),
          })),
          ...from('shopping', 'cart', shoppingList.data, (row) => ({
            key: `s-${row.id}`,
            title: row.name,
            meta: row.quantity ?? undefined,
            match: has(row.name),
          })),
          ...from('recipes', 'book', recipeList.data, (row) => ({
            key: `r-${row.id}`,
            title: row.title,
            match: has(row.title) || row.ingredients.some((line) => has(line)),
          })),
          ...from('meds', 'pill', medList.data, (row) => ({
            key: `md-${row.id}`,
            title: row.name,
            meta: row.dose ?? undefined,
            match: has(row.name),
          })),
          ...from('bills', 'doc', billList.data, (row) => ({
            key: `b-${row.id}`,
            title: row.title,
            meta: formatShortDate(language, row.dueDay),
            match: has(row.title),
          })),
          ...from('subscriptions', 'repeat', subscriptionList.data, (row) => ({
            key: `su-${row.id}`,
            title: row.name,
            match: has(row.name),
          })),
          ...from('savings', 'star', goalList.data, (row) => ({
            key: `g-${row.id}`,
            title: row.name,
            match: has(row.name),
          })),
        ];

  return (
    <Screen header={<Header large title={t('search.title')} />} gap={theme.spacing.lg}>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <Icon name="search" size={17} color={theme.colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.colors.textFaint}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('search.title')}
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

      {hits.length === 0 ? (
        <Text variant="body" tone="muted" style={{ fontSize: theme.fontSize.lede }}>
          {t('search.none', { query: query.trim() })}
        </Text>
      ) : (
        <View
          style={[
            styles.card,
            theme.elevation.card,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
          ]}
        >
          {hits.map((hit, index) => (
            <HitRow key={hit.key} hit={hit} first={index === 0} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function HitRow({ hit, first }: { hit: Hit; first: boolean }) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hit.title}
      onPress={hit.onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.row,
          {
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.md,
            borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <Icon name={hit.icon} size={18} color={moduleBase(theme, hit.moduleId)} />
        <View style={styles.text}>
          <Text variant="label" numberOfLines={1} style={{ fontSize: theme.fontSize.md }}>
            {hit.title}
          </Text>
          {hit.meta ? (
            <Text variant="caption" tone="faint" numberOfLines={1}>
              {hit.meta}
            </Text>
          ) : null}
        </View>
        <Icon name="forward" size={15} color={theme.colors.borderStrong} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', height: 44 },
  input: { flex: 1, height: '100%', outlineStyle: 'none' as never },
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  text: { flex: 1, gap: 1 },
});
