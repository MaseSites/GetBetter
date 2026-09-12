import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dayKey, meds as medRepo, useLiveQuery, type MedRow, type MedSlot } from '@/db';
import { useI18n, type TranslationKey } from '@/i18n';
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
  Icon,
  IconButton,
  Input,
  Screen,
  Sheet,
  SwipeRow,
  Text,
} from '@/ui';

const SLOTS: readonly MedSlot[] = ['morning', 'noon', 'evening', 'night'];

/** Ab hier steht "Nachschub" dran. */
const LOW_STOCK = 5;

/** Medikamente: je Einnahmezeit ein Chip, ein Tipp heisst genommen. */
export function MedsView({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();

  const [adding, setAdding] = useState(false);

  const list = useLiveQuery(() => medRepo.list(account.id), [account.id]);
  const takeList = useLiveQuery(() => medRepo.takes(account.id, today), [account.id, today]);
  const rows = list.data ?? [];
  const takes = takeList.data ?? [];
  const taken = (med: MedRow, slot: MedSlot) =>
    takes.some((take) => take.medId === med.id && take.slot === slot);
  const total = rows.reduce((sum, med) => sum + med.slots.length, 0);
  const done = rows.reduce(
    (sum, med) => sum + med.slots.filter((slot) => taken(med, slot)).length,
    0,
  );
  const slotLabel = (slot: MedSlot) => t(`meds.slot.${slot}` as TranslationKey);

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            rows.length === 0
              ? t('meds.empty.title')
              : done >= total
                ? t('meds.allTaken')
                : t('meds.today', { taken: done, total })
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState title={t('meds.empty.title')} body={t('meds.empty.body')} />
      ) : null}

      {rows.map((med) => {
        const low = med.stock !== null && med.stock <= LOW_STOCK;
        return (
          // Nach links wischen loescht das Medikament; die Chips bleiben zum Antippen.
          <SwipeRow
            key={med.id}
            radius={theme.radii.md}
            onDelete={() => void medRepo.remove(med.id)}
          >
            <Card>
              <View style={{ gap: theme.spacing.md }}>
                <View style={[styles.row, { gap: theme.spacing.sm }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title">{med.name}</Text>
                    {med.dose ? (
                      <Text variant="caption" tone="muted">
                        {med.dose}
                      </Text>
                    ) : null}
                  </View>
                  {med.stock !== null ? (
                    <View style={[styles.row, { gap: theme.spacing.xs }]}>
                      {low ? <Icon name="warning" size={14} color={theme.colors.danger} /> : null}
                      <Text variant="label" tone={low ? 'danger' : 'muted'}>
                        {low ? t('meds.stockLow') : t('meds.stockCount', { count: med.stock })}
                      </Text>
                    </View>
                  ) : null}
                  <IconButton
                    icon="trash"
                    label={t('common.remove')}
                    onPress={() => void medRepo.remove(med.id)}
                  />
                </View>
                <View style={[styles.chips, { gap: theme.spacing.sm }]}>
                  {med.slots.map((slot) => (
                    <Chip
                      key={slot}
                      label={`${taken(med, slot) ? '✓ ' : ''}${slotLabel(slot)}`}
                      selected={taken(med, slot)}
                      onPress={() => void medRepo.toggle(med.id, account.id, today, slot)}
                    />
                  ))}
                </View>
              </View>
            </Card>
          </SwipeRow>
        );
      })}

      <FloatingButton label={t('meds.add')} onPress={() => setAdding(true)} />

      <MedAdd visible={adding} accountId={account.id} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function MedAdd({
  visible,
  accountId,
  onClose,
}: {
  visible: boolean;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [slots, setSlots] = useState<MedSlot[]>(['morning']);
  const [stock, setStock] = useState('');
  const [error, setError] = useState<'name' | 'slots' | null>(null);

  async function save() {
    if (name.trim().length === 0) {
      setError('name');
      return;
    }
    if (slots.length === 0) {
      setError('slots');
      return;
    }
    const count = Number(stock.replace(/[^\d]/g, ''));
    await medRepo.add({
      accountId,
      name,
      dose,
      slots: SLOTS.filter((slot) => slots.includes(slot)),
      stock: stock.trim().length > 0 && Number.isFinite(count) ? count : null,
    });
    setName('');
    setDose('');
    setSlots(['morning']);
    setStock('');
    setError(null);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('meds.add')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={t('meds.name')}
          placeholder={t('meds.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          {...(error === 'name' ? { error: t('money.error.name') } : {})}
        />
        <Input
          label={t('meds.dose')}
          placeholder={t('meds.dosePlaceholder')}
          value={dose}
          onChangeText={setDose}
        />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone={error === 'slots' ? 'danger' : 'muted'}>
            {error === 'slots' ? t('meds.error.slots') : t('meds.slots')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {SLOTS.map((slot) => (
              <Chip
                key={slot}
                label={t(`meds.slot.${slot}` as TranslationKey)}
                selected={slots.includes(slot)}
                onPress={() =>
                  setSlots((current) =>
                    current.includes(slot)
                      ? current.filter((entry) => entry !== slot)
                      : [...current, slot],
                  )
                }
              />
            ))}
          </View>
        </View>
        <Input
          label={t('meds.stock')}
          placeholder={t('common.optional')}
          value={stock}
          onChangeText={setStock}
          keyboardType="number-pad"
        />
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
