import { View } from 'react-native';

import type { FitFood, MealAnalysis } from '@/db/fit';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Divider, IconButton, Input, Text } from '@/ui';

import { FoodSearch, sourceKey } from './FoodSearch';
import type { PhotoRow } from './mealMath';
import { parseDecimal } from './setupForm';

/** Eine Zeile im Blatt: was die KI sah (oder selbst hinzugefuegt), mit Feld fuer die Gramm. */
export type EditRow = Omit<PhotoRow, 'food' | 'grams'> & {
  food: FitFood | null;
  gramsText: string;
  uncertain: boolean;
};

export const rowsOf = (analysis: MealAnalysis | null): EditRow[] =>
  (analysis?.items ?? []).map((item, index) => ({
    key: `ai-${index}`,
    term: item.term,
    food: item.food,
    gramsText: String(item.grams),
    aiGrams: item.grams,
    minGrams: item.minGrams,
    maxGrams: item.maxGrams,
    uncertain: item.matchUncertain,
  }));

export const asPhotoRow = (row: EditRow): PhotoRow => ({
  ...row,
  grams: parseDecimal(row.gramsText),
});

/** Was gerade gesucht wird: eine Zeile ersetzen oder eine neue hinzufuegen. */
export type Searching = { mode: 'replace'; key: string; term: string } | { mode: 'add' } | null;

/**
 * Die erkannten Zutaten zum Pruefen: Gramm aendern, eine falsche entfernen
 * oder ersetzen, eine fehlende hinzufuegen — beides ueber die Suche.
 */
export function PhotoItems({
  rows,
  searching,
  onRows,
  onSearch,
}: {
  rows: readonly EditRow[];
  searching: Searching;
  onRows: (next: EditRow[]) => void;
  onSearch: (next: Searching) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const update = (key: string, patch: Partial<EditRow>) =>
    onRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function picked(food: FitFood) {
    if (searching?.mode === 'replace') {
      // Ersetzt: neues Lebensmittel, die geschaetzten Gramm bleiben.
      update(searching.key, { food, uncertain: false });
    } else {
      onRows([
        ...rows,
        {
          key: `own-${food.id}-${rows.length}`,
          term: food.name,
          food,
          gramsText: String(food.gramsPerPiece ?? 100),
          aiGrams: null,
          minGrams: null,
          maxGrams: null,
          uncertain: false,
        },
      ]);
    }
    onSearch(null);
  }

  if (searching)
    return (
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="label">
          {searching.mode === 'replace'
            ? t('fit4.photo.replaceTitle', { term: searching.term })
            : t('fit4.photo.addTitle')}
        </Text>
        <FoodSearch
          initialQuery={searching.mode === 'replace' ? searching.term : ''}
          showRecent={searching.mode === 'add'}
          onPick={(food) => picked(food)}
        />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => onSearch(null)} />
      </View>
    );

  return (
    <View>
      {rows.length === 0 ? (
        <Text variant="body" tone="muted">
          {t('fit4.photo.empty')}
        </Text>
      ) : null}
      {rows.map((row, index) => {
        const name = row.food?.name ?? row.term;
        return (
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
                  {name}
                </Text>
                <Text variant="caption" tone={row.food ? 'muted' : 'danger'}>
                  {row.food
                    ? `${t(sourceKey(row.food.source))}${row.uncertain ? ` · ${t('fit.photo.matchUncertain')}` : ''}`
                    : t('fit.photo.noMatch', { term: row.term })}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  <Button
                    label={row.food ? t('fit4.photo.replace') : t('fit4.photo.choose')}
                    variant="ghost"
                    size="sm"
                    onPress={() => onSearch({ mode: 'replace', key: row.key, term: row.term })}
                  />
                </View>
              </View>
              {row.food ? (
                <View style={{ width: theme.spacing.xxl * 3 }}>
                  <Input
                    value={row.gramsText}
                    onChangeText={(value) => update(row.key, { gramsText: value })}
                    keyboardType="decimal-pad"
                    accessibilityLabel={t('fit.photo.gramsOf', { name })}
                  />
                </View>
              ) : null}
              <IconButton
                icon="close"
                label={t('fit4.photo.remove', { name })}
                onPress={() => onRows(rows.filter((entry) => entry.key !== row.key))}
              />
            </View>
          </View>
        );
      })}
      <Button
        label={t('fit4.photo.add')}
        variant="secondary"
        size="sm"
        icon="plus"
        onPress={() => onSearch({ mode: 'add' })}
      />
    </View>
  );
}
