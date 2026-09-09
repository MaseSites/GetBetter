import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  budgets as budgetRepo,
  dayKey,
  expenses as expenseRepo,
  monthKey,
  useLiveQuery,
} from '@/db';
import { formatMoney, formatShortDate, useI18n, type TranslationKey } from '@/i18n';
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
import { AmountCell, ProgressBar } from './parts';

/** Vorschlaege, damit man nicht jedes Mal tippen muss. */
const CATEGORIES = ['food', 'home', 'transport', 'fun', 'health', 'other'] as const;

/** Was diesen Monat rausging — und wie viel vom Budget noch da ist. */
export function BudgetView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const month = monthKey();

  const [adding, setAdding] = useState(false);
  const [settingLimit, setSettingLimit] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [limitDraft, setLimitDraft] = useState('');
  const [error, setError] = useState(false);

  const list = useLiveQuery(() => expenseRepo.listMonth(account.id, month), [account.id, month]);
  const limit = useLiveQuery(() => budgetRepo.limitOf(account.id, month), [account.id, month]);
  const rows = list.data ?? [];
  const spent = rows.reduce((total, row) => total + row.amountChf, 0);
  const limitChf = limit.data ?? null;
  const share = limitChf ? spent / limitChf : 0;

  const money = (value: number) => formatMoney(language, value);
  const categoryLabel = (id: string) =>
    (CATEGORIES as readonly string[]).includes(id)
      ? t(`budget.category.${id}` as TranslationKey)
      : id;

  async function save() {
    const value = parseAmount(amount);
    if (value === null) {
      setError(true);
      return;
    }
    await expenseRepo.add({
      accountId: account.id,
      day: dayKey(),
      amountChf: value,
      category,
      note,
    });
    setAmount('');
    setNote('');
    setError(false);
    setAdding(false);
  }

  async function saveLimit() {
    const value = parseAmount(limitDraft);
    if (value === null) {
      setError(true);
      return;
    }
    await budgetRepo.setLimit(account.id, month, value);
    setLimitDraft('');
    setError(false);
    setSettingLimit(false);
  }

  function close() {
    setError(false);
    setAdding(false);
    setSettingLimit(false);
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            limitChf
              ? t('budget.ofLimit', { spent: money(spent), limit: money(limitChf) })
              : t('budget.spent', { amount: money(spent) })
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      <Card>
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Text variant="display">{money(spent)}</Text>
          {limitChf ? (
            <>
              <ProgressBar share={share} warn={share > 1} />
              <Text variant="caption" tone="muted">
                {share > 1
                  ? t('budget.over', { amount: money(spent - limitChf) })
                  : t('budget.left', { amount: money(limitChf - spent) })}
              </Text>
            </>
          ) : null}
          <Button
            label={t('budget.setLimit')}
            variant="ghost"
            icon="wallet"
            fullWidth={false}
            onPress={() => {
              setLimitDraft(limitChf ? String(limitChf) : '');
              setSettingLimit(true);
            }}
          />
        </View>
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon="wallet" title={t('budget.empty.title')} body={t('budget.empty.body')} />
      ) : (
        <Card>
          <View>
            {rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={categoryLabel(row.category)}
                  subtitle={row.note ?? formatShortDate(language, row.day)}
                  right={
                    <AmountCell
                      amount={money(row.amountChf)}
                      onRemove={() => void expenseRepo.remove(row.id)}
                    />
                  }
                />
              </View>
            ))}
          </View>
        </Card>
      )}

      <FloatingButton label={t('budget.add')} onPress={() => setAdding(true)} />

      <Sheet visible={adding} onClose={close} title={t('budget.add')}>
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <Input
            label={t('money.amount')}
            placeholder={t('money.amountPlaceholder')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            {...(error ? { error: t('money.error.amount') } : {})}
          />

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('budget.category')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {CATEGORIES.map((entry) => (
                <Chip
                  key={entry}
                  label={categoryLabel(entry)}
                  selected={category === entry}
                  onPress={() => setCategory(entry)}
                />
              ))}
            </View>
          </View>

          <Input
            label={t('budget.note')}
            placeholder={t('common.optional')}
            value={note}
            onChangeText={setNote}
          />

          <Button label={t('common.done')} icon="check" onPress={save} />
        </View>
      </Sheet>

      <Sheet visible={settingLimit} onClose={close} title={t('budget.limit')}>
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <Input
            label={t('money.amount')}
            placeholder={t('money.amountPlaceholder')}
            value={limitDraft}
            onChangeText={setLimitDraft}
            keyboardType="decimal-pad"
            {...(error ? { error: t('money.error.amount') } : {})}
          />
          <Button label={t('common.done')} icon="check" onPress={saveLimit} />
        </View>
      </Sheet>
    </Screen>
  );
}
