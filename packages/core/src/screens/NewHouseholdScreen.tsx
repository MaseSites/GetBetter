import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { households as householdRepo, useLiveQuery, MAX_HOUSEHOLDS } from '@/db';
import { HouseholdInvite } from '@/features/household/HouseholdInvite';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Header, Icon, Input, Screen, Text } from '@/ui';

/**
 * Anlegen und einladen in einem Zug: erst der Name, danach die drei Wege,
 * jemanden dazuzuholen.
 */
export function NewHouseholdScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { account, household, createHousehold } = useApp();

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const list = useLiveQuery(
    () => (account ? householdRepo.allOf(account.id) : Promise.resolve([])),
    [account?.id, createdId],
  );
  const atLimit = (list.data ?? []).length >= MAX_HOUSEHOLDS;

  if (!account) return null;

  async function create() {
    if (busy) return;
    if (name.trim().length === 0) {
      setError(t('household.error.name'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await createHousehold(name);
      if (!ok) {
        setError(t('households.error.limit', { max: MAX_HOUSEHOLDS }));
        return;
      }
      setCreatedId('created');
    } finally {
      setBusy(false);
    }
  }

  const done = createdId !== null && household !== null;

  return (
    <Screen
      header={
        <Header
          title={done ? household.name : t('household.create.title')}
          subtitle={done ? t('newHousehold.created') : t('household.create.body')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/household'))}
        />
      }
      footer={
        done ? (
          <Button
            label={t('common.done')}
            icon="check"
            onPress={() => router.replace('/household')}
          />
        ) : (
          <Button
            label={t('household.create.action')}
            icon="home"
            onPress={create}
            loading={busy}
            disabled={atLimit}
          />
        )
      }
    >
      {done ? (
        <HouseholdInvite household={household} />
      ) : (
        <Card>
          <Input
            label={t('household.field.name')}
            placeholder={t('household.field.namePlaceholder')}
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError(null);
            }}
            autoCapitalize="words"
            {...(error ? { error } : {})}
          />
          <Text variant="caption" tone="faint">
            {t('newHousehold.hint')}
          </Text>
        </Card>
      )}

      {atLimit && !done ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
          <Icon name="warning" size={16} color={theme.colors.danger} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="danger">
              {t('households.error.limit', { max: MAX_HOUSEHOLDS })}
            </Text>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
