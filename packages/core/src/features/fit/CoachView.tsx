import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { fit, type CoachMessage, type FitAction } from '@/db/fit';
import { aiFailureOf, aiFailureOffersPlan, aiFailureText } from '@/features/assistant/aiTurns';
import { useVoice } from '@/features/assistant/useVoice';
import { usePlanSheet } from '@/features/plan/PlanSheet';
import {
  formatShortDate,
  useI18n,
  type Language,
  type Translate,
  type TranslationKey,
} from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import type { ModuleDefinition } from '@/mocks/types';
import { numeric, useTheme } from '@/theme';
import { ComposeBar, Screen, Text } from '@/ui';

import { ActionCard, describeResult } from './ActionCard';
import { CoachCards } from './CoachCards';
import { FitState } from './FitGate';
import { AreaHeader, Pill, RoundIcon } from './KitchenKit';
import { WhiteChip } from './KitchenMedia';
import { formatsOf } from './trainingText';
import { useFit } from './useFit';

type Row = Record<string, unknown>;
/** Gruende, die der Coach in Worten kennt; alles andere wird ein allgemeiner Satz. */
const REASONS = [
  'workout_not_found',
  'profile_required',
  'same_day',
  'workout_done',
  'no_changes',
  'plan_not_found',
  'weight_invalid',
  'workout_started',
];
/** Gruende aus dem KI-Dienst, fuer die es den alten, allgemeinen Satz braucht (keine KI eingerichtet). */
const PLAIN_REASONS = ['not_configured', 'unknown_route', 'http_404', 'error'];

/** Warum der Coach frei nicht antworten kann — mit Kontingent, Datum und Preis, wenn der Dienst sie nennt. */
function unavailableOf(message: CoachMessage) {
  const data = (message.data ?? {}) as Row;
  const reason = typeof data.reason === 'string' ? data.reason : null;
  if (!reason || PLAIN_REASONS.includes(reason)) return null;
  return aiFailureOf({ error: reason, details: data.details });
}
const EXAMPLES = [
  'fit.coach.example.move',
  'fit.coach.example.pantry',
  'fit.coach.example.left',
  'fit.coach.example.plan',
] as const;

/** Eine Antwort des Coaches in Worten — gebaut aus Daten, in der Sprache der Person. */
function coachLines(message: CoachMessage, t: Translate, language: Language): string[] {
  const data = (message.data ?? {}) as Row;
  const formats = formatsOf(language);
  const n = (value: unknown) => formats.whole.format(typeof value === 'number' ? value : 0);
  const kg = (value: unknown) => formats.oneDecimal.format(typeof value === 'number' ? value : 0);
  const day = (value: unknown) =>
    typeof value === 'string' ? formatShortDate(language as never, `${value}T12:00:00`) : '';
  const suggestions = (items: unknown) =>
    (Array.isArray(items) ? (items as Row[]) : []).map((item) =>
      t('fit.coach.suggestion', {
        title: String(item.title),
        kcal: n((item.perServing as Row)?.kcal),
        missing:
          (item.missing as Row[])
            .filter((entry) => !entry.optional)
            .map((entry) => String(entry.name))
            .join(', ') || t('fit.coach.nothingMissing'),
      }),
    );
  switch (message.kind) {
    case 'text':
      return [message.text ?? ''];
    case 'general_unavailable': {
      const failure = unavailableOf(message);
      return [failure ? aiFailureText(t, language, failure) : t('fit.coach.general_unavailable')];
    }
    case 'safety':
    case 'no_plan':
    case 'rejected':
      return [t(`fit.coach.${message.kind}` as TranslationKey)];
    case 'proposal_failed': {
      const reason = REASONS.includes(String(data.error)) ? String(data.error) : 'generic';
      const key =
        reason === 'workout_started'
          ? 'fit6.coach.reason.workout_started'
          : `fit.coach.reason.${reason}`;
      return [t('fit.coach.failed', { reason: t(key as TranslationKey) })];
    }
    case 'confirmed':
      if (data.kind === 'workout_skipped')
        return [t('fit6.coach.skipped', { title: String(data.title ?? ''), day: day(data.day) })];
      return [describeResult({ result: data } as unknown as FitAction, t, language)];
    case 'get_records': {
      const records = (Array.isArray(data.records) ? data.records : []) as Row[];
      if (records.length === 0) return [t('fit6.coach.noRecords')];
      return [
        t('fit6.coach.records'),
        ...records.map((entry) => {
          const value =
            entry.kind === 'weight'
              ? t('fit6.record.weight', {
                  kg: formats.kg.format(Number(entry.weightKg)),
                  reps: n(entry.reps),
                })
              : entry.kind === 'seconds'
                ? t('fit6.record.seconds', { seconds: n(entry.seconds) })
                : t('fit6.record.reps', { reps: n(entry.reps) });
          return `${String(entry.name ?? '')}: ${value}`;
        }),
      ];
    }
    case 'pantry_unknown':
      return [t('fit.coach.unknownFoods', { words: (data.unknown as string[]).join(', ') })];
    case 'suggestions':
    case 'suggest_recipes_from_pantry':
    case 'find_meals_for_remaining_macros':
      if (data.emptyPantry) return [t('fit.coach.emptyPantry')];
      return [t('fit.coach.suggestionsIntro'), ...suggestions(data.items)];
    case 'get_remaining_macros':
    case 'get_today_summary': {
      const remaining = (data.remaining ?? null) as Row | null;
      if (!remaining) return [t('fit.coach.noGoals')];
      return [
        t('fit.coach.remaining', {
          // Schon erreicht heisst 0, nie ein Minus („Eiweiss -47 g“).
          kcal: n(Math.max(0, Number(remaining.kcal) || 0)),
          protein: n(Math.max(0, Number(remaining.proteinG) || 0)),
          carbs: n(Math.max(0, Number(remaining.carbsG) || 0)),
          fat: n(Math.max(0, Number(remaining.fatG) || 0)),
        }),
      ];
    }
    case 'get_workout_schedule': {
      const workouts = (data.workouts as Row[]) ?? [];
      if (workouts.length === 0) return [t('fit.coach.noWorkouts')];
      return workouts.map(
        (workout) =>
          `${day(workout.day)} · ${String(workout.title)} · ${t(`fit.training.status.${String(workout.status)}` as TranslationKey)}`,
      );
    }
    case 'get_pantry_items': {
      const items = (data.items as Row[]) ?? [];
      return [
        items.length === 0
          ? t('fit.coach.emptyPantry')
          : t('fit.coach.pantry', { list: items.map((item) => String(item.name)).join(', ') }),
      ];
    }
    case 'explain_progress': {
      const lines = [];
      const weight = data.weight as Row | null;
      lines.push(
        weight
          ? t('fit.coach.progressWeight', { from: kg(weight.from), to: kg(weight.to) })
          : t('fit.coach.progressNoWeight'),
      );
      const workouts = data.workouts as Row;
      lines.push(
        t('fit.coach.progressWorkouts', { done: n(workouts.done), planned: n(workouts.planned) }),
      );
      const nutrition = data.nutrition as Row;
      if (nutrition.averageKcal !== null)
        lines.push(
          t('fit.coach.progressKcal', {
            average: n(nutrition.averageKcal),
            target: n(nutrition.averageTarget),
            days: n(nutrition.loggedDays),
          }),
        );
      return lines;
    }
    default:
      return [t('fit.coach.readFailed')];
  }
}

/**
 * Der KI-Coach: schreiben oder sprechen. Er liest ueber Werkzeuge, schlaegt
 * Aenderungen als Karte vor und meldet erst nach „Bestaetigen“, was
 * gespeichert ist. Behauptet wird nichts.
 */
export function CoachView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const history = useFit(() => fit.coachMessages(), []);
  const plans = usePlanSheet();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const voice = useVoice({ onDictate: setText, onTurn: async () => null });

  /** Senden: das Feld leert sich erst, wenn die Nachricht angekommen ist. */
  async function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setFailed(false);
    const result = await fit.sendCoach(trimmed);
    setSending(false);
    if (result.ok) setText('');
    else {
      setText(trimmed);
      setFailed(true);
    }
  }

  const messages = history.data?.messages ?? [];
  const actions = new Map((history.data?.actions ?? []).map((action) => [action.id, action]));
  const name = moduleName(t, module.id);

  return (
    <Screen
      followEnd
      gap={theme.spacing.sm}
      contentStyle={{ paddingTop: theme.spacing.xs }}
      header={
        <AreaHeader
          crumb={`${t('area.health')} · ${name}`}
          title={name}
          subtitle={t('fit.coach.subtitle')}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
      footer={
        <>
          {failed ? (
            <View accessibilityLiveRegion="polite">
              <Text variant="label" tone="danger">
                {t('fit6.coach.failed')}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            {voice.available ? (
              <RoundIcon
                icon="wave"
                label={t('fit.pantry.dictate')}
                onPress={voice.dictate}
                tone={voice.phase === 'listening' ? 'ink' : 'white'}
                active={voice.phase === 'listening'}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <ComposeBar
                value={voice.phase === 'listening' ? voice.heard : text}
                onChangeText={setText}
                onSubmit={() => void send(text)}
                placeholder={t('fit.coach.placeholder')}
                sendLabel={t('fit.coach.send')}
                busy={sending}
              />
            </View>
          </View>
        </>
      }
    >
      <CoachCards />
      <FitState loading={history.loading} error={history.error} onRetry={history.reload}>
        {messages.length === 0 ? (
          <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
            <Text variant="body" tone="muted">
              {t('fit.coach.intro')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {EXAMPLES.map((key) => (
                <WhiteChip key={key} label={t(key)} onPress={() => void send(t(key))}>
                  {t(key)}
                </WhiteChip>
              ))}
            </View>
          </View>
        ) : null}
        {messages.map((message) => {
          if (message.kind === 'proposal' && message.actionId && actions.get(message.actionId)) {
            const action = actions.get(message.actionId) as FitAction;
            return <ActionCard key={message.id} action={action} onDone={() => history.reload()} />;
          }
          const mine = message.role === 'user';
          const failure = message.kind === 'general_unavailable' ? unavailableOf(message) : null;
          return (
            <View
              key={message.id}
              accessibilityLiveRegion={mine ? 'none' : 'polite'}
              style={[
                mine ? null : theme.elevation.card,
                {
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                  backgroundColor: mine ? theme.colors.inverse : theme.colors.surface,
                  borderRadius: theme.radii.panel,
                  borderBottomRightRadius: mine ? theme.radii.xs : theme.radii.panel,
                  borderBottomLeftRadius: mine ? theme.radii.panel : theme.radii.xs,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  gap: theme.spacing.xs,
                },
              ]}
            >
              {(mine ? [message.text ?? ''] : coachLines(message, t, language)).map(
                (line, index) => (
                  <Text
                    key={`${index}-${line}`}
                    variant="body"
                    style={[numeric, mine ? { color: theme.colors.onInverse } : null]}
                  >
                    {line}
                  </Text>
                ),
              )}
              {failure && aiFailureOffersPlan(failure) ? (
                <View style={{ marginTop: theme.spacing.xs }}>
                  <Pill label={t('fit6.coach.plan')} tone="soft" size="sm" onPress={plans.open} />
                </View>
              ) : null}
            </View>
          );
        })}
        {sending ? (
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: theme.spacing.xs }}>
            <Text variant="label" tone="muted">
              {t('fit.coach.thinking')}
            </Text>
          </View>
        ) : null}
      </FitState>
    </Screen>
  );
}
