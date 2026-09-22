import { useState } from 'react';
import { View } from 'react-native';

import { MEAL_SLOTS, fit, type FitMeal, type MealItemInput, type MealSlot } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Button, Divider, IconButton, Input, Segmented, Sheet, Text, useUndo } from '@/ui';

import { FoodSearch } from './FoodSearch';
import { parseDecimal } from './setupForm';

/** Eine Zeile beim Bearbeiten: was sie ist, die Gramm als Text, kcal je Gramm fuer die Vorschau. */
type Row = {
  key: string;
  ref: { foodId: string } | { recipeId: string };
  name: string;
  gramsText: string;
  kcalPerGram: number;
};

const rowsOf = (meal: FitMeal): Row[] =>
  meal.items.map((item, index) => ({
    key: `${item.foodId}-${index}`,
    ref: item.recipeId ? { recipeId: item.recipeId } : { foodId: item.foodId },
    name: item.name,
    gramsText: String(item.grams),
    kcalPerGram: item.per100 ? item.per100.kcal / 100 : item.grams > 0 ? item.kcal / item.grams : 0,
  }));

/** Rueckgaengig fuer eine Aenderung: die letzte offene im Protokoll dieser Mahlzeit. */
async function undoLastUpdate(mealId: string) {
  const result = await fit.changes('meals');
  const change = result.ok
    ? result.data.changes.find(
        (entry) => entry.rowId === mealId && entry.action === 'update' && !entry.undoneAt,
      )
    : undefined;
  if (change) await fit.undo(change.id);
}

/**
 * Eine Mahlzeit nach dem Eintragen korrigieren: Gramm je Zeile, eine Zeile
 * entfernen oder hinzufuegen, in eine andere Mahlzeit verschieben. Der Dienst
 * rechnet neu; eine sehr grosse Menge fragt nach wie beim Eintragen.
 */
export function MealEditSheet({ meal, onClose }: { meal: FitMeal; onClose: () => void }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const undo = useUndo();
  const [slot, setSlot] = useState<MealSlot>(meal.slot);
  const [rows, setRows] = useState<Row[]>(() => rowsOf(meal));
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });

  const parsed = rows.map((row) => ({ row, grams: parseDecimal(row.gramsText) }));
  const valid = parsed.every(({ grams }) => grams !== null && grams > 0);
  const preview = parsed.reduce((sum, { row, grams }) => sum + row.kcalPerGram * (grams ?? 0), 0);

  const change = (next: Row[]) => {
    setRows(next);
    setConfirmLarge(false);
    setError(null);
  };

  async function remove() {
    setSaving(true);
    const result = await fit.removeMeal(meal.id);
    setSaving(false);
    if (!result.ok) {
      setError(t(result.error === 'offline' ? 'fit.offline.body' : 'fit4.logFailed'));
      return;
    }
    undo.show({
      message: t('fit.meal.removed', { name: meal.name }),
      onUndo: () => {
        void fit.changes('meals').then((changes) => {
          const entry = changes.ok
            ? changes.data.changes.find(
                (row) => row.rowId === meal.id && row.action === 'remove' && !row.undoneAt,
              )
            : undefined;
          if (entry) void fit.undo(entry.id);
        });
      },
    });
    onClose();
  }

  async function save() {
    if (rows.length === 0) {
      await remove();
      return;
    }
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const items: MealItemInput[] = parsed.map(({ row, grams }) => ({
      ...row.ref,
      grams: grams ?? 0,
    })) as MealItemInput[];
    const result = await fit.updateMeal(meal.id, {
      slot,
      items,
      ...(confirmLarge ? { confirmLarge: true } : {}),
    });
    setSaving(false);
    if (result.ok) {
      undo.show({
        message: t('fit4.edit.saved', { name: result.data.meal.name }),
        onUndo: () => void undoLastUpdate(meal.id),
      });
      onClose();
      return;
    }
    if (result.error === 'confirm_large_portion') {
      setConfirmLarge(true);
      setError(t('fit.add.confirmLarge'));
      return;
    }
    setError(
      t(
        result.error === 'meal_invalid'
          ? 'fit.add.invalid'
          : result.error === 'offline'
            ? 'fit.offline.body'
            : 'fit4.logFailed',
      ),
    );
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('fit4.edit.title')}
      subtitle={t('fit4.unit.kcal', { value: whole.format(preview) })}
    >
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        {adding ? (
          <View style={{ gap: theme.spacing.md }}>
            <FoodSearch
              onPick={(food, choice) => {
                change([
                  ...rows,
                  {
                    key: `new-${food.id}-${rows.length}`,
                    ref: { foodId: food.id },
                    name: food.name,
                    gramsText: String(choice.grams ?? food.gramsPerPiece ?? 100),
                    kcalPerGram: food.per100.kcal / 100,
                  },
                ]);
                setAdding(false);
              }}
            />
            <Button label={t('common.cancel')} variant="ghost" onPress={() => setAdding(false)} />
          </View>
        ) : (
          <>
            <Segmented
              options={MEAL_SLOTS.map((value) => ({
                value,
                label: t(`meals.slot.${value}` as TranslationKey),
              }))}
              value={slot}
              onChange={(next) => {
                setSlot(next);
                setError(null);
              }}
              accessibilityLabel={t('fit.add.slot')}
            />
            <View>
              {rows.map((row, index) => (
                <View key={row.key}>
                  {index > 0 ? <Divider /> : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      paddingVertical: theme.spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <Text variant="body" numberOfLines={2}>
                        {row.name}
                      </Text>
                      <Text variant="caption" tone="muted" style={numeric}>
                        {t('fit4.unit.kcal', {
                          value: whole.format(row.kcalPerGram * (parseDecimal(row.gramsText) ?? 0)),
                        })}
                      </Text>
                    </View>
                    <View style={{ width: theme.spacing.xxl * 3 }}>
                      <Input
                        value={row.gramsText}
                        onChangeText={(value) =>
                          change(
                            rows.map((entry) =>
                              entry.key === row.key ? { ...entry, gramsText: value } : entry,
                            ),
                          )
                        }
                        keyboardType="decimal-pad"
                        accessibilityLabel={t('fit.photo.gramsOf', { name: row.name })}
                      />
                    </View>
                    <IconButton
                      icon="close"
                      label={t('fit4.photo.remove', { name: row.name })}
                      onPress={() => change(rows.filter((entry) => entry.key !== row.key))}
                    />
                  </View>
                </View>
              ))}
            </View>
            <Button
              label={t('fit4.photo.add')}
              variant="secondary"
              size="sm"
              icon="plus"
              onPress={() => setAdding(true)}
            />
            {error ? (
              <Text variant="label" tone={confirmLarge ? 'default' : 'danger'}>
                {error}
              </Text>
            ) : null}
            <Button
              label={
                rows.length === 0
                  ? t('fit4.edit.removeMeal')
                  : confirmLarge
                    ? t('fit.add.logAnyway')
                    : t('fit4.edit.save')
              }
              variant={rows.length === 0 ? 'danger' : 'primary'}
              icon={rows.length === 0 ? 'trash' : 'check'}
              onPress={() => void save()}
              loading={saving}
              disabled={saving || (rows.length > 0 && !valid)}
              fullWidth
            />
            {rows.length > 0 ? (
              <Button
                label={t('fit4.edit.removeMeal')}
                variant="ghost"
                icon="trash"
                onPress={() => void remove()}
                disabled={saving}
              />
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}
