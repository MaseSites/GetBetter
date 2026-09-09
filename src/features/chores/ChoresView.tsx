import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { households as householdRepo, useLiveQuery, type ChoreRepeat, type ChoreRow } from '@/db';
import { chores as choreRepo } from '@/db/repositories';
import { formatShortDate, useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Header,
  Icon,
  Input,
  Loading,
  Screen,
  Sheet,
  Text,
} from '@/ui';

const REPEATS: readonly ChoreRepeat[] = ['once', 'daily', 'weekly', 'monthly'];

export function ChoresView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();

  const [composing, setComposing] = useState(false);
  const [assigning, setAssigning] = useState<ChoreRow | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const householdId = household?.id ?? null;

  const list = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])),
    [householdId],
  );
  const memberList = useLiveQuery(
    () => (householdId ? householdRepo.members(householdId) : Promise.resolve([])),
    [householdId],
  );

  const members = memberList.data ?? [];
  const all = list.data ?? [];
  const items = onlyMine ? all.filter((chore) => chore.assignedTo === account.id) : all;

  function nameOf(accountId: string | null): string {
    if (!accountId) return t('chores.unassigned');
    const member = members.find((entry) => entry.membership.accountId === accountId);
    return member?.displayName ?? t('chores.unassigned');
  }

  const header = (
    <Header
      title={module.name}
      subtitle={household ? household.name : t('chores.noHousehold.title')}
      showBack
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
    />
  );

  // Aemtli gibt es nur gemeinsam — allein waeren es einfach Aufgaben.
  if (!household || !householdId) {
    return (
      <Screen header={header}>
        <EmptyState
          icon="people"
          title={t('chores.noHousehold.title')}
          body={t('chores.noHousehold.body')}
          actionLabel={t('chores.noHousehold.action')}
          onAction={() => router.push('/household')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      footer={<Button label={t('chores.add')} icon="plus" onPress={() => setComposing(true)} />}
    >
      <View style={[styles.filters, { gap: theme.spacing.sm }]}>
        <Chip
          label={t('chores.filter.all')}
          selected={!onlyMine}
          onPress={() => setOnlyMine(false)}
        />
        <Chip
          label={t('chores.filter.mine')}
          selected={onlyMine}
          onPress={() => setOnlyMine(true)}
        />
      </View>

      {list.loading && all.length === 0 ? <Loading /> : null}

      {!list.loading && items.length === 0 ? (
        <EmptyState
          icon="broom"
          title={onlyMine ? t('chores.empty.mineTitle') : t('chores.empty.title')}
          body={t('chores.empty.body')}
          {...(onlyMine
            ? {}
            : { actionLabel: t('chores.add'), onAction: () => setComposing(true) })}
        />
      ) : null}

      {items.map((chore) => (
        <Card key={chore.id}>
          <View style={[styles.row, { gap: theme.spacing.md }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('chores.done')}: ${chore.title}`}
              onPress={() => choreRepo.complete(chore.id, account.id)}
              hitSlop={8}
            >
              <Icon name="checkCircle" size={26} color={theme.colors.borderStrong} />
            </Pressable>

            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text variant="body">{chore.title}</Text>
              <View style={[styles.meta, { gap: theme.spacing.sm }]}>
                <Badge label={t(`chores.repeat.${chore.repeat}` as TranslationKey)} icon="repeat" />
                {chore.dueAt ? (
                  <Text variant="caption" tone="muted">
                    {t('chores.due', { date: formatShortDate(language, chore.dueAt) })}
                  </Text>
                ) : null}
              </View>
              {chore.lastDoneAt ? (
                <Text variant="caption" tone="faint">
                  {t('chores.lastDone', {
                    name: nameOf(chore.lastDoneBy),
                    date: formatShortDate(language, chore.lastDoneAt),
                  })}
                </Text>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('chores.assign')}: ${chore.title}`}
              onPress={() => setAssigning(chore)}
              style={({ pressed }) => [styles.assignee, { opacity: pressed ? 0.6 : 1 }]}
            >
              {chore.assignedTo ? (
                <Avatar name={nameOf(chore.assignedTo)} size={32} />
              ) : (
                <View
                  style={[
                    styles.openSlot,
                    { borderColor: theme.colors.borderStrong, borderRadius: 16 },
                  ]}
                >
                  <Icon name="plus" size={16} color={theme.colors.textFaint} />
                </View>
              )}
              <Text variant="caption" tone="faint" numberOfLines={1}>
                {nameOf(chore.assignedTo)}
              </Text>
            </Pressable>
          </View>
        </Card>
      ))}

      <ChoreComposer
        visible={composing}
        householdId={householdId}
        onClose={() => setComposing(false)}
      />

      <Sheet
        visible={assigning !== null}
        onClose={() => setAssigning(null)}
        title={t('chores.assign')}
        subtitle={assigning?.title}
      >
        <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}>
          {members.map((member) => (
            <Button
              key={member.membership.id}
              label={member.displayName}
              variant={
                assigning?.assignedTo === member.membership.accountId ? 'primary' : 'secondary'
              }
              icon="person"
              onPress={async () => {
                if (!assigning) return;
                await choreRepo.assign(assigning.id, member.membership.accountId);
                setAssigning(null);
              }}
            />
          ))}
          <Button
            label={t('chores.unassign')}
            variant="ghost"
            onPress={async () => {
              if (!assigning) return;
              await choreRepo.assign(assigning.id, null);
              setAssigning(null);
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function ChoreComposer({
  visible,
  householdId,
  onClose,
}: {
  visible: boolean;
  householdId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<ChoreRepeat>('weekly');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (title.trim().length === 0) {
      setError(t('chores.error.title'));
      return;
    }
    await choreRepo.create({ householdId, title, repeat });
    setTitle('');
    setRepeat('weekly');
    setError(null);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('chores.add')}>
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <Input
          label={t('chores.field.title')}
          placeholder={t('chores.field.titlePlaceholder')}
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setError(null);
          }}
          autoCapitalize="sentences"
          {...(error ? { error } : {})}
        />
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {t('chores.field.repeat')}
          </Text>
          <View style={[styles.filters, { gap: theme.spacing.sm }]}>
            {REPEATS.map((value) => (
              <Chip
                key={value}
                label={t(`chores.repeat.${value}` as TranslationKey)}
                selected={repeat === value}
                onPress={() => setRepeat(value)}
              />
            ))}
          </View>
        </View>
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  filters: { flexDirection: 'row', flexWrap: 'wrap' },
  assignee: { width: 60, alignItems: 'center', gap: 4 },
  openSlot: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
