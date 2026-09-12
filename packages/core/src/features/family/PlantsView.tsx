import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  dayKey,
  plantDueDay as dueDayOf,
  plants as plantRepo,
  useLiveQuery,
  type PlantRow,
} from '@/db';
import { daysUntil, relativeDay } from '@/features/shared/days';
import { useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
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

/** Alle wie viele Tage giessen — die ueblichen Rhythmen. */
const INTERVALS = [2, 3, 7, 14] as const;

type Editor = { mode: 'new' } | { mode: 'edit'; row: PlantRow } | null;

/** Pflanzen wie in Planta: was heute dran ist, steht oben; ein Tipp giesst. */
export function PlantsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;
  const today = dayKey();

  const [editor, setEditor] = useState<Editor>(null);

  const list = useLiveQuery(
    () => plantRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const rows = [...(list.data ?? [])].sort((a, b) => dueDayOf(a).localeCompare(dueDayOf(b)));
  const due = rows.filter((plant) => dueDayOf(plant) <= today);
  const later = rows.filter((plant) => dueDayOf(plant) > today);

  function card(plant: PlantRow) {
    const dueDay = dueDayOf(plant);
    const diff = daysUntil(dueDay);
    // Nach links wischen loescht — wie der Papierkorb unten in der Karte.
    return (
      <SwipeRow
        key={plant.id}
        radius={theme.radii.md}
        onDelete={() => void plantRepo.remove(plant.id)}
      >
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <View style={[styles.row, { gap: theme.spacing.sm }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title">{plant.name}</Text>
                <Text variant="caption" tone="muted">
                  {plant.location
                    ? `${plant.location} · ${t('plants.every', { days: plant.intervalDays })}`
                    : t('plants.every', { days: plant.intervalDays })}
                </Text>
              </View>
              <Text variant="label" tone={diff < 0 ? 'danger' : diff === 0 ? 'accent' : 'muted'}>
                {diff < 0 ? t('plants.overdue', { days: -diff }) : relativeDay(t, language, dueDay)}
              </Text>
            </View>
            <View style={[styles.row, { gap: theme.spacing.sm }]}>
              <Button
                label={t('plants.watered')}
                icon="water"
                size="sm"
                fullWidth={false}
                variant={diff <= 0 ? 'primary' : 'secondary'}
                onPress={() => void plantRepo.water(plant.id, today)}
              />
              <View style={{ flex: 1 }} />
              <IconButton
                icon="note"
                label={t('plants.edit')}
                onPress={() => setEditor({ mode: 'edit', row: plant })}
              />
              <IconButton
                icon="trash"
                label={t('common.remove')}
                onPress={() => void plantRepo.remove(plant.id)}
              />
            </View>
          </View>
        </Card>
      </SwipeRow>
    );
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            rows.length === 0
              ? t('plants.empty.title')
              : due.length > 0
                ? t('plants.dueCount', { count: due.length })
                : t('plants.calm')
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState title={t('plants.empty.title')} body={t('plants.empty.body')} />
      ) : null}

      {due.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="accent">
            {t('plants.today')}
          </Text>
          {due.map(card)}
        </View>
      ) : null}

      {later.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('plants.later')}
          </Text>
          {later.map(card)}
        </View>
      ) : null}

      <FloatingButton label={t('plants.add')} onPress={() => setEditor({ mode: 'new' })} />

      <PlantEditor
        key={editor?.mode === 'edit' ? editor.row.id : (editor?.mode ?? 'closed')}
        editor={editor}
        scope={{ accountId: account.id, householdId }}
        onClose={() => setEditor(null)}
      />
    </Screen>
  );
}

function PlantEditor({
  editor,
  scope,
  onClose,
}: {
  editor: Editor;
  scope: { accountId: string; householdId: string | null };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const existing = editor?.mode === 'edit' ? editor.row : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [interval, setInterval] = useState<number>(existing?.intervalDays ?? INTERVALS[2]);
  const [error, setError] = useState(false);

  async function save() {
    if (name.trim().length === 0) {
      setError(true);
      return;
    }
    if (existing) {
      await plantRepo.update(existing.id, { name, location, intervalDays: interval });
    } else {
      await plantRepo.add(scope, { name, location, intervalDays: interval });
    }
    onClose();
  }

  return (
    <Sheet
      visible={editor !== null}
      onClose={onClose}
      title={existing ? t('plants.edit') : t('plants.add')}
    >
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={t('plants.name')}
          placeholder={t('plants.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          {...(error ? { error: t('money.error.name') } : {})}
        />
        <Input
          label={t('plants.location')}
          placeholder={t('plants.locationPlaceholder')}
          value={location}
          onChangeText={setLocation}
          autoCapitalize="sentences"
        />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('plants.interval')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {INTERVALS.map((days) => (
              <Chip
                key={days}
                label={t('plants.every', { days })}
                selected={interval === days}
                onPress={() => setInterval(days)}
              />
            ))}
          </View>
        </View>
        <Button label={t('common.done')} icon="check" onPress={save} />
        {existing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.remove')}
            onPress={() => {
              void plantRepo.remove(existing.id);
              onClose();
            }}
            style={[styles.removeRow, { gap: theme.spacing.sm, paddingVertical: theme.spacing.md }]}
          >
            <Icon name="trash" size={18} color={theme.colors.danger} />
            <Text variant="label" tone="danger">
              {t('common.remove')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
