import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLiveQuery, vehicles as vehicleRepo, type VehicleRow } from '@/db';
import { DayPicker } from '@/features/shared/DayPicker';
import { daysUntil, relativeDay } from '@/features/shared/days';
import { formatNumber, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  FloatingButton,
  Header,
  Icon,
  Input,
  Screen,
  Sheet,
  Text,
} from '@/ui';

/** Ab wann Service oder Reifen als "faellig" gelten. */
const DUE_DAYS = 30;

type Editor = { mode: 'new' } | { mode: 'edit'; row: VehicleRow } | null;

/** Fahrzeuge mit dem, was man sonst vergisst: Service, Vignette, Reifen. */
export function VehiclesView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;
  const thisYear = new Date().getFullYear();

  const [editor, setEditor] = useState<Editor>(null);

  const list = useLiveQuery(
    () => vehicleRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const rows = list.data ?? [];

  /** Was an einem Fahrzeug bald ansteht — als Zeilen fuer die Karte. */
  function dueLines(vehicle: VehicleRow): { label: string; value: string; warn: boolean }[] {
    const lines: { label: string; value: string; warn: boolean }[] = [];
    const dated = (label: string, day: string | null) => {
      if (!day) return lines.push({ label, value: '—', warn: false });
      const diff = daysUntil(day);
      return lines.push({
        label,
        value: diff < 0 ? t('vehicles.overdue') : relativeDay(t, language, day),
        warn: diff <= DUE_DAYS,
      });
    };
    dated(t('vehicles.service'), vehicle.serviceOn);
    dated(t('vehicles.tyres'), vehicle.tyresOn);
    const vignetteOk = vehicle.vignetteYear !== null && vehicle.vignetteYear >= thisYear;
    lines.push({
      label: t('vehicles.vignette'),
      value: vignetteOk ? String(vehicle.vignetteYear) : t('vehicles.vignetteMissing'),
      warn: !vignetteOk,
    });
    if (vehicle.mileage !== null) {
      lines.push({
        label: t('vehicles.mileage'),
        value: t('vehicles.km', { km: formatNumber(language, vehicle.mileage) }),
        warn: false,
      });
    }
    return lines;
  }

  const warnings = rows.reduce(
    (total, vehicle) => total + dueLines(vehicle).filter((line) => line.warn).length,
    0,
  );

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            rows.length === 0
              ? t('vehicles.empty.title')
              : warnings > 0
                ? t('vehicles.dueCount', { count: warnings })
                : t('vehicles.calm')
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon="car" title={t('vehicles.empty.title')} body={t('vehicles.empty.body')} />
      ) : null}

      {rows.map((vehicle) => (
        <Card
          key={vehicle.id}
          onPress={() => setEditor({ mode: 'edit', row: vehicle })}
          accessibilityLabel={vehicle.name}
        >
          <View style={{ gap: theme.spacing.sm }}>
            <View style={[styles.row, { gap: theme.spacing.sm }]}>
              <Icon name="car" size={20} color={theme.colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text variant="title">{vehicle.name}</Text>
              </View>
              {vehicle.plate ? (
                <Text variant="label" tone="muted">
                  {vehicle.plate}
                </Text>
              ) : null}
            </View>
            {dueLines(vehicle).map((line, index) => (
              <View key={line.label}>
                {index > 0 ? <Divider /> : null}
                <View style={[styles.row, { paddingVertical: theme.spacing.xs }]}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label" tone="muted">
                      {line.label}
                    </Text>
                  </View>
                  <Text variant="label" tone={line.warn ? 'danger' : 'default'}>
                    {line.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      ))}

      <FloatingButton label={t('vehicles.add')} onPress={() => setEditor({ mode: 'new' })} />

      <VehicleEditor
        key={editor?.mode === 'edit' ? editor.row.id : (editor?.mode ?? 'closed')}
        editor={editor}
        scope={{ accountId: account.id, householdId }}
        thisYear={thisYear}
        onClose={() => setEditor(null)}
      />
    </Screen>
  );
}

function VehicleEditor({
  editor,
  scope,
  thisYear,
  onClose,
}: {
  editor: Editor;
  scope: { accountId: string; householdId: string | null };
  thisYear: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const existing = editor?.mode === 'edit' ? editor.row : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [plate, setPlate] = useState(existing?.plate ?? '');
  const [serviceOn, setServiceOn] = useState<string | null>(existing?.serviceOn ?? null);
  const [tyresOn, setTyresOn] = useState<string | null>(existing?.tyresOn ?? null);
  const [vignette, setVignette] = useState<number | null>(existing?.vignetteYear ?? null);
  const [mileage, setMileage] = useState(existing?.mileage ? String(existing.mileage) : '');
  const [error, setError] = useState(false);

  async function save() {
    if (name.trim().length === 0) {
      setError(true);
      return;
    }
    const km = Number(mileage.replace(/[^\d]/g, ''));
    const fields = {
      name,
      plate,
      serviceOn,
      tyresOn,
      vignetteYear: vignette,
      mileage: mileage.trim().length > 0 && Number.isFinite(km) ? km : null,
    };
    if (existing) await vehicleRepo.update(existing.id, fields);
    else await vehicleRepo.add(scope, fields);
    onClose();
  }

  async function remove() {
    if (existing) await vehicleRepo.remove(existing.id);
    onClose();
  }

  return (
    <Sheet
      visible={editor !== null}
      onClose={onClose}
      title={existing ? t('vehicles.edit') : t('vehicles.add')}
      fullScreen
    >
      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        <Input
          label={t('vehicles.name')}
          placeholder={t('vehicles.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          {...(error ? { error: t('money.error.name') } : {})}
        />
        <Input
          label={t('vehicles.plate')}
          placeholder={t('vehicles.platePlaceholder')}
          value={plate}
          onChangeText={setPlate}
          autoCapitalize="none"
        />
        <DayPicker label={t('vehicles.service')} value={serviceOn} onChange={setServiceOn} />
        <DayPicker label={t('vehicles.tyres')} value={tyresOn} onChange={setTyresOn} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('vehicles.vignette')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            <Chip
              label={t('vehicles.vignetteMissing')}
              selected={vignette === null}
              onPress={() => setVignette(null)}
            />
            {[thisYear, thisYear + 1].map((year) => (
              <Chip
                key={year}
                label={String(year)}
                selected={vignette === year}
                onPress={() => setVignette(year)}
              />
            ))}
          </View>
        </View>
        <Input
          label={t('vehicles.mileage')}
          placeholder={t('common.optional')}
          value={mileage}
          onChangeText={setMileage}
          keyboardType="number-pad"
        />
        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t('common.done')} icon="check" onPress={save} />
          {existing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.remove')}
              onPress={remove}
              style={[
                styles.removeRow,
                { gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
              ]}
            >
              <Icon name="trash" size={18} color={theme.colors.danger} />
              <Text variant="label" tone="danger">
                {t('common.remove')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
