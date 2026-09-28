import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ShoppingItemRow } from '@/db';
import { shopping as shoppingRepo } from '@/db/repositories';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Chip, Input, Sheet, Text } from '@/ui';

import {
  SHOPPING_CATEGORIES,
  guessCategory,
  isShoppingCategory,
  type ShoppingCategory,
} from './categories';

/**
 * Ein Posten zum Nachbessern: Name, Menge, Abteilung — statt löschen und neu
 * schreiben. Speichert erst mit „Fertig“.
 */
export function ShoppingItemSheet({
  item,
  onClose,
}: {
  item: ShoppingItemRow | null;
  onClose: () => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item?.quantity ?? '');
  const [category, setCategory] = useState<ShoppingCategory>(
    item
      ? isShoppingCategory(item.category)
        ? item.category
        : guessCategory(item.name)
      : 'other',
  );

  async function save() {
    if (!item) return;
    await shoppingRepo.update(item.id, { name, quantity, category });
    onClose();
  }

  async function remove() {
    if (!item) return;
    await shoppingRepo.remove(item.id);
    onClose();
  }

  return (
    <Sheet visible={item !== null} onClose={onClose} title={t('familyplus.shopping.edit')}>
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <Input
          label={t('familyplus.shopping.name')}
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
        />
        <Input
          label={t('familyplus.shopping.quantity')}
          placeholder={t('familyplus.shopping.quantityPlaceholder')}
          value={quantity}
          onChangeText={setQuantity}
        />
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {t('familyplus.shopping.category')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.xs }]}>
            {SHOPPING_CATEGORIES.map((value) => (
              <Chip
                key={value}
                label={t(`shopping.category.${value}` as TranslationKey)}
                selected={category === value}
                onPress={() => setCategory(value)}
              />
            ))}
          </View>
        </View>
        <Button
          label={t('common.done')}
          icon="check"
          disabled={name.trim().length === 0}
          onPress={save}
        />
        <Button label={t('shopping.remove')} variant="ghost" icon="trash" onPress={remove} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
