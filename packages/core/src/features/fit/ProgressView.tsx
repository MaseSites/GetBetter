import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { fit } from '@/db/fit';
import { formatDayMonth, formatShortDate, useI18n } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import type { ModuleDefinition } from '@/mocks/types';
import { numeric, useTheme } from '@/theme';
import { Input, Screen, Text } from '@/ui';

import { AreaFigure, AreaPanel } from './AreaBlocks';
import { FitState } from './FitGate';
import { AreaHeader, Block, Pill } from './KitchenKit';
import { OtherRecords, Records, WeekVolume, weekSummaryOf } from './ProgressTraining';
import { paceOf, plannedKgPerWeek, trendViewOf } from './progressText';
import { parseDecimal } from './setupForm';
import { formatsOf } from './trainingText';
import { useFit } from './useFit';
import { WeightChart } from './WeightChart';

/** Kopf bis erster Block: 12 Innenabstand des Kopfs plus 2 — wie die 14 der Vision. */
const BLOCKS_TOP = 2;
const DAY_MS = 86400000;

/**
 * Gewicht und Fortschritt wie in der Vision: der Trend statt der Tageszahl,
 * die Saetze der Woche und das geschaetzte Maximum. Darunter, was man hier
 * tut: das Gewicht eintragen und — nach zwei bis drei Wochen — ein Vorschlag
 * fuer die Kalorien, der erst nach Bestaetigung gilt. Ganz unten leise die
 * Hinweise und das Loeschen.
 */
export function ProgressView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const weights = useFit(() => fit.weights(), [], ['training', 'profile']);
  const progress = useFit(() => fit.progress(), [], ['training']);
  const profile = useFit(() => fit.profile(), [], ['profile']);
  const formats = formatsOf(language);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(0);
  const oneDecimal = new Intl.NumberFormat(`${language}-CH`, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const name = moduleName(t, module.id);

  async function save() {
    const kg = parseDecimal(value);
    if (kg === null || kg < 30 || kg > 350) {
      setError(t('fit.setup.error.weightKg'));
      return;
    }
    const result = await fit.logWeight(kg);
    if (result.ok) {
      setValue('');
      setError(null);
    } else setError(t('fit.error.body'));
  }

  async function wipe() {
    if (deleting < 1) {
      setDeleting(1);
      return;
    }
    await fit.deleteAll();
    setDeleting(0);
  }

  const trend = weights.data?.trend ?? [];
  const latest = trend.at(-1);
  const first = trend[0];
  // Veraenderung seit dem ersten Wert, auf dem Trend — nicht auf der Tageszahl.
  const change = latest && first ? Math.round((latest.trendKg - first.trendKg) * 10) / 10 : 0;
  const spanDays =
    latest && first
      ? Math.max(
          1,
          (Date.parse(`${latest.day}T12:00:00Z`) - Date.parse(`${first.day}T12:00:00Z`)) / DAY_MS,
        )
      : 1;
  const perWeek = Math.round((change / spanDays) * 7 * 10) / 10;
  const suggestion = weights.data?.suggestion ?? null;
  const pace = paceOf((change / spanDays) * 7, plannedKgPerWeek(profile.data?.profile ?? null));
  // Eine Linie erst, wenn sie etwas zeigt: vier Waegungen ueber mindestens eine
  // Woche. Sonst waere die Wochenrate ein Tag mal sieben (`trendViewOf`).
  const view = latest && first ? trendViewOf(trend.length, spanDays) : 'none';
  const hasTrend = view === 'chart';
  const summary = progress.data ? weekSummaryOf(t, language, progress.data.week) : null;
  const weighted = (progress.data?.records ?? []).some(
    (entry) => entry.kind === 'weight' && entry.e1rm !== null,
  );

  return (
    <Screen
      gap={theme.spacing.sm}
      contentStyle={{ paddingTop: BLOCKS_TOP }}
      header={
        <AreaHeader
          crumb={`${t('area.health')} · ${name}`}
          title={name}
          subtitle={
            first
              ? t('fit.progress.since', {
                  date: formatDayMonth(language, new Date(`${first.day}T12:00:00`)),
                })
              : undefined
          }
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      <FitState loading={weights.loading} error={weights.error} onRetry={weights.reload}>
        <AreaPanel
          label={t('fit6.v.weight.title')}
          more={hasTrend ? t(`fit.progress.pace.${pace}`) : undefined}
        >
          {hasTrend ? (
            <AreaFigure
              value={formats.signed.format(change)}
              unit={t('fit6.v.weight.perWeek', { delta: formats.signed.format(perWeek) })}
            />
          ) : latest ? (
            <>
              <AreaFigure
                value={oneDecimal.format(latest.trendKg)}
                unit={t('fit.progress.trendUnit')}
              />
              {/* Kein Diagramm heisst nicht „nichts“: hier steht, was noch fehlt. */}
              <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.sm }}>
                {t('fit8.trend.soon')}
              </Text>
            </>
          ) : (
            <Text variant="body" tone="muted" style={{ marginTop: theme.spacing.sm }}>
              {t('fit.progress.noWeight')}
            </Text>
          )}
          {hasTrend && latest && first ? (
            <WeightChart
              points={trend}
              label={t('fit6.v.weight.a11y', {
                date: formatShortDate(language, `${first.day}T12:00:00`),
                from: oneDecimal.format(first.trendKg),
                to: oneDecimal.format(latest.trendKg),
              })}
            />
          ) : null}
        </AreaPanel>
      </FitState>

      <FitState loading={progress.loading} error={progress.error} onRetry={progress.reload}>
        {progress.data ? (
          <>
            <WeekVolume week={progress.data.week} />
            <Records records={progress.data.records} />
          </>
        ) : null}
      </FitState>

      {/* Was nicht in der Vision steht, kommt erst unter ihren drei Bloecken. */}
      <Block style={{ marginTop: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t('fit.progress.today')}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="72,4"
              onSubmitEditing={() => void save()}
              {...(error ? { error } : {})}
            />
          </View>
          <Pill label={t('fit.custom.save')} onPress={() => void save()} />
        </View>
      </Block>

      {suggestion ? (
        <AreaPanel label={t('fit.progress.adjustTitle')}>
          <Text variant="body" style={[numeric, { marginTop: theme.spacing.sm }]}>
            {t('fit.progress.adjustBody', {
              actual: formats.signed.format(suggestion.actualKgPerWeek),
              planned: formats.signed.format(suggestion.plannedKgPerWeek),
              days: formats.whole.format(suggestion.days),
              kcal: formats.whole.format(suggestion.kcal),
            })}
          </Text>
          <View style={{ marginTop: theme.spacing.md }}>
            <Pill
              label={t('fit.progress.adjustConfirm', {
                kcal: formats.whole.format(suggestion.kcal),
              })}
              icon="check"
              fullWidth
              onPress={() => void fit.confirmAdjustment(suggestion.kcal)}
            />
          </View>
        </AreaPanel>
      ) : null}

      {progress.data ? <OtherRecords records={progress.data.records} /> : null}

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        {!suggestion && trend.length > 0 ? (
          <Text variant="caption" tone="faint">
            {t('fit.progress.adjustLater')}
          </Text>
        ) : null}
        {weighted ? (
          <Text variant="caption" tone="faint">
            {t('fit6.e1rm.hint')}
          </Text>
        ) : null}
        {progress.data ? (
          <Text variant="caption" tone="faint" style={numeric}>
            {[
              summary,
              progress.data.records.length === 0
                ? t('fit.progress.noRecords')
                : t('fit.progress.done28', {
                    workouts:
                      progress.data.workoutsDone28 === 1
                        ? t('fit.count.workoutOne')
                        : t('fit.count.workouts', {
                            count: formats.whole.format(progress.data.workoutsDone28),
                          }),
                  }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.lg }}>
        <Text variant="caption" tone="faint">
          {t('fit.progress.deleteHint')}
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
          <Text
            variant="label"
            tone="danger"
            onPress={() => void wipe()}
            style={{ fontWeight: theme.fontWeight.semibold }}
          >
            {deleting ? t('fit.progress.deleteConfirm') : t('fit.progress.delete')}
          </Text>
          {deleting ? (
            <Text variant="label" tone="muted" onPress={() => setDeleting(0)}>
              {t('common.cancel')}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
