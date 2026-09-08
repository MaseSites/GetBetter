import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { formatLongDate, formatTime, useI18n } from '@/i18n';
import { getModule, highlightedModuleIds } from '@/mocks/modules';
import { APPOINTMENTS, MODULE_CARDS_BY_ID, TASKS, TODAY_ISO } from '@/mocks/today';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Badge, Card, Divider, Header, Icon, ListItem, Screen, Text } from '@/ui';

/** Diese beiden haben in "Heute" einen eigenen Abschnitt statt einer Modulkarte. */
const MODULES_WITH_OWN_SECTION = ['calendar', 'tasks'];

export default function TodayScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { state } = useApp();

  // Alle Module sind da; in "Heute" erscheinen die wichtigsten der gewaehlten Bereiche.
  const highlighted = useMemo(
    () => highlightedModuleIds(state.selectedAreas),
    [state.selectedAreas],
  );

  const openTasks = useMemo(() => TASKS.filter((task) => !task.done), []);

  const cardModuleIds = useMemo(
    () =>
      highlighted.filter(
        (id) => !MODULES_WITH_OWN_SECTION.includes(id) && MODULE_CARDS_BY_ID[id] !== undefined,
      ),
    [highlighted],
  );

  return (
    <Screen
      header={
        <Header
          title={t('today.greeting', { name: state.person.firstName })}
          subtitle={formatLongDate(language, TODAY_ISO)}
        />
      }
    >
      <Card title={t('today.appointments')} onPress={() => router.push('/run/calendar')}>
        {APPOINTMENTS.length === 0 ? (
          <Text variant="label" tone="muted">
            {t('today.appointments.empty')}
          </Text>
        ) : (
          <View>
            {APPOINTMENTS.map((appointment, index) => (
              <View key={appointment.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={appointment.title}
                  subtitle={appointment.location}
                  right={
                    <Text variant="label" tone="muted">
                      {appointment.allDay
                        ? t('today.allDay')
                        : formatTime(language, appointment.startsAt)}
                    </Text>
                  }
                />
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card
        title={t('today.tasks')}
        subtitle={t('today.tasks.remaining', { count: openTasks.length })}
        onPress={() => router.push('/run/tasks')}
      >
        {openTasks.length === 0 ? (
          <Text variant="label" tone="muted">
            {t('today.tasks.empty')}
          </Text>
        ) : (
          <View>
            {openTasks.map((task, index) => (
              <View key={task.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={task.title}
                  icon="circle"
                  right={
                    task.shared ? <Badge label={t('today.household')} icon="people" /> : undefined
                  }
                />
              </View>
            ))}
          </View>
        )}
      </Card>

      {cardModuleIds.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="section" tone="muted">
            {t('today.moduleCards')}
          </Text>
          {cardModuleIds.map((id) => {
            const module = getModule(id);
            const card = MODULE_CARDS_BY_ID[id];
            if (!module || !card) return null;

            return (
              <Card
                key={id}
                onPress={() => router.push(`/run/${id}`)}
                accessibilityLabel={module.name}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Icon name={module.icon} size={18} color={theme.colors.textMuted} />
                  <Text variant="label" tone="muted">
                    {module.name}
                  </Text>
                </View>
                <Text variant="title">{card.headline}</Text>
                <View style={{ gap: theme.spacing.xs }}>
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
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
