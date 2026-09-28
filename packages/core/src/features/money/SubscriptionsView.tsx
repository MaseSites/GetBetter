import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  dayKey,
  subscriptions as subscriptionRepo,
  useLiveQuery,
  type SubscriptionInterval,
} from '@/db';
import { DayPicker } from '@/features/shared/DayPicker';
import { relativeDay } from '@/features/shared/days';
import { formatMoney, useI18n, type TranslationKey } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
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
  SwipeRow,
} from '@/ui';

import { parseAmount } from './amount';
import { nextChargeDay } from './nextCharge';
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
  // Vorgewaehlt heute: ein Tipp weniger, und wer es nicht weiss, waehlt "Kein Datum".
  const [startDay, setStartDay] = useState<string | null>(() => dayKey());
  const [error, setError] = useState<'name' | 'amount' | null>(null);

  const list = useLiveQuery(() => subscriptionRepo.list(account.id), [account.id]);
  const rows = list.data ?? [];
  const monthly = rows.reduce(
    (total, row) =>
      total + (row.interval === 'year' ? row.amountChf / MONTHS_PER_YEAR : row.amountChf),
    0,
  );

  const money = (value: number) => formatMoney(language, value);
  const today = dayKey();
  /** "Monatlich · In 3 Tagen" — ohne Datum nur, wie oft. */
  const subtitleOf = (row: (typeof rows)[number]) => {
    const intervalText = t(`subscriptions.interval.${row.interval}` as TranslationKey);
    const next = row.startDay ? nextChargeDay(row.startDay, row.interval, today) : null;
    return next
      ? t('moneyplus.sub.next', { interval: intervalText, when: relativeDay(t, language, next) })
      : intervalText;
  };

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
    await subscriptionRepo.add({
      accountId: account.id,
      name,
      amountChf: value,
      interval,
      startDay,
    });
    setName('');
    setAmount('');
    setStartDay(dayKey());
    setError(null);
    setAdding(false);
  }

  return (
    <Screen
      floating
      header={
        <Header
          title={moduleName(t, module.id)}
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
        <EmptyState title={t('subscriptions.empty.title')} body={t('subscriptions.empty.body')} />
      ) : (
        <Card>
          <View>
            {rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow onDelete={() => void subscriptionRepo.remove(row.id)}>
                  <ListItem
                    title={row.name}
                    subtitle={subtitleOf(row)}
                    right={
                      <AmountCell
                        amount={money(row.amountChf)}
                        onRemove={() => void subscriptionRepo.remove(row.id)}
                      />
                    }
                  />
                </SwipeRow>
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
          <DayPicker label={t('moneyplus.sub.startDay')} value={startDay} onChange={setStartDay} />
          <Button label={t('common.done')} icon="check" onPress={save} />
        </View>
      </Sheet>
    </Screen>
  );
}
