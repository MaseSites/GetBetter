import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { fit, type FitRecipe } from '@/db/fit';
import { useI18n, type Translate, type TranslationKey } from '@/i18n';
import { hueTint, useTheme } from '@/theme';
import { EmptyState, Input, Text } from '@/ui';

import { shortFoodName } from './foodLabel';
import { FitState } from './FitGate';
import { Block, LINE, SEC_TOP, Sec } from './KitchenKit';
import { daysBetween } from './kitchenLogic';
import { WhiteChip } from './KitchenMedia';
import { RecipeCard, RecipeRows } from './RecipeCards';
import { RecipeSheet } from './RecipeSheet';
import { useFit } from './useFit';

export { RecipeRow } from './RecipeCards';

/** Bekannte Stichwoerter der Bibliothek; eigene Tags stehen, wie sie sind. */
const KNOWN_TAGS = [
  'schnell',
  'eiweissreich',
  'vegetarisch',
  'vegan',
  'meal-prep',
  'familie',
  'backen',
  'resteverwertung',
  'training',
];
/** So viele grosse Karten; der Rest der Vorschlaege steht als Zeilen darunter. */
const CARDS = 2;
/** „Bald brauchen“: was in so vielen Tagen weg muss, hoechstens so viele Chips. */
const NEED_DAYS = 5;
const NEED_CHIPS = 4;

export function tagLabel(t: Translate, tag: string): string {
  return KNOWN_TAGS.includes(tag) ? t(`fit.tag.${tag}` as TranslationKey) : tag;
}

/** „morgen“, „2 Tage“, „abgelaufen“ — und ob es rot stehen muss (heute, morgen, vorbei). */
export function dueWord(
  t: Translate,
  today: string,
  day: string,
): { text: string; urgent: boolean } {
  const left = daysBetween(today, day);
  if (left < 0) return { text: t('fit.kitchen.due.expired'), urgent: true };
  if (left === 0) return { text: t('fit.kitchen.due.today'), urgent: true };
  if (left === 1) return { text: t('fit.kitchen.due.tomorrow'), urgent: true };
  return { text: t('fit.kitchen.due.days', { count: left }), urgent: false };
}

const matches = (recipe: FitRecipe, query: string, tag: string | null) => {
  if (tag && !recipe.tags.includes(tag)) return false;
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [recipe.title, ...recipe.items.map((item) => item.name)]
    .join(' ')
    .toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
};

/**
 * Rezepte wie in der Vision: oben, was im Vorrat bald weg muss, darunter die
 * zwei grossen Karten dessen, was sich daraus kochen laesst. Erst danach Suche
 * und Stichwoerter, weitere Vorschlaege, die eigenen Rezepte und die Bibliothek.
 */
export function RecipesPanel({ day }: { day: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const suggestions = useFit(() => fit.suggest(), [], ['kitchen']);
  const saved = useFit(() => fit.recipes(), [], ['kitchen']);
  const library = useFit(() => fit.library(), [], ['kitchen']);
  const pantry = useFit(() => fit.pantry(), [], ['kitchen']);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const chipText = { lineHeight: LINE.sm, fontWeight: theme.fontWeight.semibold } as const;

  async function star(recipe: FitRecipe) {
    const result = await fit.favoriteRecipe(recipe.id, !recipe.favorite);
    setProblem(result.ok ? null : t('fit.error.body'));
    if (result.ok) suggestions.reload();
  }

  const mine = (saved.data?.recipes ?? []).filter((recipe) => matches(recipe, query, tag));
  const others = (library.data?.recipes ?? []).filter((recipe) => matches(recipe, query, tag));
  const allSuggestions = suggestions.data?.suggestions ?? [];
  // Die zwei grossen Karten bleiben stehen; die Suche filtert nur, was darunter kommt.
  const top = allSuggestions.slice(0, CARDS);
  const further = allSuggestions.slice(CARDS).filter((entry) => matches(entry.recipe, query, tag));
  const need = (pantry.data?.items ?? [])
    .filter((item) => item.bestBefore !== null && daysBetween(day, item.bestBefore) <= NEED_DAYS)
    .sort((a, b) => (a.bestBefore ?? '').localeCompare(b.bestBefore ?? ''))
    .slice(0, NEED_CHIPS);
  const tags = [
    ...new Set(
      [...(saved.data?.recipes ?? []), ...(library.data?.recipes ?? [])].flatMap(
        (recipe) => recipe.tags,
      ),
    ),
  ].sort((a, b) => tagLabel(t, a).localeCompare(tagLabel(t, b)));
  const filtering = query.trim().length > 0 || tag !== null;
  const rejected = library.data?.rejected ?? [];
  const urgentColor = hueTint(theme, 'health').base;

  return (
    <View>
      {need.length > 0 ? (
        <>
          <Sec title={t('fit.kitchen.soonNeed')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {need.map((item) => {
              const name = shortFoodName(item.name);
              const due = item.bestBefore ? dueWord(t, day, item.bestBefore) : null;
              return (
                <WhiteChip
                  key={item.id}
                  dense
                  label={due ? `${name}, ${due.text}` : name}
                  onPress={() => setQuery(name)}
                >
                  <Text variant="label" style={chipText}>
                    {name}
                    {due ? (
                      <Text
                        variant="label"
                        style={[chipText, due.urgent ? { color: urgentColor } : null]}
                      >
                        {` · ${due.text}`}
                      </Text>
                    ) : null}
                  </Text>
                </WhiteChip>
              );
            })}
          </View>
        </>
      ) : null}

      <Sec title={t('fit.kitchen.cookFrom')} />
      <FitState
        loading={suggestions.loading}
        error={suggestions.error}
        onRetry={suggestions.reload}
      >
        {suggestions.data && suggestions.data.pantryCount === 0 ? (
          <Block>
            <Text variant="body" tone="muted">
              {t('fit.recipe.pantryEmpty')}
            </Text>
          </Block>
        ) : top.length === 0 ? (
          <Block>
            <Text variant="body" tone="muted">
              {t('fit.recipe.noMatch')}
            </Text>
          </Block>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {top.map((entry) => (
              <RecipeCard
                key={entry.recipe.id}
                recipe={entry.recipe}
                suggestion={entry}
                onPress={() => setOpen(entry.recipe.id)}
              />
            ))}
          </View>
        )}
      </FitState>

      <View style={{ gap: theme.spacing.sm, marginTop: SEC_TOP }}>
        <Input
          label={t('fit.recipe.search')}
          placeholder={t('fit.recipe.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {tags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.sm, padding: 2 }}
          >
            <WhiteChip
              label={t('fit.recipe.allTags')}
              selected={tag === null}
              onPress={() => setTag(null)}
            >
              {t('fit.recipe.allTags')}
            </WhiteChip>
            {tags.map((entry) => (
              <WhiteChip
                key={entry}
                label={tagLabel(t, entry)}
                selected={tag === entry}
                onPress={() => setTag(tag === entry ? null : entry)}
              >
                {tagLabel(t, entry)}
              </WhiteChip>
            ))}
          </ScrollView>
        ) : null}
        {problem ? (
          <Text variant="label" tone="danger">
            {problem}
          </Text>
        ) : null}
      </View>

      {further.length > 0 ? (
        <>
          <Sec title={t('fit.kitchen.moreSuggest')} />
          <Block flush>
            <RecipeRows
              entries={further.map((entry) => ({ recipe: entry.recipe, suggestion: entry }))}
              onOpen={setOpen}
            />
          </Block>
        </>
      ) : null}

      <Sec title={t('fit.recipe.mine')} />
      {(saved.data?.recipes ?? []).length === 0 ? (
        <EmptyState
          compact
          title={t('fit.recipe.mineEmptyTitle')}
          body={t('fit.recipe.mineEmptyBody')}
        />
      ) : mine.length === 0 ? (
        <Text variant="body" tone="muted">
          {t('fit.recipe.noResults')}
        </Text>
      ) : (
        <Block flush>
          <RecipeRows
            entries={mine.map((recipe) => ({ recipe, starrable: true }))}
            onOpen={setOpen}
            onStar={(recipe) => void star(recipe)}
          />
        </Block>
      )}

      <Sec title={t('fit.recipe.library')} />
      {others.length === 0 && filtering ? (
        <Text variant="body" tone="muted">
          {t('fit.recipe.noResults')}
        </Text>
      ) : others.length > 0 ? (
        <Block flush>
          <RecipeRows entries={others.map((recipe) => ({ recipe }))} onOpen={setOpen} />
        </Block>
      ) : null}
      {rejected.length > 0 ? (
        <Text variant="caption" tone="muted" style={{ marginTop: theme.spacing.sm }}>
          {t('fit.recipe.hidden', { count: rejected.length })}
        </Text>
      ) : null}
      {open ? (
        <RecipeSheet
          recipeId={open}
          day={day}
          onClose={() => {
            setOpen(null);
            saved.reload();
            library.reload();
            suggestions.reload();
          }}
        />
      ) : null}
    </View>
  );
}
