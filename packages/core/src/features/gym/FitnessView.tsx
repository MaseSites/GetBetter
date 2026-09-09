import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { dayKey, useLiveQuery, workouts as workoutRepo } from '@/db';
import { useI18n } from '@/i18n';
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

/** Vorschlaege, damit man nicht jedes Mal tippen muss. */
const KINDS = ['Kraft', 'Laufen', 'Velo', 'Schwimmen', 'Yoga', 'Anderes'] as const;
const MINUTES = [20, 30, 45, 60, 90] as const;

/** Wie weit die Woche zurueckreicht, fuer die Zusammenfassung oben. */
function weekStart(): string {
  const date = new Date();
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return dayKey(date);
}

/** Training festhalten: was, wie lange, mit einer Notiz. */
export function FitnessView({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<string>(KINDS[0]);
  const [minutes, setMinutes] = useState(45);
  const [notes, setNotes] = useState('');

  const list = useLiveQuery(() => workoutRepo.listRecent(account.id), [account.id]);
  const week = useLiveQuery(() => workoutRepo.minutesSince(account.id, weekStart()), [account.id]);
  const rows = list.data ?? [];

  async function save() {
    await workoutRepo.add({ accountId: account.id, day: dayKey(), kind, minutes, notes });
    setNotes('');
    setAdding(false);
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t('gym.week', { minutes: week.data ?? 0 })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon="fitness" title={t('gym.empty.title')} body={t('gym.empty.body')} />
      ) : (
        <Card>
          <View>
            {rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={row.kind}
                  subtitle={row.notes ?? row.day}
                  right={
                    <Text variant="label" tone="muted">
                      {t('gym.minutes', { minutes: row.minutes })}
                    </Text>
                  }
                  onPress={() => void workoutRepo.remove(row.id)}
                />
              </View>
            ))}
          </View>
        </Card>
      )}

      <FloatingButton label={t('gym.add')} onPress={() => setAdding(true)} />

      <Sheet visible={adding} onClose={() => setAdding(false)} title={t('gym.add')}>
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('gym.kind')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {KINDS.map((entry) => (
                <Chip
                  key={entry}
                  label={entry}
                  selected={kind === entry}
                  onPress={() => setKind(entry)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('gym.duration')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {MINUTES.map((entry) => (
                <Chip
                  key={entry}
                  label={t('gym.minutes', { minutes: entry })}
                  selected={minutes === entry}
                  onPress={() => setMinutes(entry)}
                />
              ))}
            </View>
          </View>

          <Input
            label={t('gym.note')}
            placeholder={t('common.optional')}
            value={notes}
            onChangeText={setNotes}
          />

          <Button label={t('common.done')} icon="check" onPress={save} />
        </View>
      </Sheet>
    </Screen>
  );
}
