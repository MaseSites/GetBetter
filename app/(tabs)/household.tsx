import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { households as householdRepo, useLiveQuery, MAX_HOUSEHOLDS } from '@/db';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Badge, Button, Card, EmptyState, Header, Icon, Input, Loading, Screen, Text } from '@/ui';

export default function HouseholdTab() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { account, household, createHousehold, switchHousehold, joinHousehold } = useApp();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useLiveQuery(
    () => (account ? householdRepo.allOf(account.id) : Promise.resolve([])),
    [account?.id, household?.id],
  );
  const households = list.data ?? [];
  const atLimit = households.length >= MAX_HOUSEHOLDS;

  if (!account) return null;

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const ok = await createHousehold(name);
      if (!ok) {
        setMessage(t('households.error.limit', { max: MAX_HOUSEHOLDS }));
        return;
      }
      setName('');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await joinHousehold(code);
      if (!result.ok) {
        setMessage(
          result.error === 'already_member'
            ? t('household.error.member')
            : result.error === 'limit'
              ? t('households.error.limit', { max: MAX_HOUSEHOLDS })
              : t('household.error.code'),
        );
        return;
      }
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <Header
          large
          title={t('households.title')}
          subtitle={t('households.count', { count: households.length, max: MAX_HOUSEHOLDS })}
        />
      }
    >
      {list.loading && households.length === 0 ? <Loading /> : null}

      {!list.loading && households.length === 0 ? (
        <EmptyState
          icon="people"
          title={t('household.none.title')}
          body={t('household.none.body')}
        />
      ) : null}

      {households.map((entry) => {
        const active = entry.household.id === household?.id;
        return (
          <Card
            key={entry.household.id}
            title={entry.household.name}
            subtitle={t('households.code', { code: entry.household.inviteCode })}
            onPress={() =>
              active
                ? router.push('/manage-household')
                : switchHousehold(entry.household.id).then(() => undefined)
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              {active ? (
                <Badge label={t('households.active')} tone="accent" icon="check" />
              ) : (
                <Badge label={t('households.switchTo')} />
              )}
              <Badge
                label={
                  entry.role === 'admin' ? t('household.role.admin') : t('household.role.member')
                }
              />
            </View>
          </Card>
        );
      })}

      {household ? (
        <Button
          label={t('households.manage')}
          icon="settings"
          variant="secondary"
          onPress={() => router.push('/manage-household')}
        />
      ) : null}

      <Card title={t('household.create.title')} subtitle={t('household.create.body')}>
        <Input
          label={t('household.field.name')}
          placeholder={t('household.field.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          editable={!atLimit}
        />
        <Button
          label={t('household.create.action')}
          icon="home"
          onPress={handleCreate}
          loading={busy}
          disabled={atLimit}
        />
      </Card>

      <Card title={t('household.join.title')} subtitle={t('household.join.body')}>
        <Input
          label={t('household.field.code')}
          placeholder="ABC123"
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setMessage(null);
          }}
          autoCapitalize="none"
          editable={!atLimit}
        />
        <Button
          label={t('household.join.action')}
          icon="people"
          variant="secondary"
          onPress={handleJoin}
          loading={busy}
          disabled={atLimit}
        />
      </Card>

      {message ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
          <Icon name="warning" size={16} color={theme.colors.danger} />
          <Text variant="caption" tone="danger">
            {message}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
