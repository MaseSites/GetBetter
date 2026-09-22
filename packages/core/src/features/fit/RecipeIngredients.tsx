import { View } from 'react-native';

import type { CoverageLine, FitRecipe } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Text } from '@/ui';

import { Hairline } from './KitchenKit';
import { scaleAmount, scaleCoverage } from './kitchenLogic';

/** Ein Wort zum Stand einer Zutat — nie nur eine Farbe. */
function statusKey(line: CoverageLine | undefined, substituted: boolean): TranslationKey {
  if (substituted) return 'fit.recipe.status.substituted';
  if (!line) return 'fit.recipe.status.none';
  if (line.optional) return 'fit.recipe.status.optional';
  if (line.status === 'have' || line.status === 'have_unknown')
    return line.expiring ? 'fit.recipe.status.expiring' : 'fit.recipe.status.have';
  if (line.status === 'short') return 'fit.recipe.status.short';
  return line.basic ? 'fit.recipe.status.basic' : 'fit.recipe.status.missing';
}

/** Die Zutaten fuer `factor` × die Portionen des Rezepts, mit dem Stand im Vorrat. */
export function RecipeIngredients({
  recipe,
  coverage,
  factor,
}: {
  recipe: FitRecipe;
  coverage: readonly CoverageLine[];
  factor: number;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const number = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 2 });

  return (
    <View>
      {recipe.items.map((item, index) => {
        const found = coverage.find((entry) => entry.foodId === item.foodId);
        const line = found ? scaleCoverage(found, factor) : undefined;
        const missing =
          line &&
          (line.status === 'missing' || line.status === 'short') &&
          !line.basic &&
          !line.optional;
        return (
          <View key={`${item.foodId}-${index}`}>
            {index > 0 ? <Hairline /> : null}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                paddingVertical: theme.spacing.md,
              }}
            >
              <Text
                variant="body"
                style={[
                  numeric,
                  { width: theme.spacing.xxl * 3, fontWeight: theme.fontWeight.bold },
                ]}
              >
                {`${number.format(scaleAmount(item.amount, factor, item.unit))} ${t(`fit.unit.${item.unit}` as TranslationKey)}`}
              </Text>
              <Text variant="body" style={{ flex: 1 }}>
                {item.name}
              </Text>
              <Text
                variant="label"
                tone={missing ? 'danger' : 'muted'}
                style={missing ? { fontWeight: theme.fontWeight.semibold } : null}
              >
                {t(statusKey(line, item.substituted === true))}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
