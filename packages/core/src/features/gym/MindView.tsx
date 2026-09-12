import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dayKey, moods as moodRepo, useLiveQuery } from '@/db';
import { relativeDay } from '@/features/shared/days';
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
  Header,
  Input,
  ListItem,
  Screen,
  SwipeRow,
  Text,
} from '@/ui';

import { RemoveButton } from '../money/parts';

const MOODS = [1, 2, 3, 4, 5] as const;

/** 4-7-8: vier Sekunden ein, sieben halten, acht aus. Vier Runden. */
const BREATH_PHASES = [
  { id: 'in', seconds: 4 },
  { id: 'hold', seconds: 7 },
  { id: 'out', seconds: 8 },
] as const;
const BREATH_ROUNDS = 4;

/** Kopf frei: ein Wort zur Laune, ein Satz zum Tag — und eine Atemuebung. */
export function MindView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();

  const list = useLiveQuery(() => moodRepo.list(account.id), [account.id]);
  const rows = list.data ?? [];
  const todayRow = rows.find((row) => row.day === today);

  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const chosen = mood ?? todayRow?.mood ?? null;
  const moodLabel = (value: number) => t(`mind.mood.${value}` as TranslationKey);

  async function save() {
    if (chosen === null) return;
    await moodRepo.save({
      accountId: account.id,
      day: today,
      mood: chosen,
      note: note || todayRow?.note,
    });
    setSaved(true);
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={todayRow ? moodLabel(todayRow.mood) : t('mind.today')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      <Card title={t('mind.today')}>
        <View style={{ gap: theme.spacing.md }}>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {MOODS.map((value) => (
              <Chip
                key={value}
                label={moodLabel(value)}
                selected={chosen === value}
                onPress={() => {
                  setMood(value);
                  setSaved(false);
                }}
              />
            ))}
          </View>
          <Input
            label={t('mind.note')}
            placeholder={todayRow?.note ?? t('mind.notePlaceholder')}
            value={note}
            onChangeText={(value) => {
              setNote(value);
              setSaved(false);
            }}
            multiline
            autoCapitalize="sentences"
          />
          <Button
            label={saved ? t('mind.saved') : t('mind.save')}
            icon="check"
            variant={saved ? 'secondary' : 'primary'}
            onPress={save}
          />
        </View>
      </Card>

      <Breathing />

      {rows.length === 0 ? (
        <EmptyState title={t('mind.empty.title')} body={t('mind.empty.body')} />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('mind.history')}
          </Text>
          <Card>
            {rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow onDelete={() => void moodRepo.remove(row.id)}>
                  <ListItem
                    title={moodLabel(row.mood)}
                    subtitle={row.note ?? undefined}
                    right={
                      <View style={[styles.row, { gap: theme.spacing.sm }]}>
                        <Text variant="label" tone="muted">
                          {relativeDay(t, language, row.day)}
                        </Text>
                        <RemoveButton onPress={() => void moodRepo.remove(row.id)} />
                      </View>
                    }
                  />
                </SwipeRow>
              </View>
            ))}
          </Card>
        </View>
      )}
    </Screen>
  );
}

/** Die Atemuebung: ein grosser Zaehler, darunter die Phase und die Runde. */
function Breathing() {
  const { t } = useI18n();
  const theme = useTheme();

  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setLeft((current) => {
        if (current > 1) return current - 1;
        // Phase vorbei: naechste Phase, sonst naechste Runde, sonst fertig.
        const nextPhase = (phase + 1) % BREATH_PHASES.length;
        const nextRound = nextPhase === 0 ? round + 1 : round;
        if (nextRound >= BREATH_ROUNDS) {
          setRunning(false);
          setDone(true);
          return 0;
        }
        setPhase(nextPhase);
        setRound(nextRound);
        return BREATH_PHASES[nextPhase]?.seconds ?? 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, phase, round]);

  function start() {
    setDone(false);
    setRound(0);
    setPhase(0);
    setLeft(BREATH_PHASES[0].seconds);
    setRunning(true);
  }

  const current = BREATH_PHASES[phase];

  return (
    <Card title={t('mind.breathe')}>
      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        {running ? (
          <>
            <Text variant="display">{left}</Text>
            <Text variant="label" tone="accent">
              {t(`mind.phase.${current?.id ?? 'in'}` as TranslationKey)}
            </Text>
            <Text variant="caption" tone="muted">
              {t('mind.round', { round: round + 1, total: BREATH_ROUNDS })}
            </Text>
            <Button
              label={t('mind.breatheStop')}
              variant="ghost"
              fullWidth={false}
              onPress={() => setRunning(false)}
            />
          </>
        ) : (
          <>
            <Text variant="label" tone="muted" align="center">
              {done ? t('mind.done') : t('mind.breatheBody')}
            </Text>
            <Button label={t('mind.breatheStart')} icon="sun" fullWidth={false} onPress={start} />
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
