import { useState } from 'react';
import { View } from 'react-native';

import {
  MEAL_SLOTS,
  fit,
  type FitAction,
  type FitMeal,
  type MealAnalysis,
  type MealSlot,
  type PlanEntry,
  type UsualMeal,
} from '@/db/fit';
import {
  ImagePermissionError,
  canPickImage,
  hasCamera,
  pickImage,
  type ImageSource,
} from '@/features/personalize/pickImage';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Segmented, Sheet, Text } from '@/ui';

import { ActionCard } from './ActionCard';
import { AddFoodSheet } from './AddFoodSheet';
import { ChoiceTile } from './ChoiceTile';
import { IntentKeys } from './intentKeys';
import { PhotoAnalysisSheet } from './PhotoAnalysisSheet';
import { useFit } from './useFit';
import { useMealToast } from './useMealToast';

// Nach Zuercher Zeit, wie der Dienst — auch wenn das Telefon anders eingestellt ist.
export { slotForNow } from './slots';

type Open =
  { kind: 'search' | 'barcode' } | { kind: 'photo'; analysis: MealAnalysis | null } | null;

const PHOTO_ERRORS = ['daily_limit', 'budget_exhausted', 'no_food', 'offline'];

/**
 * Was hinter dem Plus steckt: oben die Mahlzeit, darunter die Wege, etwas
 * einzutragen — geplant ist am schnellsten, dann Foto, Suche, Verpackung und
 * eigene Rezepte. Ein Foto wird sofort gemacht und analysiert; das Ergebnis
 * oeffnet sich zum Pruefen. Waehrend etwas eingetragen wird, ist alles andere
 * gesperrt; Fehler stehen im Blatt.
 */
export function AddMealSheet({
  initialSlot,
  day,
  onClose,
}: {
  initialSlot: MealSlot;
  day: string;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useMealToast();
  const [keys] = useState(() => new IntentKeys());
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pantryAction, setPantryAction] = useState<FitAction | null>(null);
  const status = useFit(() => fit.status(), []);
  const plan = useFit(() => fit.currentPlan(), [], ['kitchen']);
  const recipes = useFit(() => fit.recipes(), [], ['kitchen']);
  // Was oft gegessen wird, die zur Mahlzeit passenden zuerst — ein Tipp, und es ist eingetragen.
  const usual = useFit(() => fit.usualMeals(slot), [slot], ['diary']);
  const mock = status.data?.mode === 'mock';
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });

  const planned: PlanEntry[] = (
    plan.data?.plan?.days.find((entry) => entry.day === day)?.entries ?? []
  ).filter((entry) => entry.slot === slot && entry.status === 'planned');
  const saved = (recipes.data?.recipes ?? [])
    .filter((recipe) => !recipe.slots || recipe.slots.includes(slot))
    .slice(0, 4);

  /** Nach dem Eintragen: kurz sagen, was es war, mit Rueckgaengig — und zu. */
  function logged(meal: FitMeal, title: string, action: FitAction | null) {
    toast.logged(meal, title);
    if (action) setPantryAction(action);
    else onClose();
  }

  /** Fehler beim Eintragen sichtbar machen — nie still. */
  const failed = (code: string) =>
    setError(t(code === 'offline' ? 'fit.offline.body' : 'fit4.logFailed'));

  /** Nur eine Handlung auf einmal. */
  async function run(id: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await work();
    } finally {
      setBusy(null);
    }
  }

  async function photo(source: ImageSource) {
    if (busy) return;
    setError(null);
    // Im Mock-Modus waehlt man ein Beispiel im Blatt selbst.
    if (mock) {
      setOpen({ kind: 'photo', analysis: null });
      return;
    }
    try {
      const image = await pickImage(source);
      if (!image) return;
      setBusy('photo');
      const result = await fit.startAnalysis({ image, day, slot, language });
      setBusy(null);
      if (result.ok) setOpen({ kind: 'photo', analysis: result.data.analysis });
      else
        setError(
          t(
            PHOTO_ERRORS.includes(result.error)
              ? (`fit.photo.error.${result.error}` as TranslationKey)
              : 'fit.photo.error.generic',
          ),
        );
    } catch (failure) {
      setBusy(null);
      setError(
        failure instanceof ImagePermissionError
          ? t('fit.photo.permission')
          : t('fit.photo.error.image_type'),
      );
    }
  }

  const eatPlanned = (entry: PlanEntry) =>
    run(entry.id, async () => {
      const planId = plan.data?.plan?.id;
      if (!planId) return;
      const result = await fit.logPlanEntry(planId, entry.id, keys.of(`plan-${entry.id}`));
      if (result.ok) logged(result.data.meal, entry.title, result.data.pantryAction);
      else failed(result.error);
    });

  const eatAgain = (meal: UsualMeal) =>
    run(meal.id, async () => {
      const result = await fit.repeatMeal(
        meal.id,
        { slot, day },
        keys.of(`repeat-${meal.id}-${slot}-${day}`),
      );
      if (result.ok) logged(result.data.meal, meal.name, null);
      else failed(result.error);
    });

  const eatRecipe = (recipeId: string, title: string) =>
    run(recipeId, async () => {
      const result = await fit.logRecipe(
        recipeId,
        { portions: 1, slot, day },
        keys.of(`recipe-${recipeId}-${slot}-${day}`),
      );
      if (result.ok) logged(result.data.meal, title, result.data.pantryAction);
      else failed(result.error);
    });

  if (open?.kind === 'photo')
    return (
      <PhotoAnalysisSheet
        visible
        slot={slot}
        day={day}
        initialAnalysis={open.analysis}
        onClose={onClose}
      />
    );
  if (open)
    return <AddFoodSheet visible slot={slot} day={day} startWith={open.kind} onClose={onClose} />;

  const locked = busy !== null;

  return (
    <Sheet visible onClose={onClose} title={t('fit.add.title')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        {pantryAction ? (
          <ActionCard key={pantryAction.id} action={pantryAction} onDone={onClose} />
        ) : (
          <>
            <Segmented
              options={MEAL_SLOTS.map((value) => ({
                value,
                label: t(`meals.slot.${value}` as TranslationKey),
              }))}
              value={slot}
              onChange={setSlot}
              accessibilityLabel={t('fit.add.slot')}
            />

            {error ? (
              <Text variant="label" tone="danger">
                {error}
              </Text>
            ) : null}

            {planned.map((entry) => (
              <ChoiceTile
                key={entry.id}
                icon="calendar"
                title={entry.title}
                hint={
                  busy === entry.id
                    ? t('fit.add.saving')
                    : t('fit.add.planned', { kcal: whole.format(entry.nutrients.kcal) })
                }
                role="button"
                busy={busy === entry.id}
                disabled={locked}
                onPress={() => void eatPlanned(entry)}
              />
            ))}

            {(usual.data?.meals.length ?? 0) > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="overline" tone="faint">
                  {t('fit.add.usual')}
                </Text>
                {(usual.data?.meals ?? []).slice(0, 3).map((meal) => (
                  <ChoiceTile
                    key={meal.id}
                    icon="repeat"
                    title={meal.name}
                    hint={
                      busy === meal.id
                        ? t('fit.add.saving')
                        : t('fit.add.usualHint', {
                            kcal: whole.format(meal.kcal),
                            count: meal.count,
                          })
                    }
                    role="button"
                    busy={busy === meal.id}
                    disabled={locked}
                    onPress={() => void eatAgain(meal)}
                  />
                ))}
              </View>
            ) : null}

            <View style={{ gap: theme.spacing.sm }}>
              {canPickImage() ? (
                <ChoiceTile
                  icon="image"
                  title={
                    busy === 'photo'
                      ? t('fit.add.analysing')
                      : t(hasCamera() ? 'fit.add.camera' : 'fit.add.photo')
                  }
                  hint={t('fit.add.photoHint')}
                  role="button"
                  busy={busy === 'photo'}
                  disabled={locked}
                  onPress={() => void photo(hasCamera() ? 'camera' : 'library')}
                />
              ) : null}
              {hasCamera() ? (
                <ChoiceTile
                  icon="upload"
                  title={t('fit.add.library')}
                  role="button"
                  disabled={locked}
                  onPress={() => void photo('library')}
                />
              ) : null}
              <ChoiceTile
                icon="search"
                title={t('fit.add.search')}
                hint={t('fit.add.searchHint')}
                role="button"
                disabled={locked}
                onPress={() => setOpen({ kind: 'search' })}
              />
              <ChoiceTile
                icon="card"
                title={t('fit.add.barcode')}
                hint={t('fit.add.barcodeHint')}
                role="button"
                disabled={locked}
                onPress={() => setOpen({ kind: 'barcode' })}
              />
            </View>

            {saved.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="overline" tone="faint">
                  {t('fit.add.recipes')}
                </Text>
                {saved.map((recipe) => (
                  <ChoiceTile
                    key={recipe.id}
                    icon="book"
                    title={recipe.title}
                    {...(busy === recipe.id
                      ? { hint: t('fit.add.saving') }
                      : recipe.nutrition
                        ? {
                            hint: t('fit.recipe.kcalPortion', {
                              kcal: whole.format(recipe.nutrition.perServing.kcal),
                            }),
                          }
                        : {})}
                    role="button"
                    busy={busy === recipe.id}
                    disabled={locked}
                    onPress={() => void eatRecipe(recipe.id, recipe.title)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}
