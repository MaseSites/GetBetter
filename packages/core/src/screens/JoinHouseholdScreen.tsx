import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MAX_HOUSEHOLDS } from '@/db';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Header, Icon, Input, Screen, Text } from '@/ui';

/** Ziel des Einladungslinks: der Code steht dann schon im Feld. */
export function JoinHouseholdScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { account, joinHousehold } = useApp();

  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!account) return null;

  async function join() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await joinHousehold(code);
      if (!result.ok) {
        setError(
          result.error === 'already_member'
            ? t('household.error.member')
            : result.error === 'limit'
              ? t('households.error.limit', { max: MAX_HOUSEHOLDS })
              : t('household.error.code'),
        );
        return;
      }
      router.replace('/household');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <Header
          title={t('household.join.title')}
          subtitle={t('household.join.body')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/household'))}
        />
      }
      footer={
        <Button label={t('household.join.action')} icon="people" onPress={join} loading={busy} />
      }
    >
      <Card>
        <Input
          label={t('household.field.code')}
          placeholder="ABC123"
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setError(null);
          }}
          autoCapitalize="none"
          onSubmitEditing={join}
          returnKeyType="done"
          {...(error ? { error } : {})}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
          <Icon name="info" size={16} color={theme.colors.textFaint} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="faint">
              {t('joinHousehold.hint')}
            </Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}
