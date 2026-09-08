import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { useTranslate, type TranslationKey } from '@/i18n';
import { ALARMS, WEEKDAYS, type Alarm } from '@/mocks/alarms';
import type { ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import { Badge, Button, Card, Header, Icon, Screen, Text } from '@/ui';

export type AlarmViewProps = {
  module: ModuleDefinition;
};

/** Das Modul "Wecker". Die Schalter wirken, sonst ist nichts angeschlossen. */
export function AlarmView({ module }: AlarmViewProps) {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();

  const [alarms, setAlarms] = useState<readonly Alarm[]>(ALARMS);

  function toggle(id: string) {
    setAlarms((current) =>
      current.map((alarm) => (alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm)),
    );
  }

  const next = alarms.find((alarm) => alarm.enabled);

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
      footer={
        <Button
          label={t('alarm.add')}
          icon="plus"
          onPress={() => undefined}
          disabled
          accessibilityLabel={`${t('alarm.add')} — ${t('alarm.addHint')}`}
        />
      }
    >
      {alarms.map((alarm) => (
        <Card key={alarm.id} padded>
          <View style={[styles.row, { gap: theme.spacing.lg }]}>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text
                variant="display"
                tone={alarm.enabled ? 'default' : 'faint'}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {alarm.time}
              </Text>
              <Text variant="label" tone="muted">
                {alarm.label}
              </Text>
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
              {alarm.suggested ? (
                <Badge label={t('alarm.suggested')} tone="accent" icon="calendar" />
              ) : null}
            </View>
            <Switch
              value={alarm.enabled}
              onValueChange={() => toggle(alarm.id)}
              accessibilityLabel={`${alarm.time} ${alarm.label}`}
              trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
              thumbColor={theme.colors.surface}
            />
          </View>
        </Card>
      ))}

      <View style={[styles.hint, { gap: theme.spacing.sm }]}>
        <Icon name="info" size={16} color={theme.colors.textFaint} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="faint">
            {t('alarm.addHint')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { flexDirection: 'row', alignItems: 'flex-start' },
});
