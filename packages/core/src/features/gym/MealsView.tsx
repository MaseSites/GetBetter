import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { dayKey, meals as mealRepo, useLiveQuery } from '@/db';
import { useI18n, type TranslationKey } from '@/i18n';
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

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/** Ein grober Tagesbedarf. Kein medizinischer Wert, nur ein Anhaltspunkt. */
const DAILY_TARGET = 2000;

/** Was heute gegessen wurde, mit Kalorien. */
export function MealsView({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [slot, setSlot] = useState<string>(SLOTS[0]);
  const [error, setError] = useState<string | null>(null);

  const list = useLiveQuery(() => mealRepo.listDay(account.id, today), [account.id, today]);
  const rows = list.data ?? [];
  const total = rows.reduce((sum, row) => sum + row.kcal, 0);

  async function save() {
    const value = Number(kcal.replace(',', '.'));
    if (name.trim().length === 0) {
      setError(t('meals.error.name'));
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('meals.error.kcal'));
      return;
    }
    await mealRepo.add({ accountId: account.id, day: today, name, kcal: value, slot });
    setName('');
    setKcal('');
    setError(null);
    setAdding(false);
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t('meals.today', { kcal: total, target: DAILY_TARGET })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon="meal" title={t('meals.empty.title')} body={t('meals.empty.body')} />
      ) : (
        <Card>
          <View>
            {rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={row.name}
                  subtitle={t(`meals.slot.${row.slot}` as TranslationKey)}
                  right={
                    <Text variant="label" tone="muted">
                      {t('meals.kcal', { kcal: row.kcal })}
                    </Text>
                  }
                  onPress={() => void mealRepo.remove(row.id)}
                />
              </View>
            ))}
          </View>
        </Card>
      )}

      <FloatingButton label={t('meals.add')} onPress={() => setAdding(true)} />

      <Sheet visible={adding} onClose={() => setAdding(false)} title={t('meals.add')}>
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {SLOTS.map((entry) => (
              <Chip
                key={entry}
                label={t(`meals.slot.${entry}` as TranslationKey)}
                selected={slot === entry}
                onPress={() => setSlot(entry)}
              />
            ))}
          </View>

          <Input
            label={t('meals.name')}
            placeholder={t('meals.namePlaceholder')}
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError(null);
            }}
          />
          <Input
            label={t('meals.kcalLabel')}
            placeholder="450"
            value={kcal}
            onChangeText={(value) => {
              setKcal(value);
              setError(null);
            }}
            keyboardType="numeric"
            {...(error ? { error } : {})}
          />

          <Button label={t('common.done')} icon="check" onPress={save} />
        </View>
      </Sheet>
    </Screen>
  );
}
