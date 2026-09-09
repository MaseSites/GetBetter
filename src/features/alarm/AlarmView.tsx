import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { useLiveQuery } from '@/db';
import { alarms as alarmRepo } from '@/db/repositories';
import { useTranslate, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, EmptyState, Header, Icon, Input, Loading, Screen, Sheet, Text } from '@/ui';

export const WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

function normaliseTime(input: string): string | null {
  const match = TIME_PATTERN.exec(input.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function AlarmView({ module }: { module: ModuleDefinition }) {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [composing, setComposing] = useState(false);

  const list = useLiveQuery(() => alarmRepo.list(account.id), [account.id]);
  const items = list.data ?? [];
  const next = items.find((alarm) => alarm.enabled);

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            next ? t('alarm.next', { time: next.time, label: next.label }) : t('alarm.noneActive')
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
      footer={<Button label={t('alarm.add')} icon="plus" onPress={() => setComposing(true)} />}
    >
      {list.loading && items.length === 0 ? <Loading /> : null}

      {!list.loading && items.length === 0 ? (
        <EmptyState
          icon="alarm"
          title={t('alarm.empty.title')}
          body={t('alarm.empty.body')}
          actionLabel={t('alarm.add')}
          onAction={() => setComposing(true)}
        />
      ) : null}

      {items.map((alarm) => (
        <Card key={alarm.id}>
          <View style={[styles.row, { gap: theme.spacing.lg }]}>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text
                variant="display"
                tone={alarm.enabled ? 'default' : 'faint'}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {alarm.time}
              </Text>
              {alarm.label.length > 0 ? (
                <Text variant="label" tone="muted">
                  {alarm.label}
                </Text>
              ) : null}
              <View style={[styles.days, { gap: theme.spacing.xs }]}>
                {alarm.days.length === 0 ? (
                  <Text variant="caption" tone="faint">
                    {t('alarm.once')}
                  </Text>
                ) : (
                  WEEKDAYS.map((day) => {
                    const on = alarm.days.includes(day);
                    return (
                      <Text
                        key={day}
                        variant="caption"
                        tone={on && alarm.enabled ? 'accent' : 'faint'}
                        style={{ fontWeight: on ? theme.fontWeight.semibold : undefined }}
                      >
                        {t(`alarm.day.${day}` as TranslationKey)}
                      </Text>
                    );
                  })
                )}
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
              <Switch
                value={alarm.enabled}
                onValueChange={(value) => {
                  void alarmRepo.setEnabled(alarm.id, value);
                }}
                accessibilityLabel={`${alarm.time} ${alarm.label}`}
                trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
                thumbColor={theme.colors.surface}
              />
              <Icon name="trash" size={18} color={theme.colors.textFaint} />
            </View>
          </View>
        </Card>
      ))}

      <AlarmComposer
        visible={composing}
        accountId={account.id}
        onClose={() => setComposing(false)}
      />
    </Screen>
  );
}

type ComposerProps = { visible: boolean; accountId: string; onClose: () => void };

function AlarmComposer({ visible, accountId, onClose }: ComposerProps) {
  const t = useTranslate();
  const theme = useTheme();

  const [time, setTime] = useState('07:00');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<readonly Weekday[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: Weekday) {
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  }

  async function save() {
    const normalised = normaliseTime(time);
    if (!normalised) {
      setError(t('alarm.error.time'));
      return;
    }
    await alarmRepo.create({ accountId, time: normalised, label, days });
    setTime('07:00');
    setLabel('');
    setDays([]);
    setError(null);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('alarm.add')}>
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <Input
          label={t('alarm.field.time')}
          placeholder="07:00"
          value={time}
          onChangeText={(value) => {
            setTime(value);
            setError(null);
          }}
          keyboardType="numbers-and-punctuation"
          {...(error ? { error } : {})}
        />
        <Input
          label={t('alarm.field.label')}
          placeholder={t('alarm.field.labelPlaceholder')}
          value={label}
          onChangeText={setLabel}
        />
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {t('alarm.field.days')}
          </Text>
          <View style={[styles.days, { gap: theme.spacing.sm }]}>
            {WEEKDAYS.map((day) => {
              const on = days.includes(day);
              return (
                <Text
                  key={day}
                  variant="label"
                  tone={on ? 'accent' : 'faint'}
                  onPress={() => toggleDay(day)}
                  style={{ fontWeight: on ? theme.fontWeight.semibold : undefined }}
                >
                  {t(`alarm.day.${day}` as TranslationKey)}
                </Text>
              );
            })}
          </View>
        </View>
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
});
