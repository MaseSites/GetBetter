import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { bills as billRepo, dayKey, useLiveQuery } from '@/db';
import { formatMoney, formatShortDate, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  FloatingButton,
  Header,
  Input,
  ListItem,
  Screen,
  Sheet,
  Text,
} from '@/ui';

import { parseAmount } from './amount';
import { AmountCell } from './parts';

/** In wie vielen Tagen eine Rechnung faellig ist — die ueblichen Fristen. */
const DUE_IN = [0, 7, 14, 30] as const;
const DAY_MS = 86_400_000;

/** Offene Rechnungen nach Faelligkeit; antippen heisst bezahlt. */
export function BillsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueIn, setDueIn] = useState<number>(DUE_IN[1]);
  const [error, setError] = useState<'title' | 'amount' | null>(null);

  const open = useLiveQuery(() => billRepo.listOpen(account.id), [account.id]);
  const paid = useLiveQuery(() => billRepo.listPaid(account.id), [account.id]);
  const openRows = open.data ?? [];
  const paidRows = paid.data ?? [];
  const openTotal = openRows.reduce((total, row) => total + row.amountChf, 0);

  const money = (value: number) => formatMoney(language, value);

  async function save() {
    const value = parseAmount(amount);
    if (title.trim().length === 0) {
      setError('title');
      return;
    }
    if (value === null) {
      setError('amount');
      return;
    }
    await billRepo.add({
      accountId: account.id,
      title,
      amountChf: value,
      dueDay: dayKey(new Date(Date.now() + dueIn * DAY_MS)),
    });
    setTitle('');
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
            openRows.length > 0
              ? t('bills.open', { count: openRows.length, amount: money(openTotal) })
              : t('bills.empty.title')
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      {openRows.length === 0 ? (
        <EmptyState icon="mail" title={t('bills.empty.title')} body={t('bills.empty.body')} />
      ) : (
        <Card>
          <View>
            {openRows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={row.title}
                  icon="circle"
                  subtitle={
                    row.dueDay < today
                      ? t('bills.overdue', { date: formatShortDate(language, row.dueDay) })
                      : t('bills.dueOn', { date: formatShortDate(language, row.dueDay) })
                  }
                  tone={row.dueDay < today ? 'danger' : 'default'}
                  right={<AmountCell amount={money(row.amountChf)} />}
                  onPress={() => void billRepo.setPaid(row.id, true)}
                />
              </View>
            ))}
          </View>
        </Card>
      )}

      {paidRows.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('bills.paid')}
          </Text>
          <Card>
            <View style={{ opacity: 0.6 }}>
              {paidRows.map((row, index) => (
                <View key={row.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListItem
                    title={row.title}
                    icon="checkCircle"
                    subtitle={formatShortDate(language, row.paidAt ?? row.dueDay)}
                    right={
                      <AmountCell
                        amount={money(row.amountChf)}
                        onRemove={() => void billRepo.remove(row.id)}
                      />
                    }
                  />
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      <FloatingButton label={t('bills.add')} onPress={() => setAdding(true)} />

      <Sheet
        visible={adding}
        onClose={() => {
          setError(null);
          setAdding(false);
        }}
        title={t('bills.add')}
      >
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <Input
            label={t('bills.title')}
            placeholder={t('bills.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            {...(error === 'title' ? { error: t('money.error.name') } : {})}
          />
          <Input
            label={t('money.amount')}
            placeholder={t('money.amountPlaceholder')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            {...(error === 'amount' ? { error: t('money.error.amount') } : {})}
          />

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('bills.due')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {DUE_IN.map((days) => (
                <Chip
                  key={days}
                  label={days === 0 ? t('bills.due.today') : t('bills.due.days', { days })}
                  selected={dueIn === days}
                  onPress={() => setDueIn(days)}
                />
              ))}
            </View>
          </View>

          <Button label={t('common.done')} icon="check" onPress={save} />
        </View>
      </Sheet>
    </Screen>
  );
}
