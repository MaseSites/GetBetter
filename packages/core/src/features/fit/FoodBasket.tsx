import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Divider, IconButton, Text } from '@/ui';

import { macrosOf, totalOf, type BasketItem } from './mealMath';

/**
 * Was schon in der Mahlzeit liegt, bevor sie eingetragen wird: je Zeile Name,
 * Gramm und kcal, ein Kreuz zum Entfernen, darunter die Summe. Vorschau — der
 * Dienst rechnet beim Speichern selbst.
 */
export function FoodBasket({
  items,
  onRemove,
}: {
  items: readonly BasketItem[];
  onRemove: (foodId: string) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  if (items.length === 0) return null;
  const total = totalOf(items);

  return (
    <View
      style={[
        theme.elevation.card,
        {
          borderRadius: theme.radii.panel,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.xs,
        },
      ]}
    >
      {items.map((item, index) => (
        <View key={item.foodId}>
          {index > 0 ? <Divider /> : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.xs,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="body" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="caption" tone="muted" style={numeric}>
                {t('fit4.unit.g', { value: whole.format(item.grams) })}
              </Text>
            </View>
            <Text variant="label" style={numeric}>
              {t('fit4.unit.kcal', { value: whole.format(macrosOf(item.per100, item.grams).kcal) })}
            </Text>
            <IconButton
              icon="close"
              label={t('fit4.basket.remove', { name: item.name })}
              onPress={() => onRemove(item.foodId)}
            />
          </View>
        </View>
      ))}
      <Divider />
      <View style={{ flexDirection: 'row', paddingVertical: theme.spacing.sm }}>
        <Text variant="label" tone="muted" style={{ flex: 1 }}>
          {t('fit4.basket.total', { count: items.length })}
        </Text>
        <Text variant="label" style={numeric}>
          {t('fit4.unit.kcal', { value: whole.format(total.kcal) })}
        </Text>
      </View>
    </View>
  );
}
