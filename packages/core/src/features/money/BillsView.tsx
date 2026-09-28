import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { bills as billRepo, dayKey, useLiveQuery } from '@/db';
import { parseDay, shiftDay } from '@/features/shared/days';
import { formatMoney, formatShortDate, useI18n, type TranslationKey } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
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
  SwipeRow,
  Text,
} from '@/ui';

import { parseAmount } from './amount';
import { AmountCell } from './parts';
import { parseQrBill } from './qrBill';

/** In wie vielen Tagen eine Rechnung faellig ist — die ueblichen Fristen. */
const DUE_IN = [0, 7, 14, 30] as const;

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
  // Der Faelligkeitstag selbst: die Chips setzen ihn, die QR-Rechnung auch auf jeden anderen Tag.
  const [dueDay, setDueDay] = useState<string>(() => shiftDay(DUE_IN[1]));
  const [error, setError] = useState<'title' | 'amount' | null>(null);
  // QR-Rechnung einfuegen: der Text aus dem QR-Code, und was daraus wurde.
  const [qrOpen, setQrOpen] = useState(false);
  const [qrText, setQrText] = useState('');
  const [qrMessage, setQrMessage] = useState<TranslationKey | null>(null);

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
      dueDay,
    });
    reset();
  }

  function reset() {
    setTitle('');
    setAmount('');
    setDueDay(shiftDay(DUE_IN[1]));
    setError(null);
    setQrOpen(false);
    setQrText('');
    setQrMessage(null);
    setAdding(false);
  }

  /** Den Text aus dem QR-Code lesen und Empfaenger, Betrag und Faelligkeit vorfuellen. */
  function applyQr() {
    const result = parseQrBill(qrText);
    if (!result.ok) {
      setQrMessage(`moneyplus.qr.error.${result.reason}` as TranslationKey);
      return;
    }
    const { bill } = result;
    setTitle(bill.creditor.name);
    // Rechnungen fuehren wir in Franken — einen Euro-Betrag rechnen wir nicht still um.
    if (bill.amount !== null && bill.currency === 'CHF') setAmount(bill.amount.toFixed(2));
    const due = bill.billInfo?.dueDay;
    if (due) setDueDay(due);
    setError(null);
    setQrText('');
    setQrOpen(false);
    setQrMessage(bill.currency === 'EUR' ? 'moneyplus.qr.eur' : null);
  }

  return (
    <Screen
      floating
      header={
        <Header
          title={moduleName(t, module.id)}
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
        <EmptyState title={t('bills.empty.title')} body={t('bills.empty.body')} />
      ) : (
        <Card>
          <View>
            {/* Antippen heisst bezahlt, nach links wischen loescht. */}
            {openRows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow onDelete={() => void billRepo.remove(row.id)}>
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
                </SwipeRow>
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
                  <SwipeRow onDelete={() => void billRepo.remove(row.id)}>
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
                  </SwipeRow>
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      <FloatingButton label={t('bills.add')} onPress={() => setAdding(true)} />

      <Sheet visible={adding} onClose={reset} title={t('bills.add')}>
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          {qrOpen ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Input
                label={t('moneyplus.qr.label')}
                placeholder={t('moneyplus.qr.placeholder')}
                value={qrText}
                onChangeText={(text) => {
                  setQrText(text);
                  setQrMessage(null);
                }}
                multiline
                autoCapitalize="none"
                {...(qrMessage && qrMessage !== 'moneyplus.qr.eur' ? { error: t(qrMessage) } : {})}
              />
              <Button
                label={t('moneyplus.qr.apply')}
                variant="ghost"
                icon="check"
                onPress={applyQr}
              />
            </View>
          ) : (
            <Button
              label={t('moneyplus.qr.open')}
              variant="ghost"
              icon="copy"
              fullWidth={false}
              onPress={() => setQrOpen(true)}
            />
          )}
          {qrMessage === 'moneyplus.qr.eur' ? (
            <Text variant="caption" tone="muted">
              {t(qrMessage)}
            </Text>
          ) : null}
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
                  selected={dueDay === shiftDay(days)}
                  onPress={() => setDueDay(shiftDay(days))}
                />
              ))}
              {/* Ein Tag aus der QR-Rechnung, der keiner der Fristen entspricht. */}
              {DUE_IN.some((days) => shiftDay(days) === dueDay) ? null : (
                <Chip
                  label={t('moneyplus.bill.dueOn', {
                    date: formatShortDate(language, parseDay(dueDay).toISOString()),
                  })}
                  selected
                  onPress={() => undefined}
                />
              )}
            </View>
          </View>

          <Button label={t('common.done')} icon="check" onPress={save} />
        </View>
      </Sheet>
    </Screen>
  );
}
