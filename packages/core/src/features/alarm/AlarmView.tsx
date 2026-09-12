import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useLiveQuery, type AlarmRow } from '@/db';
import { alarms as alarmRepo } from '@/db/repositories';
import { useTranslate, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, EmptyState, Header, Loading, Screen, SwipeRow, Text } from '@/ui';

import { AlarmEditor, WEEKDAYS, repeatLabel, type Weekday } from './AlarmEditor';

export { WEEKDAYS, type Weekday };

type Editing = { alarm: AlarmRow | null } | null;

export function AlarmView({ module }: { module: ModuleDefinition }) {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [editing, setEditing] = useState<Editing>(null);

  const list = useLiveQuery(() => alarmRepo.list(account.id), [account.id]);
  const items = list.data ?? [];
  const next = items.find((alarm) => alarm.enabled);
  const nextText = next
    ? next.label
      ? `${t('alarm.next', { time: next.time })} — ${next.label}`
      : t('alarm.next', { time: next.time })
    : t('alarm.noneActive');

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={nextText}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
      footer={
        <Button label={t('alarm.add')} icon="plus" onPress={() => setEditing({ alarm: null })} />
      }
    >
      {list.loading && items.length === 0 ? <Loading /> : null}

      {!list.loading && items.length === 0 ? (
        <EmptyState title={t('alarm.empty.title')} body={t('alarm.empty.body')} />
      ) : null}

      {/* Loeschen wie in der iPhone-Uhr: nach links wischen, oder im Editor unten. */}
      {items.map((alarm) => (
        <SwipeRow
          key={alarm.id}
          radius={theme.radii.md}
          onDelete={() => void alarmRepo.remove(alarm.id)}
        >
          <Card>
            <View style={[styles.row, { gap: theme.spacing.lg }]}>
              {/* Uhrzeit und Text fuehren in den Editor; der Schalter bleibt aussen. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${alarm.time} ${alarm.label}`.trim()}
                onPress={() => setEditing({ alarm })}
                style={({ pressed }) => ({
                  flex: 1,
                  gap: theme.spacing.xs,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
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
                      {repeatLabel(t, alarm.days)}
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
              </Pressable>
              <Switch
                value={alarm.enabled}
                onValueChange={(value) => {
                  void alarmRepo.setEnabled(alarm.id, value);
                }}
                accessibilityLabel={t('alarm.enabledLabel', { time: alarm.time })}
                trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
                thumbColor={theme.colors.surface}
              />
            </View>
          </Card>
        </SwipeRow>
      ))}

      <AlarmEditor
        key={editing?.alarm?.id ?? (editing ? 'new' : 'closed')}
        visible={editing !== null}
        accountId={account.id}
        alarm={editing?.alarm ?? null}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
});
