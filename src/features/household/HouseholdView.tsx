import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { households as householdRepo, useLiveQuery } from '@/db';
import { HouseholdInvite } from '@/features/household/HouseholdInvite';
import { formatShortDate, useI18n } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Header,
  Icon,
  Input,
  ListItem,
  Loading,
  Screen,
  Sheet,
  Text,
} from '@/ui';

export function HouseholdView() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household, role, joinHousehold, createHousehold, leaveHousehold, refreshHousehold } =
    useApp();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const memberList = useLiveQuery(
    () => (household ? householdRepo.members(household.id) : Promise.resolve([])),
    [household?.id],
  );
  const members = memberList.data ?? [];
  const isAdmin = role === 'admin';

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    try {
      await createHousehold(name);
      setName('');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (busy) return;
    setBusy(true);
    setJoinError(null);
    try {
      const result = await joinHousehold(code);
      if (!result.ok) {
        setJoinError(
          result.error === 'already_member'
            ? t('household.error.member')
            : t('household.error.code'),
        );
        return;
      }
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------- ohne Haushalt

  if (!household) {
    return (
      <Screen
        header={
          <Header
            title={t('household.title')}
            showBack
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/household'))}
          />
        }
      >
        <EmptyState
          icon="people"
          title={t('household.none.title')}
          body={t('household.none.body')}
        />

        <Card title={t('household.create.title')} subtitle={t('household.create.body')}>
          <Input
            label={t('household.field.name')}
            placeholder={t('household.field.namePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Button
            label={t('household.create.action')}
            icon="home"
            onPress={handleCreate}
            loading={busy}
          />
        </Card>

        <Card title={t('household.join.title')} subtitle={t('household.join.body')}>
          <Input
            label={t('household.field.code')}
            placeholder="ABC123"
            value={code}
            onChangeText={(value) => {
              setCode(value);
              setJoinError(null);
            }}
            autoCapitalize="none"
            {...(joinError ? { error: joinError } : {})}
          />
          <Button
            label={t('household.join.action')}
            icon="people"
            variant="secondary"
            onPress={handleJoin}
            loading={busy}
          />
        </Card>
      </Screen>
    );
  }

  // --------------------------------------------------- mit Haushalt

  return (
    <Screen
      header={
        <Header
          title={household.name}
          subtitle={t('household.memberCount', { count: members.length })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/household'))}
          {...(isAdmin
            ? {
                actions: [
                  {
                    icon: 'note' as const,
                    label: t('household.rename'),
                    onPress: () => {
                      setRenameText(household.name);
                      setRenaming(true);
                    },
                  },
                ],
              }
            : {})}
        />
      }
      footer={
        <Button
          label={t('household.leave')}
          variant="danger"
          icon="logout"
          onPress={() => setConfirmLeave(true)}
        />
      }
    >
      <HouseholdInvite household={household} />

      <Card title={t('household.members')}>
        {memberList.loading && members.length === 0 ? <Loading compact /> : null}
        <View>
          {members.map((member, index) => {
            const isSelf = member.membership.accountId === account.id;
            return (
              <View key={member.membership.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={member.displayName + (isSelf ? ` · ${t('household.you')}` : '')}
                  subtitle={t('household.since', {
                    date: formatShortDate(language, member.membership.joinedAt),
                  })}
                  right={
                    <View style={[styles.rowRight, { gap: theme.spacing.sm }]}>
                      <Badge
                        label={
                          member.membership.role === 'admin'
                            ? t('household.role.admin')
                            : t('household.role.member')
                        }
                        tone={member.membership.role === 'admin' ? 'accent' : 'neutral'}
                      />
                    </View>
                  }
                  {...(isAdmin && !isSelf
                    ? {
                        showChevron: true,
                        onPress: async () => {
                          await householdRepo.setRole(
                            household.id,
                            member.membership.accountId,
                            member.membership.role === 'admin' ? 'member' : 'admin',
                          );
                          await refreshHousehold();
                        },
                      }
                    : {})}
                />
              </View>
            );
          })}
        </View>
        {isAdmin ? (
          <Text variant="caption" tone="faint">
            {t('household.roleHint')}
          </Text>
        ) : null}
      </Card>

      <Card title={t('household.shared.title')}>
        <View style={{ gap: theme.spacing.sm }}>
          {[
            { icon: 'cart' as const, key: 'household.shared.shopping' as const },
            { icon: 'calendar' as const, key: 'household.shared.calendar' as const },
            { icon: 'broom' as const, key: 'household.shared.chores' as const },
            { icon: 'checkCircle' as const, key: 'household.shared.tasks' as const },
          ].map((entry) => (
            <View
              key={entry.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
            >
              <Icon name={entry.icon} size={18} color={theme.colors.accentStrong} />
              <View style={{ flex: 1 }}>
                <Text variant="label" tone="muted">
                  {t(entry.key)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Sheet visible={renaming} onClose={() => setRenaming(false)} title={t('household.rename')}>
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
          <Input
            label={t('household.field.name')}
            value={renameText}
            onChangeText={setRenameText}
            autoCapitalize="words"
          />
          <Button
            label={t('common.done')}
            icon="check"
            onPress={async () => {
              await householdRepo.rename(household.id, renameText);
              await refreshHousehold();
              setRenaming(false);
            }}
          />
        </View>
      </Sheet>

      <Sheet
        visible={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={t('household.leave.title')}
      >
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
          <Text variant="label" tone="muted">
            {t('household.leave.body')}
          </Text>
          <Button
            label={t('household.leave.confirm')}
            variant="danger"
            icon="logout"
            onPress={async () => {
              setConfirmLeave(false);
              await leaveHousehold();
            }}
          />
          <Button
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => setConfirmLeave(false)}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { alignItems: 'center' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
});
