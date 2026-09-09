import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { subscriptions as subscriptionRepo, useLiveQuery, type SubscriptionInterval } from '@/db';
import { formatMoney, useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  FloatingButton,
  Header,
  Input,
  ListItem,
  Screen,
  Segmented,
  Sheet,
} from '@/ui';

import { parseAmount } from './amount';
import { AmountCell } from './parts';

const MONTHS_PER_YEAR = 12;

/** Was regelmaessig abgeht — und was das im Monat und im Jahr macht. */
export function SubscriptionsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState<SubscriptionInterval>('month');
  const [error, setError] = useState<'name' | 'amount' | null>(null);

  const list = useLiveQuery(() => subscriptionRepo.list(account.id), [account.id]);
  const rows = list.data ?? [];
  const monthly = rows.reduce(
    (total, row) =>
      total + (row.interval === 'year' ? row.amountChf / MONTHS_PER_YEAR : row.amountChf),
    0,
  );

  const money = (value: number) => formatMoney(language, value);

  async function save() {
    const value = parseAmount(amount);
    if (name.trim().length === 0) {
      setError('name');
      return;
    }
    if (value === null) {
      setError('amount');
      return;
    }
    await subscriptionRepo.add({ accountId: account.id, name, amountChf: value, interval });
    setName('');
    setAmount('');
    setError(null);
    setAdding(false);
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            rows.length > 0
              ? t('subscriptions.total', {
                  month: money(monthly),
                  year: money(monthly * MONTHS_PER_YEAR),
                })
              : t('subscriptions.empty.title')
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="repeat"
          title={t('subscriptions.empty.title')}
          body={t('subscriptions.empty.body')}
        />
      ) : (
        <Card>
          <View>
            {rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={row.name}
                  subtitle={t(`subscriptions.interval.${row.interval}` as TranslationKey)}
                  right={
                    <AmountCell
                      amount={money(row.amountChf)}
                      onRemove={() => void subscriptionRepo.remove(row.id)}
                    />
                  }
                />
              </View>
            ))}
          </View>
        </Card>
      )}

      <FloatingButton label={t('subscriptions.add')} onPress={() => setAdding(true)} />

      <Sheet
        visible={adding}
        onClose={() => {
          setError(null);
          setAdding(false);
        }}
        title={t('subscriptions.add')}
      >
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <Input
            label={t('subscriptions.name')}
            placeholder={t('subscriptions.namePlaceholder')}
            value={name}
            onChangeText={setName}
            {...(error === 'name' ? { error: t('money.error.name') } : {})}
          />
          <Input
            label={t('money.amount')}
            placeholder={t('money.amountPlaceholder')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            {...(error === 'amount' ? { error: t('money.error.amount') } : {})}
          />
          <Segmented
            options={[
              { value: 'month', label: t('subscriptions.interval.month') },
              { value: 'year', label: t('subscriptions.interval.year') },
            ]}
            value={interval}
            onChange={setInterval}
            accessibilityLabel={t('subscriptions.interval')}
          />
          <Button label={t('common.done')} icon="check" onPress={save} />
        </View>
      </Sheet>
    </Screen>
  );
}
