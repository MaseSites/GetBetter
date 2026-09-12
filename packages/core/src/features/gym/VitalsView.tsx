import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dayKey, useLiveQuery, vitals as vitalRepo, type VitalKind, type VitalRow } from '@/db';
import { DayPicker } from '@/features/shared/DayPicker';
import { parseAmount } from '@/features/money/amount';
import { relativeDay } from '@/features/shared/days';
import { formatNumber, useI18n, type TranslationKey } from '@/i18n';
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
  Text,
} from '@/ui';

import { RemoveButton } from '../money/parts';

const KINDS: readonly VitalKind[] = ['weight', 'bp', 'pulse'];
const BAR_HEIGHT = 72;
const BARS = 10;

/** Werte als Verlauf: die letzte Zahl gross, davor der Unterschied, darunter Balken. */
export function VitalsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [kind, setKind] = useState<VitalKind>('weight');
  const [adding, setAdding] = useState(false);

  const list = useLiveQuery(() => vitalRepo.list(account.id, kind), [account.id, kind]);
  const rows = list.data ?? [];
  const latest = rows[0];
  const previous = rows[1];
  const unit = t(`vitals.unit.${kind}` as TranslationKey);

  const show = (row: VitalRow) =>
    kind === 'bp' && row.value2 !== null
      ? `${formatNumber(language, row.value)}/${formatNumber(language, row.value2)}`
      : formatNumber(language, row.value);

  const delta = latest && previous ? Math.round((latest.value - previous.value) * 10) / 10 : null;
  const deltaText =
    delta === null
      ? null
      : delta > 0
        ? t('vitals.delta.up', { delta: formatNumber(language, delta) })
        : delta < 0
          ? t('vitals.delta.down', { delta: formatNumber(language, -delta) })
          : t('vitals.delta.same');

  // Die letzten Werte als Balken, der hoechste fuellt die Hoehe.
  const recent = [...rows.slice(0, BARS)].reverse();
  const max = Math.max(...recent.map((row) => row.value), 1);
  const min = Math.min(...recent.map((row) => row.value), max);
  const span = Math.max(max - min, 1);

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={latest ? `${show(latest)} ${unit}` : t('vitals.empty.title')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      <Segmented
        options={KINDS.map((entry) => ({
          value: entry,
          label: t(`vitals.kind.${entry}` as TranslationKey),
        }))}
        value={kind}
        onChange={setKind}
        accessibilityLabel={module.name}
      />

      {rows.length === 0 ? (
        <EmptyState title={t('vitals.empty.title')} body={t('vitals.empty.body')} />
      ) : (
        <Card>
          <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
            <Text variant="display">
              {latest ? show(latest) : ''}{' '}
              <Text variant="label" tone="muted">
                {unit}
              </Text>
            </Text>
            {deltaText ? (
              <Text variant="caption" tone="muted">
                {deltaText}
              </Text>
            ) : null}

            {recent.length > 1 ? (
              <View style={[styles.bars, { height: BAR_HEIGHT, gap: theme.spacing.xs }]}>
                {recent.map((row) => (
                  <View
                    key={row.id}
                    style={{
                      flex: 1,
                      height: Math.max(6, ((row.value - min) / span) * BAR_HEIGHT * 0.8 + 6),
                      borderRadius: theme.radii.sm,
                      backgroundColor:
                        row.id === latest?.id ? theme.colors.accent : theme.colors.surfaceMuted,
                    }}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </Card>
      )}

      {rows.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('vitals.history')}
          </Text>
          <Card>
            {rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow onDelete={() => void vitalRepo.remove(row.id)}>
                  <ListItem
                    title={`${show(row)} ${unit}`}
                    subtitle={relativeDay(t, language, row.day)}
                    right={<RemoveButton onPress={() => void vitalRepo.remove(row.id)} />}
                  />
                </SwipeRow>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <FloatingButton label={t('vitals.add')} onPress={() => setAdding(true)} />

      <VitalAdd
        key={kind}
        visible={adding}
        kind={kind}
        accountId={account.id}
        onClose={() => setAdding(false)}
      />
    </Screen>
  );
}

function VitalAdd({
  visible,
  kind,
  accountId,
  onClose,
}: {
  visible: boolean;
  kind: VitalKind;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [day, setDay] = useState<string | null>(dayKey());
  const [error, setError] = useState(false);

  async function save() {
    const first = parseAmount(value);
    const second = kind === 'bp' ? parseAmount(value2) : null;
    if (first === null || (kind === 'bp' && second === null) || !day) {
      setError(true);
      return;
    }
    await vitalRepo.add({ accountId, kind, day, value: first, value2: second });
    setValue('');
    setValue2('');
    setError(false);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t(`vitals.kind.${kind}` as TranslationKey)}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={
            kind === 'bp'
              ? `${t('vitals.systolic')} (${t('vitals.unit.bp')})`
              : t(`vitals.unit.${kind}` as TranslationKey)
          }
          placeholder={kind === 'weight' ? '72.5' : kind === 'bp' ? '120' : '62'}
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          {...(error ? { error: t('vitals.error.value') } : {})}
        />
        {kind === 'bp' ? (
          <Input
            label={`${t('vitals.diastolic')} (${t('vitals.unit.bp')})`}
            placeholder="80"
            value={value2}
            onChangeText={setValue2}
            keyboardType="number-pad"
          />
        ) : null}
        <DayPicker value={day} onChange={setDay} allowNone={false} />
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', width: '100%' },
});
