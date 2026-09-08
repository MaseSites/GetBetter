import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { AiChatView } from '@/features/ai/AiChatView';
import { AlarmView } from '@/features/alarm/AlarmView';
import { formatTime, formatWeekday, useI18n } from '@/i18n';
import { getModule } from '@/mocks/modules';
import { CALENDAR_WEEK, MODULE_CARDS_BY_ID } from '@/mocks/today';
import type { ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import { Button, Card, Divider, EmptyState, Header, Icon, ListItem, Screen, Text } from '@/ui';

/** P-018: Das Beispielmodul Kalender. Wochenansicht, Plus-Knopf ohne Funktion. */
function CalendarModule({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const router = useRouter();

  return (
    <Screen
      header={
        <Header
          title={module.name}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={[
            {
              icon: 'sparkles',
              label: t('today.openAssistant'),
              onPress: () => router.push('/assistant'),
            },
          ]}
        />
      }
      footer={
        <Button
          label={t('calendar.add')}
          icon="plus"
          onPress={() => undefined}
          disabled
          accessibilityLabel={`${t('calendar.add')} — ${t('calendar.addHint')}`}
        />
      }
    >
      <Text variant="section" tone="muted">
        {t('calendar.week')}
      </Text>

      {CALENDAR_WEEK.map((day) => (
        <Card key={day.iso} title={formatWeekday(language, day.iso)}>
          {day.entries.length === 0 ? (
            <Text variant="label" tone="faint">
              {t('calendar.empty')}
            </Text>
          ) : (
            <View>
              {day.entries.map((entry, index) => (
                <View key={entry.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListItem
                    title={entry.title}
                    subtitle={entry.location}
                    right={
                      <Text variant="label" tone="muted">
                        {entry.allDay ? t('today.allDay') : formatTime(language, entry.startsAt)}
                      </Text>
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </Card>
      ))}

      <Text variant="caption" tone="faint" align="center">
        {t('calendar.addHint')}
      </Text>
    </Screen>
  );
}

/** Alle anderen Module: ein Platzhalter, der zeigt, wie es aussieht. */
function PlaceholderModule({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const card = MODULE_CARDS_BY_ID[module.id];

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={module.short}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={[
            {
              icon: 'sparkles',
              label: t('today.openAssistant'),
              onPress: () => router.push('/assistant'),
            },
          ]}
        />
      }
      footer={
        <Button
          label={t('modules.sheet.details')}
          variant="secondary"
          icon="info"
          onPress={() => router.push(`/module/${module.id}`)}
        />
      }
    >
      {card ? (
        <Card title={card.headline}>
          <View style={{ gap: theme.spacing.sm }}>
            {card.lines.map((line) => (
              <View
                key={line.label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}
              >
                <Text variant="label" tone="muted">
                  {line.label}
                </Text>
                <Text variant="label">{line.value}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Icon name={module.icon} size={28} color={theme.colors.textFaint} />
          <Text variant="title" align="center">
            {t('moduleScreen.placeholder.title')}
          </Text>
          <Text variant="label" tone="muted" align="center">
            {t('moduleScreen.placeholder.body')}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

export default function ModuleRunScreen() {
  const { t } = useI18n();
  const router = useRouter();

  const params = useLocalSearchParams<{ id?: string }>();
  const module = params.id ? getModule(params.id) : undefined;

  if (!module) {
    return (
      <Screen header={<Header showBack />} scroll={false}>
        <EmptyState
          icon="warning"
          title={t('detail.notFound.title')}
          body={t('detail.notFound.body')}
          actionLabel={t('detail.notFound.action')}
          onAction={() => router.replace('/modules')}
        />
      </Screen>
    );
  }

  if (module.id === 'calendar') {
    return <CalendarModule module={module} />;
  }

  if (module.id === 'ai') {
    return <AiChatView module={module} />;
  }

  if (module.id === 'alarm') {
    return <AlarmView module={module} />;
  }

  return <PlaceholderModule module={module} />;
}
