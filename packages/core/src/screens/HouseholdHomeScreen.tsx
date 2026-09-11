import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { dayKey, households as householdRepo, useLiveQuery } from '@/db';
import { chores as choreRepo, shopping as shoppingRepo } from '@/db/repositories';
import { FamilySections } from '@/features/family/FamilySections';
import { relativeDay } from '@/features/shared/days';
import { guessCategory, splitQuantity } from '@/features/shopping/categories';
import { useI18n, type TranslationKey } from '@/i18n';
import { MODULES } from '@/mocks/modules';
import { useAccount, useApp } from '@/state/AppContext';
import { hueTint, useTheme } from '@/theme';
import {
  Button,
  Card,
  Divider,
  DueTag,
  EmptyRow,
  Header,
  Icon,
  LineRow,
  ListCard,
  Screen,
  SectionHead,
  Text,
  TickRow,
} from '@/ui';

/** Jedes Mitglied bekommt die Farbe eines Bereichs — reihum, wie im Entwurf. */
const MEMBER_HUES = ['organisation', 'household', 'money', 'health', 'ai'] as const;
const AVATAR = 30;
const AVATAR_RING = 2;
const CODE_HEIGHT = 30;
const ADD_HEIGHT = 50;
const PLUS = 21;
const OPEN_ROWS = 6;
const DONE_ROWS = 2;
const CHORE_ROWS = 4;

/**
 * Die Startseite von BetterFamily, wie im Entwurf «Haushalt»: der Name des
 * Haushalts als Titel, der Code zum Einladen, wer dabei ist — darunter die
 * Einkaufsliste zum Abhaken und Ergaenzen, die Ämtli und danach, was die
 * anderen Funktionen gerade wissen.
 */
export function HouseholdHomeScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;
  const today = dayKey();

  const [draft, setDraft] = useState('');

  const memberList = useLiveQuery(
    () => (householdId ? householdRepo.members(householdId) : Promise.resolve([])),
    [householdId],
  );
  const shoppingList = useLiveQuery(
    () => shoppingRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const choreList = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])),
    [householdId],
  );

  const members = memberList.data ?? [];
  const joined = members.filter((member) => member.membership.status !== 'pending');
  const memberOf = (accountId: string | null) =>
    members.find((member) => member.membership.accountId === accountId);
  const colorOf = (accountId: string | null) => {
    const index = Math.max(
      0,
      members.findIndex((member) => member.membership.accountId === accountId),
    );
    return hueTint(theme, MEMBER_HUES[index % MEMBER_HUES.length] ?? 'household').base;
  };

  const items = shoppingList.data ?? [];
  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);
  const shown = [...open.slice(0, OPEN_ROWS), ...done.slice(0, DONE_ROWS)];
  const chores = choreList.data ?? [];
  const mine = chores.filter((chore) => chore.assignedTo === account.id).length;

  const nameOf = (id: string) => MODULES.find((module) => module.id === id)?.name ?? id;

  async function add() {
    const { name, quantity } = splitQuantity(draft);
    if (name.length === 0) return;
    setDraft('');
    await shoppingRepo.add({
      accountId: account.id,
      householdId,
      name,
      quantity,
      category: guessCategory(name),
    });
  }

  return (
    <Screen
      gap={theme.spacing.xl}
      contentStyle={{ paddingTop: theme.spacing.sm }}
      header={
        <Header
          crumb={{ label: t('area.household'), color: hueTint(theme, 'household').base }}
          title={household ? household.name : t('household.title')}
          {...(household
            ? {
                right: (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t('household.invite.title')}: ${household.inviteCode}`}
                    onPress={() => router.push('/household')}
                    hitSlop={theme.spacing.sm}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        height: CODE_HEIGHT,
                        gap: theme.spacing.xs,
                        paddingHorizontal: theme.spacing.md,
                        borderRadius: theme.radii.pill,
                        backgroundColor: theme.colors.surfaceMuted,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Icon name="link" size={13} color={theme.colors.textMuted} />
                    <Text
                      variant="caption"
                      tone="muted"
                      style={{
                        fontSize: theme.fontSize.caption,
                        lineHeight: theme.lineHeight.caption,
                        fontWeight: theme.fontWeight.semibold,
                        letterSpacing: theme.tracking.label,
                      }}
                    >
                      {household.inviteCode}
                    </Text>
                  </Pressable>
                ),
              }
            : {})}
        >
          {household && joined.length > 0 ? (
            <View style={[styles.row, { gap: theme.spacing.sm, marginTop: theme.spacing.xs }]}>
              <View style={styles.row}>
                {joined.slice(0, 4).map((member, index) => (
                  <MemberAvatar
                    key={member.membership.id}
                    name={member.displayName}
                    color={colorOf(member.membership.accountId)}
                    overlap={index > 0}
                  />
                ))}
              </View>
              <Text variant="label" tone="muted" numberOfLines={1} style={styles.grow}>
                {t('family.members', {
                  names: joined.map((member) => member.displayName).join(', '),
                  joined: joined.length,
                  total: members.length,
                })}
              </Text>
            </View>
          ) : null}
        </Header>
      }
    >
      {!household ? (
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="title">{t('household.none.title')}</Text>
            <Text variant="body" tone="muted">
              {t('household.none.body')}
            </Text>
            <Button label={t('household.create.title')} onPress={() => router.push('/new-household')} />
            <Button
              label={t('household.join.title')}
              variant="secondary"
              onPress={() => router.push('/join-household')}
            />
          </View>
        </Card>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHead
          title={nameOf('shopping')}
          count={t('shopping.openCount', { count: open.length })}
          onPress={() => router.push('/run/shopping')}
        />
        <ListCard>
          {shown.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <Divider /> : null}
              <TickRow
                label={item.quantity ? `${item.quantity} ${item.name}` : item.name}
                checked={item.done}
                // Wer es eingetragen hat, zaehlt erst, wenn man die Liste teilt.
                meta={householdId ? memberOf(item.accountId)?.displayName : undefined}
                onToggle={() => void shoppingRepo.setDone(item.id, !item.done)}
              />
            </View>
          ))}
          {shown.length > 0 ? <Divider /> : null}
          <View
            style={[
              styles.row,
              { minHeight: ADD_HEIGHT, gap: theme.spacing.md, paddingHorizontal: theme.spacing.md },
            ]}
          >
            <View
              style={[
                styles.plus,
                { borderRadius: theme.radii.xs, backgroundColor: theme.colors.surfaceMuted },
              ]}
            >
              <Icon name="plus" size={13} color={theme.colors.textMuted} />
            </View>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('family.addItem')}
              placeholderTextColor={theme.colors.textFaint}
              onSubmitEditing={() => void add()}
              returnKeyType="done"
              accessibilityLabel={t('family.addItem')}
              style={{
                flex: 1,
                height: ADD_HEIGHT,
                fontFamily: theme.fontFamily,
                fontSize: theme.fontSize.md,
                color: theme.colors.text,
                outlineStyle: 'none' as never,
              }}
            />
          </View>
        </ListCard>
      </View>

      {household ? (
        <View style={{ gap: theme.spacing.sm }}>
          <SectionHead
            title={nameOf('chores')}
            count={t('family.mine', { count: mine })}
            onPress={() => router.push('/run/chores')}
          />
          <ListCard>
            {chores.length === 0 ? (
              <EmptyRow text={t('chores.empty.title')} onPress={() => router.push('/run/chores')} />
            ) : (
              chores.slice(0, CHORE_ROWS).map((chore, index) => {
                const assigned = memberOf(chore.assignedTo);
                const dueDay = chore.dueAt ? dayKey(new Date(chore.dueAt)) : null;
                const subtitle = chore.lastDoneAt
                  ? t('family.lastDone', {
                      name: memberOf(chore.lastDoneBy)?.displayName ?? '—',
                      when: relativeDay(t, language, dayKey(new Date(chore.lastDoneAt))),
                    })
                  : t(`chores.repeat.${chore.repeat}` as TranslationKey);
                return (
                  <View key={chore.id}>
                    {index > 0 ? <Divider /> : null}
                    <LineRow
                      tall
                      title={chore.title}
                      subtitle={subtitle}
                      accessibilityLabel={`${chore.title}, ${subtitle}`}
                      onPress={() => router.push('/run/chores')}
                      leading={
                        assigned ? (
                          <MemberAvatar
                            name={assigned.displayName}
                            color={colorOf(chore.assignedTo)}
                          />
                        ) : (
                          <View style={[styles.avatar, { borderColor: theme.colors.borderStrong }]} />
                        )
                      }
                      trailing={
                        dueDay ? (
                          dueDay <= today ? (
                            <DueTag text={t('family.due.today')} now />
                          ) : (
                            <DueTag text={relativeDay(t, language, dueDay)} />
                          )
                        ) : null
                      }
                    />
                  </View>
                );
              })
            )}
          </ListCard>
        </View>
      ) : null}

      <FamilySections />
    </Screen>
  );
}

/** Ein Mitglied als farbiger Kreis mit Initiale, mit Papierring wie im Entwurf. */
function MemberAvatar({
  name,
  color,
  overlap = false,
}: {
  name: string;
  color: string;
  overlap?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={name}
      style={[
        styles.avatar,
        {
          backgroundColor: color,
          borderColor: theme.colors.background,
          marginLeft: overlap ? -theme.spacing.sm : 0,
        },
      ]}
    >
      <Text
        variant="caption"
        style={{
          color: theme.scheme === 'dark' ? theme.colors.background : theme.colors.surface,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  plus: { width: PLUS, height: PLUS, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: AVATAR_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
