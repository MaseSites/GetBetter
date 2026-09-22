import { useState } from 'react';
import { View } from 'react-native';

import { fit, idempotencyKey, type FitFood, type MealSlot } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Button, Chip, Input, Sheet, Text } from '@/ui';

import { CustomFoodForm } from './CustomFoodForm';
import { FoodBasket } from './FoodBasket';
import { FoodSearch, sourceKey } from './FoodSearch';
import { addToBasket, macrosOf, removeFromBasket, totalOf, type BasketItem } from './mealMath';
import { PackagedFlow } from './PackagedFlow';
import { parseDecimal } from './setupForm';
import { useFit } from './useFit';
import { useMealToast } from './useMealToast';

export { sourceKey } from './FoodSearch';

const GRAM_CHIPS = [50, 100, 150, 200, 300];

type Step = 'search' | 'amount' | 'packaged' | 'custom';
type Picked = { food: FitFood; term: string | null; packaged: boolean };
type Line = BasketItem & { packaged: boolean };

/** Fehler beim Eintragen, ehrlich benannt. */
function logErrorKey(code: string): TranslationKey {
  if (code === 'meal_invalid') return 'fit.add.invalid';
  if (code === 'offline') return 'fit.offline.body';
  if (code === 'in_progress') return 'fit4.inProgress';
  return 'fit4.logFailed';
}

/**
 * Lebensmittel ins Tagebuch: suchen, Menge waehlen, in die Mahlzeit legen —
 * so oft wie noetig — und einmal eintragen. Die Zahlen in der Vorschau sind
 * nur Vorschau; gespeichert wird, was der Dienst rechnet.
 */
export function AddFoodSheet({
  visible,
  slot,
  day,
  onClose,
  startWith = 'search',
}: {
  visible: boolean;
  slot: MealSlot;
  day: string;
  onClose: () => void;
  /** `barcode`: gleich mit dem Scannen der Verpackung anfangen. */
  startWith?: 'search' | 'barcode';
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useMealToast();
  const [step, setStep] = useState<Step>(startWith === 'barcode' ? 'packaged' : 'search');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [grams, setGrams] = useState('');
  const [basket, setBasket] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const status = useFit(() => fit.status(), []);
  // Ein Schluessel je Inhalt des Korbs: ein zweiter Tipp legt nichts doppelt an, ein anderer Korb schon.
  const [key, setKey] = useState(() => idempotencyKey('meal'));
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const oneDecimal = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 });

  const amount = parseDecimal(grams);

  function pick(
    food: FitFood,
    choice: { term: string | null; grams: number | null },
    packaged = false,
  ) {
    setPicked({ food, term: choice.term, packaged });
    setGrams(String(choice.grams ?? food.gramsPerPiece ?? 100));
    setMessage(null);
    setConfirmLarge(false);
    setStep('amount');
  }

  const changeBasket = (next: Line[]) => {
    setBasket(next);
    setKey(idempotencyKey('meal'));
    setConfirmLarge(false);
    setMessage(null);
  };

  /** Das gewaehlte Lebensmittel in die Mahlzeit legen und weiter suchen. */
  function addPicked(): Line[] | null {
    if (!picked || amount === null || amount <= 0) {
      setMessage(t('fit.add.gramsMissing'));
      return null;
    }
    const next = addToBasket(basket, {
      foodId: picked.food.id,
      name: picked.food.name,
      per100: picked.food.per100,
      grams: amount,
      packaged: picked.packaged,
      ...(picked.term ? { term: picked.term } : {}),
    });
    return next;
  }

  async function save(items: Line[]) {
    if (items.length === 0 || saving) return;
    setSaving(true);
    setMessage(null);
    const result = await fit.logMeal(
      {
        day,
        slot,
        source: items.every((item) => item.packaged) ? 'barcode' : 'manual',
        items: items.map((item) => ({
          foodId: item.foodId,
          grams: item.grams,
          ...(item.term ? { term: item.term } : {}),
        })),
        confirmLarge,
      },
      key,
    );
    setSaving(false);
    if (result.ok) {
      toast.logged(result.data.meal);
      onClose();
      return;
    }
    // Der Korb bleibt, wie er ist — nichts geht verloren.
    setBasket(items);
    setPicked(null);
    setStep('search');
    if (result.error === 'confirm_large_portion') {
      setConfirmLarge(true);
      setMessage(t('fit.add.confirmLarge'));
      return;
    }
    setMessage(t(logErrorKey(result.error)));
  }

  const preview = picked && amount !== null ? macrosOf(picked.food.per100, amount) : null;
  const total = totalOf(basket);
  const subtitle =
    step === 'amount' && picked
      ? picked.food.name
      : basket.length > 0
        ? t('fit4.basket.subtitle', { count: basket.length, kcal: whole.format(total.kcal) })
        : t('fit.add.subtitle');

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t(`meals.slot.${slot}` as TranslationKey)}
      subtitle={subtitle}
    >
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        {step === 'packaged' ? (
          <PackagedFlow
            mock={status.data?.mode === 'mock'}
            onPicked={(food) => pick(food, { term: null, grams: null }, true)}
            onCancel={() => setStep('search')}
          />
        ) : step === 'custom' ? (
          <CustomFoodForm
            initialName={query}
            onCreated={(food) => pick(food, { term: null, grams: null })}
            onCancel={() => setStep('search')}
          />
        ) : step === 'amount' && picked ? (
          <>
            <Input
              label={t('fit.add.grams')}
              value={grams}
              onChangeText={(value) => {
                setGrams(value);
                setConfirmLarge(false);
                setMessage(null);
              }}
              keyboardType="decimal-pad"
              placeholder="150"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {picked.food.gramsPerPiece ? (
                <Chip
                  label={t('fit.add.piece', { grams: whole.format(picked.food.gramsPerPiece) })}
                  selected={amount === picked.food.gramsPerPiece}
                  onPress={() => setGrams(String(picked.food.gramsPerPiece))}
                />
              ) : null}
              {GRAM_CHIPS.map((value) => (
                <Chip
                  key={value}
                  label={t('fit4.unit.g', { value: whole.format(value) })}
                  selected={amount === value}
                  onPress={() => setGrams(String(value))}
                />
              ))}
            </View>
            {preview ? (
              <View style={{ gap: theme.spacing.xs }}>
                <Text variant="title" style={numeric}>
                  {t('fit.add.preview', { kcal: whole.format(preview.kcal) })}
                </Text>
                <Text variant="label" tone="muted" style={numeric}>
                  {t('fit.add.previewMacros', {
                    protein: oneDecimal.format(preview.proteinG),
                    carbs: oneDecimal.format(preview.carbsG),
                    fat: oneDecimal.format(preview.fatG),
                  })}
                </Text>
              </View>
            ) : null}
            <Text variant="caption" tone="muted">
              {t('fit.add.sourceLine', { source: t(sourceKey(picked.food.source)) })}
              {picked.food.source === 'off' ? ` · ${t('fit.source.offLicense')}` : ''}
            </Text>
            {message ? (
              <Text variant="label" tone="danger">
                {message}
              </Text>
            ) : null}
            <Button
              label={t('fit4.basket.logWith', {
                count: basket.length + 1,
                kcal: whole.format(total.kcal + (preview?.kcal ?? 0)),
              })}
              icon="check"
              onPress={() => {
                const next = addPicked();
                if (next) void save(next);
              }}
              loading={saving}
              disabled={saving || amount === null}
              fullWidth
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('common.back')}
                  variant="ghost"
                  onPress={() => {
                    setPicked(null);
                    setStep('search');
                  }}
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('fit4.basket.more')}
                  variant="secondary"
                  icon="plus"
                  onPress={() => {
                    const next = addPicked();
                    if (!next) return;
                    changeBasket(next);
                    setPicked(null);
                    setStep('search');
                  }}
                  disabled={saving || amount === null}
                  fullWidth
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <FoodBasket
              items={basket}
              onRemove={(foodId) => changeBasket(removeFromBasket(basket, foodId))}
            />
            {message ? (
              <Text variant="label" tone={confirmLarge ? 'default' : 'danger'}>
                {message}
              </Text>
            ) : null}
            {basket.length > 0 ? (
              <Button
                label={
                  confirmLarge
                    ? t('fit.add.logAnyway')
                    : t('fit4.basket.log', {
                        count: basket.length,
                        kcal: whole.format(total.kcal),
                      })
                }
                icon="check"
                onPress={() => void save(basket)}
                loading={saving}
                disabled={saving}
                fullWidth
              />
            ) : null}
            <FoodSearch
              initialQuery={query}
              onQueryChange={setQuery}
              onPick={(food, choice) => pick(food, choice)}
            />
            <Button
              label={t('fit.barcode.open')}
              variant="secondary"
              icon="card"
              onPress={() => setStep('packaged')}
            />
            <Button
              label={t('fit.add.custom')}
              variant="ghost"
              icon="plus"
              onPress={() => setStep('custom')}
            />
          </>
        )}
      </View>
    </Sheet>
  );
}
