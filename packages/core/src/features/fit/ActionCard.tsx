import { useState } from 'react';
import { View } from 'react-native';

import { fit, type FitAction } from '@/db/fit';
import { formatShortDate, useI18n, type Translate, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Text } from '@/ui';

import { Hairline, Pill } from './KitchenKit';
import { RoundCheck } from './KitchenMedia';

type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown) => (typeof value === 'number' ? value : 0);
const list = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

/** Was sich aendern wird — je Werkzeug in ganzen Saetzen, nie als rohe Daten. */
export function describeAction(action: FitAction, t: Translate, language: string): string[] {
  const summary = action.preview.summary as Row;
  const changes = action.preview.changes as Row[];
  const day = (value: unknown) =>
    str(value) ? formatShortDate(language as never, `${str(value)}T12:00:00`) : '';
  switch (summary.kind) {
    case 'pantry_add':
    case 'pantry_update':
    case 'pantry_reduce': {
      const unknown = Array.isArray(summary.unknown) ? (summary.unknown as string[]) : [];
      const amount = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 });
      const lines = changes.map((change) => {
        const op = str(change.op);
        // `label` ist der Name in der Sprache der Person, `name` die gespeicherte Fassung.
        const name = str(change.label) || str(change.name);
        if (op === 'remove') return t('fit.action.line.pantryRemove', { name });
        if (op === 'keep') return t('fit.action.line.pantryKeep', { name });
        if (change.grams === null || change.grams === undefined)
          return t('fit.action.line.pantryUnknown', { name });
        // In der Einheit der Zeile, wo es nicht Gramm sind: „Ei: 10 Stk.“
        if (typeof change.amount === 'number' && str(change.unit) && str(change.unit) !== 'g')
          return t('fit.action.line.pantryAmount', {
            name,
            amount: amount.format(change.amount),
            unit: t(`fit.unit.${str(change.unit)}` as TranslationKey),
          });
        if (op === 'increase')
          return t('fit.action.line.pantryIncrease', {
            name,
            from: num(change.fromGrams),
            to: num(change.toGrams),
          });
        return t(op === 'add' ? 'fit.action.line.pantryAdd' : 'fit.action.line.pantrySet', {
          name,
          grams: num(change.grams),
        });
      });
      return unknown.length > 0
        ? [...lines, t('fit.action.line.pantryNotReduced', { names: unknown.join(', ') })]
        : lines;
    }
    case 'recipe_create':
    case 'recipe_update': {
      const perServing = summary.perServing as Row | null;
      const lines = [
        perServing
          ? t('fit.action.line.recipe', {
              title: str(summary.title),
              kcal: Math.round(num(perServing.kcal)),
              protein: Math.round(num(perServing.proteinG)),
            })
          : str(summary.title),
      ];
      for (const conflict of list(summary.conflicts))
        lines.push(t('fit.action.line.conflict', { name: str(conflict.name) }));
      return lines;
    }
    case 'recipe_delete':
      return [str(summary.title)];
    case 'meal_plan':
      return [
        ...(summary.replaces ? [t('fit.action.line.planReplaces')] : []),
        ...list(summary.days).map((entry) =>
          t(
            (entry.tolerance as Row)?.kcalOk
              ? 'fit.action.line.planDay'
              : 'fit.action.line.planDayOff',
            {
              day: day(entry.day),
              kind: t(entry.kind === 'training' ? 'fit.day.training' : 'fit.day.rest'),
              total: num(entry.total),
              target: num(entry.target),
            },
          ),
        ),
      ];
    case 'meal_plan_change':
      return [
        ...list(summary.days).map((entry) =>
          t('fit.action.line.planChange', {
            day: day(entry.day),
            before: num((entry.before as Row).kcal),
            after: num((entry.after as Row).kcal),
            target: num((entry.target as Row).kcal),
          }),
        ),
        ...(summary.shoppingListAffected ? [t('fit.action.line.listStale')] : []),
      ];
    case 'shopping_create':
      return [
        t('fit.action.line.listCreate', { count: num(summary.count) }),
        ...(list(summary.covered).length > 0 ||
        (Array.isArray(summary.covered) && summary.covered.length > 0)
          ? [t('fit.action.line.listCovered', { names: (summary.covered as string[]).join(', ') })]
          : []),
      ];
    case 'shopping_update':
      return [
        ...(summary.added as string[]).map((name) => t('fit.action.line.listAdd', { name })),
        ...list(summary.changed).map((entry) => {
          const amount = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 });
          const unit = (value: unknown) => t(`fit.unit.${str(value) || 'g'}` as TranslationKey);
          const quantity = (value: unknown, unitOf: unknown, fallback: unknown) =>
            typeof value === 'number' ? `${amount.format(value)} ${unit(unitOf)}` : str(fallback);
          return t('fit.action.line.listChange', {
            name: str(entry.name),
            from: quantity(entry.fromAmount, entry.fromUnit, entry.from),
            to: quantity(entry.toAmount, entry.toUnit, entry.to),
          });
        }),
        ...(summary.removed as string[]).map((name) => t('fit.action.line.listRemove', { name })),
      ];
    case 'reschedule': {
      const lines = [
        t('fit.action.line.move', {
          title: str(summary.title),
          from: day(summary.fromDay),
          to: day(summary.toDay),
        }),
      ];
      for (const warning of list(summary.warnings)) {
        if (warning.kind === 'double_session') lines.push(t('fit.action.warn.double'));
        if (warning.kind === 'recovery')
          lines.push(t('fit.action.warn.recovery', { title: str(warning.title) }));
        if (warning.kind === 'calendar')
          lines.push(t('fit.action.warn.calendar', { count: num(warning.count) }));
      }
      for (const entry of list(summary.nutrition)) {
        if (entry.before !== entry.after && entry.after !== null)
          lines.push(
            t('fit.action.line.target', {
              day: day(entry.day),
              before: num(entry.before),
              after: num(entry.after),
            }),
          );
      }
      return lines;
    }
    case 'skip': {
      const lines = [
        t('fit.action.line.skip', { title: str(summary.title), day: day(summary.day) }),
      ];
      for (const entry of list(summary.nutrition)) {
        if (entry.before !== entry.after && entry.after !== null)
          lines.push(
            t('fit.action.line.target', {
              day: day(entry.day),
              before: num(entry.before),
              after: num(entry.after),
            }),
          );
      }
      return lines;
    }
    case 'weight':
      return [
        t(summary.replaces ? 'fit.action.line.weightReplace' : 'fit.action.line.weight', {
          day: day(summary.day),
          kg: num(summary.weightKg),
          old: num(summary.replaces),
        }),
      ];
    case 'workout_plan':
      return [
        t('fit.action.line.workoutPlan', {
          name: str(summary.template),
          count: num(summary.count),
        }),
        (summary.sessions as string[]).join(' · '),
        ...(num(summary.replaces) > 0
          ? [t('fit.action.line.workoutReplaces', { count: num(summary.replaces) })]
          : []),
      ];
    default:
      return [];
  }
}

/** Was gespeichert wurde — aus dem Ergebnis des Dienstes, nicht aus dem Vorschlag. */
export function describeResult(action: FitAction, t: Translate, language: string): string {
  const result = (action.result ?? {}) as Row;
  const day = (value: unknown) =>
    str(value) ? formatShortDate(language as never, `${str(value)}T12:00:00`) : '';
  switch (result.kind) {
    case 'workout_moved':
      return t('fit.action.done.moved', { title: str(result.title), to: day(result.toDay) });
    case 'workout_skipped':
      return t('fit.action.done.skipped', { title: str(result.title), day: day(result.day) });
    case 'weight_saved':
      return t('fit.action.done.weight', { kg: num(result.weightKg) });
    case 'pantry_saved':
      return t('fit.action.done.pantry', { count: num(result.count) });
    case 'recipe_saved':
      return t('fit.action.done.recipe', { title: str(result.title) });
    case 'recipe_deleted':
      return t('fit.action.done.recipeDeleted', { title: str(result.title) });
    case 'meal_plan_saved':
      return t(result.shoppingListStale ? 'fit.action.done.planStale' : 'fit.action.done.plan');
    case 'shopping_saved':
      return t('fit.action.done.list', { count: num(result.count) });
    case 'workout_plan_saved':
      return t('fit.action.done.workoutPlan', { name: str(result.name), count: num(result.count) });
    default:
      return t('fit.action.done.generic');
  }
}

/**
 * Ein Vorschlag: was sich aendern wird, und zwei Knoepfe. Erst „Bestaetigen“
 * speichert; danach steht hier, was tatsaechlich gespeichert ist.
 */
export function ActionCard({
  action: initial,
  onDone,
}: {
  action: FitAction;
  onDone?: (action: FitAction) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [action, setAction] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function decide(confirm: boolean) {
    setBusy(true);
    setProblem(null);
    const result = confirm ? await fit.confirmAction(action.id) : await fit.rejectAction(action.id);
    setBusy(false);
    if (result.ok) {
      setAction(result.data.action);
      onDone?.(result.data.action);
    } else {
      setProblem(
        t(
          result.error === 'stale'
            ? 'fit.action.stale'
            : result.error === 'action_expired'
              ? 'fit.action.expired'
              : 'fit.error.body',
        ),
      );
      if (result.error === 'stale' || result.error === 'action_expired')
        setAction({ ...action, status: 'expired' });
    }
  }

  const lines = describeAction(action, t, language);
  const kind = String((action.preview.summary as Row).kind ?? 'generic');
  const settled = action.status !== 'proposed';

  return (
    <View
      accessibilityRole="summary"
      style={[
        theme.elevation.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.panel,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}>
        <Text variant="overline" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
          {t(`fit.action.kind.${kind}` as TranslationKey)}
        </Text>
        <Text
          variant="caption"
          tone={action.status === 'failed' || action.status === 'expired' ? 'danger' : 'faint'}
          numberOfLines={1}
          style={{ fontSize: theme.fontSize.caption, fontWeight: theme.fontWeight.semibold }}
        >
          {t(`fit.action.status.${action.status}` as TranslationKey)}
        </Text>
      </View>
      {lines.length > 0 ? (
        <View>
          {lines.map((line, index) => (
            <View key={`${index}-${line}`}>
              {index > 0 ? <Hairline /> : null}
              <Text
                variant="body"
                tone={settled ? 'muted' : 'default'}
                style={[numeric, { paddingVertical: theme.spacing.sm }]}
              >
                {line}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {action.status === 'confirmed' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <RoundCheck checked />
          <Text variant="body" style={{ flex: 1, fontWeight: theme.fontWeight.semibold }}>
            {describeResult(action, t, language)}
          </Text>
        </View>
      ) : null}
      {problem ? (
        <Text variant="label" tone="danger">
          {problem}
        </Text>
      ) : null}
      {action.status === 'proposed' ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
          <View style={{ flex: 1 }}>
            <Pill
              label={t('fit.action.reject')}
              tone="soft"
              fullWidth
              onPress={() => void decide(false)}
              disabled={busy}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Pill
              label={t('fit.action.confirm')}
              icon="check"
              fullWidth
              onPress={() => void decide(true)}
              loading={busy}
              disabled={busy}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
