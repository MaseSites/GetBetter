import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fit, type FitFood } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Divider, Input, Text } from '@/ui';

import { useFit } from './useFit';

/** Erst suchen, wenn eine Weile nichts mehr getippt wurde — nicht bei jedem Zeichen. */
const SEARCH_DELAY_MS = 350;

/** Ein kurzes Wort fuer die Quelle eines Datensatzes. */
export function sourceKey(source: FitFood['source']): TranslationKey {
  return `fit.source.${source}` as TranslationKey;
}

/** Was ein Suchfehler heisst — nicht jeder ist „offline“. */
function searchErrorKey(code: string): TranslationKey {
  if (code === 'offline') return 'fit.offline.body';
  if (code === 'rate_limited') return 'fit4.search.busy';
  return 'fit4.search.failed';
}

/**
 * Lebensmittel suchen: das Feld, darunter die Treffer. Leer zeigt es, was
 * zuletzt gegessen wurde — mit der letzten Menge, ein Tipp genuegt. Genutzt
 * beim Eintragen, beim Bearbeiten und beim Foto (ersetzen, hinzufuegen).
 */
export function FoodSearch({
  onPick,
  initialQuery = '',
  showRecent = true,
  onQueryChange,
}: {
  /** `grams`: die letzte Menge, wenn aus „Zuletzt gegessen“ gewaehlt. `term`: das gesuchte Wort. */
  onPick: (food: FitFood, choice: { term: string | null; grams: number | null }) => void;
  initialQuery?: string;
  showRecent?: boolean;
  onQueryChange?: (query: string) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<FitFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const recent = useFit(() => fit.recentFoods(), [], ['diary']);
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const text = query.trim();

  useEffect(() => {
    if (text.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void fit.searchFoods(text).then((result) => {
        if (cancelled) return;
        setSearching(false);
        setResults(result.ok ? result.data.foods : []);
        setFailure(result.ok ? null : result.error);
      });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text]);

  const recentFoods = showRecent && text.length < 2 ? (recent.data?.foods ?? []) : [];
  // Treffer stehen in einem weissen Block wie auf den Bereichsseiten.
  const blockStyle = [
    theme.elevation.card,
    {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.panel,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xs,
    },
  ];

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Input
        label={t('fit.add.search')}
        placeholder={t('fit.add.searchPlaceholder')}
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          onQueryChange?.(value);
          if (value.trim().length < 2) {
            setResults([]);
            setFailure(null);
          }
        }}
        icon="search"
        returnKeyType="search"
        autoCapitalize="none"
      />
      {searching ? (
        <Text variant="label" tone="muted">
          {t('fit.add.searching')}
        </Text>
      ) : null}
      {failure && text.length >= 2 ? (
        <Text variant="label" tone="danger">
          {t(searchErrorKey(failure))}
        </Text>
      ) : null}

      {recentFoods.length > 0 ? (
        <View style={[styles.block, blockStyle]}>
          <Text variant="overline" tone="faint" style={{ paddingTop: theme.spacing.md }}>
            {t('fit4.recent.title')}
          </Text>
          {recentFoods.map((entry, index) => (
            <FoodRow
              key={entry.food.id}
              first={index === 0}
              name={entry.food.name}
              detail={t('fit4.recent.last', { grams: whole.format(entry.grams) })}
              value={t('fit4.unit.kcal', {
                value: whole.format((entry.food.per100.kcal * entry.grams) / 100),
              })}
              label={t('fit4.recent.pick', {
                name: entry.food.name,
                grams: whole.format(entry.grams),
              })}
              onPress={() => onPick(entry.food, { term: null, grams: entry.grams })}
            />
          ))}
        </View>
      ) : null}

      {results.length > 0 ? (
        <View style={[styles.block, blockStyle]}>
          {results.map((food, index) => (
            <FoodRow
              key={food.id}
              first={index === 0}
              name={food.name}
              detail={`${t(sourceKey(food.source))}${food.stateMismatch ? ` · ${t('fit.add.stateCheck')}` : ''}`}
              value={t('fit.add.per100', { kcal: whole.format(food.per100.kcal) })}
              label={t('fit4.search.pick', {
                name: food.name,
                kcal: whole.format(food.per100.kcal),
              })}
              onPress={() => onPick(food, { term: text, grams: null })}
            />
          ))}
        </View>
      ) : null}
      {text.length >= 2 && !searching && !failure && results.length === 0 ? (
        <Text variant="label" tone="muted">
          {t('fit.add.nothing')}
        </Text>
      ) : null}
    </View>
  );
}

function FoodRow({
  first,
  name,
  detail,
  value,
  label,
  onPress,
}: {
  first: boolean;
  name: string;
  detail: string;
  value: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <View>
      {first ? null : <Divider />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: 48,
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.6 : 1,
          transform: [{ scale: pressed ? theme.motion.pressScale.row : 1 }],
        })}
      >
        <View style={{ flex: 1 }}>
          <Text variant="label" numberOfLines={1} style={{ fontWeight: theme.fontWeight.semibold }}>
            {name}
          </Text>
          <Text
            variant="caption"
            tone="faint"
            numberOfLines={1}
            style={{ fontSize: theme.fontSize.sm, lineHeight: theme.lineHeight.sm }}
          >
            {detail}
          </Text>
        </View>
        <Text variant="label" tone="muted" style={numeric}>
          {value}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
});
