import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { savings as savingsRepo, useLiveQuery } from '@/db';
import { formatMoney, formatNumber, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FloatingButton,
  Header,
  Input,
  Screen,
  Sheet,
  Text,
} from '@/ui';

import { parseAmount } from './amount';
import { ProgressBar, RemoveButton } from './parts';

/** Was man mit einem Tipp aufs Ziel legt. */
const DEPOSITS = [20, 50, 100, 500] as const;

/** Ein Ziel, ein Betrag — und ein Balken, der wandert. */
export function SavingsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<'name' | 'amount' | null>(null);

  const list = useLiveQuery(() => savingsRepo.list(account.id), [account.id]);
  const rows = list.data ?? [];
  const saved = rows.reduce((total, row) => total + row.savedChf, 0);
  const wanted = rows.reduce((total, row) => total + row.targetChf, 0);

  const money = (value: number) => formatMoney(language, value);

  async function save() {
    const value = parseAmount(target);
    if (name.trim().length === 0) {
      setError('name');
      return;
    }
    if (value === null) {
      setError('amount');
      return;
    }
    await savingsRepo.add({ accountId: account.id, name, targetChf: value });
    setName('');
    setTarget('');
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
              ? t('savings.total', { saved: money(saved), target: money(wanted) })
              : t('savings.empty.title')
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon="star" title={t('savings.empty.title')} body={t('savings.empty.body')} />
      ) : (
        rows.map((row) => {
          const reached = row.savedChf >= row.targetChf;
          return (
            <Card key={row.id}>
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="title">{row.name}</Text>
                  </View>
                  <RemoveButton onPress={() => void savingsRepo.remove(row.id)} />
                </View>

                <ProgressBar share={row.targetChf > 0 ? row.savedChf / row.targetChf : 0} />
                <Text variant="caption" tone="muted">
                  {reached
                    ? t('savings.reached')
                    : t('savings.progress', {
                        saved: money(row.savedChf),
                        target: money(row.targetChf),
                      })}
                </Text>

                {reached ? null : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                    {DEPOSITS.map((amount) => (
                      <Chip
                        key={amount}
                        label={t('savings.deposit', { amount: formatNumber(language, amount) })}
                        onPress={() => void savingsRepo.deposit(row.id, amount)}
                      />
                    ))}
                  </View>
                )}
              </View>
            </Card>
          );
        })
      )}

      <FloatingButton label={t('savings.add')} onPress={() => setAdding(true)} />

      <Sheet
        visible={adding}
        onClose={() => {
          setError(null);
          setAdding(false);
        }}
        title={t('savings.add')}
      >
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <Input
            label={t('savings.name')}
            placeholder={t('savings.namePlaceholder')}
            value={name}
            onChangeText={setName}
            {...(error === 'name' ? { error: t('money.error.name') } : {})}
          />
          <Input
            label={t('savings.target')}
            placeholder={t('money.amountPlaceholder')}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            {...(error === 'amount' ? { error: t('money.error.amount') } : {})}
          />
          <Button label={t('common.done')} icon="check" onPress={save} />
        </View>
      </Sheet>
    </Screen>
  );
}
