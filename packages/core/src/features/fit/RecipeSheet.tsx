import { useState } from 'react';
import { View } from 'react-native';

import { MEAL_SLOTS, fit, type FitAction, type FitRecipe, type MealSlot } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { useScope } from '@/state/AppContext';
import { numeric, useTheme } from '@/theme';
import { Sheet, Text, useUndo } from '@/ui';

import { ActionCard } from './ActionCard';
import { CookingMode } from './CookingMode';
import { sendToFamilyList } from './familyShopping';
import { FitState } from './FitGate';
import { kitchenError } from './kitchenErrors';
import { Pill, RoundIcon } from './KitchenKit';
import { FadeImage, WhiteChip } from './KitchenMedia';
import { scaleAmount, scaleCoverage, shortfallGrams } from './kitchenLogic';
import { RecipeEditForm } from './RecipeEditForm';
import { RecipeIngredients } from './RecipeIngredients';
import { recipeImageFor } from './recipeImages';
import { useFit } from './useFit';
import { portionText } from './portionText';

const PORTIONS = [0.5, 1, 1.5, 2];
const HERO = 200;
const STEP_NUMBER = 20;

/**
 * Ein Rezept: Naehrwerte, Zutaten fuer die gewaehlten Portionen mit dem Stand
 * im Vorrat, Schritte, Kochmodus. Eintragen geht direkt — auch aus der
 * Bibliothek („Gekocht & gegessen“); Speichern, Bearbeiten und Loeschen sind
 * Vorschlaege.
 */
export function RecipeSheet({
  recipeId,
  day,
  onClose,
}: {
  recipeId: string;
  day: string;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const undo = useUndo();
  const [currentId, setCurrentId] = useState(recipeId);
  const detail = useFit(() => fit.recipe(currentId), [currentId], ['kitchen']);
  const [action, setAction] = useState<FitAction | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [portions, setPortions] = useState(1);
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [editing, setEditing] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const scope = useScope();
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 2 });
  const unitLabel = (unit: string) => t(`fit.unit.${unit}` as TranslationKey);

  const recipe: FitRecipe | undefined = detail.data?.recipe;
  const saved = detail.data?.saved ?? false;
  const savedId = detail.data?.savedId ?? null;
  const favorite = detail.data?.favorite ?? false;
  const shown = view ?? recipe?.servings ?? 1;
  const factor = recipe ? shown / recipe.servings : 1;

  async function run<T>(
    work: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    done: (data: T) => void,
  ) {
    setBusy(true);
    setProblem(null);
    const result = await work();
    setBusy(false);
    if (result.ok) done(result.data);
    else setProblem(kitchenError(t, result.error));
  }

  const save = () =>
    run(
      () => fit.proposeRecipe({ fromLibrary: currentId }),
      (data) => setAction(data.action),
    );
  const remove = () =>
    run(
      () => fit.propose('delete_recipe', { recipeId: currentId }),
      (data) => setAction(data.action),
    );
  const star = () =>
    run(
      () => fit.favoriteRecipe(currentId, !favorite),
      () => detail.reload(),
    );
  const log = () =>
    run(
      () => fit.logRecipe(currentId, { portions, slot, day }),
      (data) => {
        undo.show({
          message: t('fit.recipe.logged', { kcal: whole.format(data.meal.total.kcal) }),
        });
        if (data.pantryAction) setAction(data.pantryAction);
      },
    );

  async function saveEdit(next: FitRecipe): Promise<string | null> {
    const result = await fit.proposeRecipe({
      recipeId: currentId,
      recipe: {
        ...next,
        items: next.items.map(({ foodId, amount, unit, optional }) => ({
          foodId,
          amount,
          unit,
          optional,
        })) as FitRecipe['items'],
      },
    });
    if (!result.ok) return kitchenError(t, result.error);
    setAction(result.data.action);
    setEditing(false);
    return null;
  }

  /** Nur, was fuer diese Portionen fehlt (ohne Grundzutaten) — fehlt nichts, alle Zutaten. */
  async function toFamily() {
    if (!recipe || busy) return;
    const coverage = detail.data?.coverage ?? [];
    const lines = recipe.items.map((item) => {
      const found = coverage.find((entry) => entry.foodId === item.foodId);
      const line = found ? scaleCoverage(found, factor) : null;
      const short = line && !line.basic && !line.optional ? shortfallGrams(line) : 0;
      const amount =
        line && line.needed > 0
          ? scaleAmount(item.amount * factor * (short / line.needed), 1, item.unit)
          : 0;
      return { item, short, amount };
    });
    const missing = lines.filter((entry) => entry.short > 0);
    const chosen =
      missing.length > 0
        ? missing
        : lines
            .filter((entry) => !entry.item.optional)
            .map((entry) => ({
              ...entry,
              amount: scaleAmount(entry.item.amount, factor, entry.item.unit),
            }));
    setBusy(true);
    try {
      const result = await sendToFamilyList(
        scope,
        chosen.map((entry) => ({
          name: entry.item.name,
          amount: entry.amount,
          unit: entry.item.unit,
        })),
        {
          quantity: (value, unit) => `${number.format(value)} ${unitLabel(unit)}`,
          unit: unitLabel,
        },
      );
      undo.show({
        message:
          result.added + result.raised === 0
            ? t('fit.family.already')
            : result.raised > 0
              ? t('fit.family.sentRaised', { count: result.added, raised: result.raised })
              : t('fit.family.sent', { count: result.added }),
      });
    } catch {
      setProblem(t('fit.family.error'));
    } finally {
      setBusy(false);
    }
  }

  const library = currentId.startsWith('lib:');
  const image = recipe ? recipeImageFor({ id: currentId, basedOn: recipe.basedOn }) : null;
  const perServing = recipe?.nutrition?.perServing;
  const meta = recipe
    ? [
        t('fit.kitchen.card.minutes', { minutes: recipe.timeMinutes }),
        perServing ? t('fit.plan.kcal', { kcal: whole.format(perServing.kcal) }) : null,
        perServing
          ? t('fit.kitchen.card.protein', { protein: whole.format(perServing.proteinG) })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Sheet
      visible
      onClose={onClose}
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Text variant="overline" tone="faint" style={{ flex: 1 }}>
            {t(cooking ? 'fit.recipe.cook' : 'fit.kitchen.tab.recipes')}
          </Text>
          {saved && recipe ? (
            <RoundIcon
              icon={favorite ? 'starFilled' : 'star'}
              label={t(favorite ? 'fit.recipe.unfavorite' : 'fit.recipe.favorite', {
                title: recipe.title,
              })}
              active={favorite}
              onPress={() => void star()}
            />
          ) : null}
          <RoundIcon icon="close" label={t('common.close')} onPress={onClose} />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.lg }}>
        <FitState loading={detail.loading} error={detail.error} onRetry={detail.reload}>
          {recipe && cooking ? (
            <CookingMode steps={recipe.steps} onClose={() => setCooking(false)} />
          ) : recipe ? (
            <>
              <View style={{ gap: theme.spacing.md }}>
                {image ? (
                  <FadeImage
                    source={image}
                    label={recipe.title}
                    style={{ width: '100%', height: HERO, borderRadius: theme.radii.panel }}
                  />
                ) : null}
                <View style={{ gap: theme.spacing.xs }}>
                  <Text
                    variant="display"
                    style={{ fontSize: theme.fontSize.xl, lineHeight: theme.lineHeight.xl }}
                  >
                    {recipe.title}
                  </Text>
                  <Text variant="label" tone="muted" style={{ fontSize: theme.fontSize.lede }}>
                    {meta}
                  </Text>
                  {recipe.nutrition ? (
                    <Text variant="label" tone="muted" style={numeric}>
                      {t('fit.recipe.perServing', {
                        kcal: whole.format(recipe.nutrition.perServing.kcal),
                        protein: whole.format(recipe.nutrition.perServing.proteinG),
                        carbs: whole.format(recipe.nutrition.perServing.carbsG),
                        fat: whole.format(recipe.nutrition.perServing.fatG),
                      })}
                    </Text>
                  ) : null}
                </View>
                {recipe.equipment.length > 0 ? (
                  <Text variant="label" tone="muted">
                    {t('fit.recipe.equipment', {
                      list: recipe.equipment
                        .map((entry) => t(`fit.equipment.${entry}` as TranslationKey))
                        .join(', '),
                    })}
                  </Text>
                ) : null}
                {(recipe.substitutions ?? []).map((entry) => (
                  <Text key={`${entry.from}-${entry.to}`} variant="label">
                    {t('fit.recipe.substitution', {
                      from: entry.from,
                      to: entry.to,
                      why: t(`fit.recipe.why.${entry.reason}` as TranslationKey),
                    })}
                  </Text>
                ))}
                {(recipe.omitted ?? []).map((entry) => (
                  <Text key={entry.name} variant="label">
                    {t('fit.recipe.omitted', {
                      name: entry.name,
                      why: t(`fit.recipe.why.${entry.reason}` as TranslationKey),
                    })}
                  </Text>
                ))}
              </View>

              {editing ? (
                <RecipeEditForm
                  recipe={recipe}
                  onSubmit={saveEdit}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <>
                  <View style={{ gap: theme.spacing.xs }}>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
                    >
                      <Text variant="overline" tone="faint" style={{ flex: 1 }}>
                        {t('fit.recipe.ingredients')}
                      </Text>
                      <Pill
                        label={t('fit.stepper.minus')}
                        accessibilityLabel={t('fit.recipe.fewer')}
                        tone="soft"
                        size="sm"
                        disabled={shown <= 1}
                        onPress={() => setView(Math.max(1, shown - 1))}
                      />
                      <Text
                        variant="label"
                        style={[numeric, { fontWeight: theme.fontWeight.semibold }]}
                      >
                        {t('fit.recipe.forPortions', { count: shown })}
                      </Text>
                      <Pill
                        label={t('fit.stepper.plus')}
                        accessibilityLabel={t('fit.recipe.more')}
                        tone="soft"
                        size="sm"
                        disabled={shown >= 20}
                        onPress={() => setView(Math.min(20, shown + 1))}
                      />
                    </View>
                    <RecipeIngredients
                      recipe={recipe}
                      coverage={detail.data?.coverage ?? []}
                      factor={factor}
                    />
                  </View>
                  <View style={{ gap: theme.spacing.sm }}>
                    <Text variant="overline" tone="faint">
                      {t('fit.recipe.steps')}
                    </Text>
                    {recipe.steps.map((step, index) => (
                      <View
                        key={`${index}-${step}`}
                        style={{ flexDirection: 'row', gap: theme.spacing.md }}
                      >
                        <Text
                          variant="body"
                          style={[
                            numeric,
                            { width: STEP_NUMBER, fontWeight: theme.fontWeight.bold },
                          ]}
                        >
                          {index + 1}
                        </Text>
                        <Text variant="body" style={{ flex: 1 }}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                    {recipe.steps.length > 0 ? (
                      <Pill
                        label={t('fit.recipe.cook')}
                        icon="play"
                        tone="soft"
                        onPress={() => setCooking(true)}
                      />
                    ) : null}
                    <Pill
                      label={t('fit.family.missing')}
                      tone="soft"
                      icon="cart"
                      onPress={() => void toFamily()}
                      disabled={busy}
                    />
                  </View>
                </>
              )}

              {action ? (
                <ActionCard key={action.id} action={action} onDone={() => detail.reload()} />
              ) : null}
              {problem ? (
                <Text variant="label" tone="danger">
                  {problem}
                </Text>
              ) : null}

              {editing ? null : (
                <View style={{ gap: theme.spacing.sm }}>
                  <Text variant="overline" tone="faint">
                    {t('fit.recipe.logTitle')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                    {PORTIONS.map((value) => (
                      <WhiteChip
                        key={value}
                        label={portionText(t, value, (count) => number.format(count))}
                        selected={portions === value}
                        onPress={() => setPortions(value)}
                      >
                        {portionText(t, value, (count) => number.format(count))}
                      </WhiteChip>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                    {MEAL_SLOTS.map((entry) => (
                      <WhiteChip
                        key={entry}
                        label={t(`meals.slot.${entry}` as TranslationKey)}
                        selected={slot === entry}
                        onPress={() => setSlot(entry)}
                      >
                        {t(`meals.slot.${entry}` as TranslationKey)}
                      </WhiteChip>
                    ))}
                  </View>
                  <View style={{ marginTop: theme.spacing.xs }}>
                    <Pill
                      label={t(library ? 'fit.recipe.cookedEaten' : 'fit.recipe.log')}
                      icon="check"
                      fullWidth
                      onPress={() => void log()}
                      loading={busy}
                      disabled={busy}
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    {saved ? (
                      <>
                        <Pill
                          label={t('fit.recipe.edit')}
                          tone="soft"
                          size="sm"
                          onPress={() => setEditing(true)}
                        />
                        <Pill
                          label={t('fit.recipe.delete')}
                          tone="soft"
                          size="sm"
                          icon="trash"
                          onPress={() => void remove()}
                          disabled={busy}
                        />
                      </>
                    ) : savedId ? (
                      <Pill
                        label={t('fit.recipe.openMine')}
                        tone="soft"
                        size="sm"
                        onPress={() => {
                          setCurrentId(savedId);
                          setView(null);
                          setAction(null);
                        }}
                      />
                    ) : action?.tool === 'save_recipe' ? null : (
                      <Pill
                        label={t('fit.recipe.save')}
                        icon="plus"
                        tone="soft"
                        size="sm"
                        onPress={() => void save()}
                        disabled={busy}
                      />
                    )}
                  </View>
                </View>
              )}
            </>
          ) : null}
        </FitState>
      </View>
    </Sheet>
  );
}
