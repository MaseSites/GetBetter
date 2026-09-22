import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { FitRecipe } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Checkbox, Input, Text } from '@/ui';

import { Pill } from './KitchenKit';
import { scaleAmount } from './kitchenLogic';
import { parseDecimal } from './setupForm';

/**
 * Ein eigenes Rezept bearbeiten: Titel, Portionen, Mengen. Wer die Portionen
 * aendert, kann die Mengen gleich mitrechnen lassen. Gespeichert wird als
 * Vorschlag; was nicht passt, steht direkt darunter.
 */
export function RecipeEditForm({
  recipe,
  onSubmit,
  onCancel,
}: {
  recipe: FitRecipe;
  /** Gibt einen Fehlertext zurueck, oder null. */
  onSubmit: (next: FitRecipe) => Promise<string | null>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [title, setTitle] = useState(recipe.title);
  const [servings, setServings] = useState(String(recipe.servings));
  const [amounts, setAmounts] = useState(recipe.items.map((item) => String(item.amount)));
  const [rescale, setRescale] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const count = parseDecimal(servings);
    const parsed = amounts.map((value) => parseDecimal(value));
    if (
      title.trim().length === 0 ||
      count === null ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 20 ||
      parsed.some((value) => value === null || value <= 0)
    ) {
      setProblem(t('fit.recipe.editInvalid'));
      return;
    }
    // Mitrechnen: die Mengen, wie sie jetzt dastehen, auf die neuen Portionen.
    const factor = rescale ? count / recipe.servings : 1;
    const items = recipe.items.map((item, index) => ({
      ...item,
      amount: scaleAmount(parsed[index] ?? item.amount, factor, item.unit),
    }));
    setBusy(true);
    setProblem(null);
    const failed = await onSubmit({ ...recipe, title: title.trim(), servings: count, items });
    setBusy(false);
    if (failed) setProblem(failed);
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Input label={t('fit.recipe.title')} value={title} onChangeText={setTitle} />
      <Input
        label={t('fit.recipe.servings')}
        value={servings}
        onChangeText={setServings}
        keyboardType="number-pad"
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: rescale }}
        aria-checked={rescale}
        accessibilityLabel={t('fit.recipe.rescale')}
        onPress={() => setRescale((value) => !value)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        }}
      >
        <Checkbox checked={rescale} />
        <Text variant="body" style={{ flex: 1 }}>
          {t('fit.recipe.rescale')}
        </Text>
      </Pressable>
      {recipe.items.map((item, index) => (
        <View
          key={`${item.foodId}-${index}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
        >
          <View style={{ width: theme.spacing.xxl * 3 }}>
            <Input
              value={amounts[index] ?? ''}
              onChangeText={(value) =>
                setAmounts((current) =>
                  current.map((entry, position) => (position === index ? value : entry)),
                )
              }
              keyboardType="decimal-pad"
              accessibilityLabel={t('fit.recipe.amountOf', { name: item.name })}
            />
          </View>
          <Text variant="body" style={{ flex: 1 }}>
            {`${t(`fit.unit.${item.unit}` as TranslationKey)} ${item.name}`}
          </Text>
        </View>
      ))}
      {problem ? (
        <Text variant="label" tone="danger">
          {problem}
        </Text>
      ) : null}
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        <Pill
          label={t('fit.recipe.proposeEdit')}
          icon="check"
          fullWidth
          onPress={() => void submit()}
          loading={busy}
          disabled={busy}
        />
        <Pill label={t('common.cancel')} tone="soft" fullWidth onPress={onCancel} />
      </View>
    </View>
  );
}
