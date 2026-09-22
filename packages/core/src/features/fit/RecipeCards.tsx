import { Animated, Pressable, StyleSheet, View } from 'react-native';

import type { FitRecipe, RecipeSuggestion } from '@/db/fit';
import { useI18n, type Translate } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text, usePressScale } from '@/ui';

import { shortFoodNames } from './foodLabel';
import { Hairline, LINE, RoundIcon } from './KitchenKit';
import { FadeImage, Thumb } from './KitchenMedia';
import { recipeImageFor } from './recipeImages';

const PHOTO = 168;
const BADGE_Y = 5;
const BADGE_X = 10;
const BADGE_TOP = 10;
const META_TOP = 3;
const CARD_BOTTOM = 14;
const TITLE_LINE = 24;
const TITLE_EM = -0.015;
const CHEVRON = 16;

/** „25 Min · 540 kcal · 31 g Eiweiss“ — und beim Vorschlag, was er aufbraucht. */
function metaOf(
  t: Translate,
  whole: Intl.NumberFormat,
  recipe: FitRecipe,
  suggestion?: RecipeSuggestion,
): string {
  const perServing = suggestion?.nutrition.perServing ?? recipe.nutrition?.perServing;
  const expiring = suggestion?.expiring ?? [];
  return [
    t('fit.kitchen.card.minutes', { minutes: recipe.timeMinutes }),
    perServing ? t('fit.plan.kcal', { kcal: whole.format(perServing.kcal) }) : null,
    perServing
      ? t('fit.kitchen.card.protein', { protein: whole.format(perServing.proteinG) })
      : null,
    expiring.length > 0
      ? t('fit.kitchen.card.usesUp', { list: shortFoodNames(expiring).join(', ') })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Was fehlt, in Worten: nur Pflichtzutaten — Grundzutaten und Freiwilliges nennt erst das Rezept. */
function coverageOf(t: Translate, suggestion: RecipeSuggestion) {
  const required = suggestion.missing.filter((entry) => !entry.basic && !entry.optional);
  const badge =
    required.length > 0
      ? t('fit.kitchen.badge.missing', {
          list: shortFoodNames(required.map((entry) => entry.name)).join(', '),
        })
      : suggestion.short.length > 0
        ? t('fit.kitchen.badge.short', {
            list: shortFoodNames(suggestion.short.map((entry) => entry.name)).join(', '),
          })
        : t('fit.kitchen.badge.all');
  return { badge, all: required.length === 0 && suggestion.short.length === 0 };
}

/**
 * Die grosse Rezeptkarte wie in der Vision: Foto ueber die ganze Breite,
 * Titel, Werte, ein Abzeichen „Alles da“ oder „Fehlt: Rueebli“ und rechts der
 * Pfeil. Die ganze Karte ist ein Knopf; der Favorit liegt im Rezeptblatt.
 */
export function RecipeCard({
  recipe,
  suggestion,
  onPress,
}: {
  recipe: FitRecipe;
  suggestion: RecipeSuggestion;
  onPress: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.button);
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const image = recipeImageFor(recipe);
  const { badge, all } = coverageOf(t, suggestion);

  return (
    <Animated.View
      style={[
        theme.elevation.card,
        {
          borderRadius: theme.radii.panel,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
          transform: [{ scale: press.scale }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${recipe.title}, ${badge}`}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
      >
        {image ? <FadeImage source={image} label={recipe.title} style={styles.photo} /> : null}
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: CARD_BOTTOM,
          }}
        >
          <Text
            variant="title"
            style={{
              fontSize: theme.fontSize.lg,
              lineHeight: TITLE_LINE,
              letterSpacing: theme.fontSize.lg * TITLE_EM,
            }}
          >
            {recipe.title}
          </Text>
          <Text
            variant="label"
            tone="faint"
            style={{
              marginTop: META_TOP,
              lineHeight: LINE.sm,
              fontWeight: theme.fontWeight.regular,
            }}
          >
            {metaOf(t, whole, recipe, suggestion)}
          </Text>
          <View style={[styles.row, { marginTop: BADGE_TOP, gap: theme.spacing.md }]}>
            <View
              style={{
                borderRadius: theme.radii.pill,
                paddingHorizontal: BADGE_X,
                paddingVertical: BADGE_Y,
                flexShrink: 1,
                backgroundColor: all ? theme.colors.accent : theme.colors.surfaceMuted,
              }}
            >
              <Text
                variant="caption"
                numberOfLines={1}
                style={{
                  fontSize: theme.fontSize.caption,
                  lineHeight: LINE.caption,
                  fontWeight: theme.fontWeight.semibold,
                  color: all ? theme.colors.textOnAccent : theme.colors.text,
                }}
              >
                {badge}
              </Text>
            </View>
            <View style={styles.push}>
              <Icon name="forward" size={CHEVRON} color={theme.colors.textFaint} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Eine kompakte Zeile: Bild, Titel, Werte — der Stern daneben als eigener Knopf. */
export function RecipeRow({
  recipe,
  suggestion,
  onPress,
  onStar,
}: {
  recipe: FitRecipe;
  suggestion?: RecipeSuggestion;
  onPress: () => void;
  onStar?: (() => void) | undefined;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const coverage = suggestion ? coverageOf(t, suggestion) : null;

  return (
    <View style={[styles.row, { gap: theme.spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recipe.title}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          styles.grow,
          {
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            transform: [{ scale: pressed ? theme.motion.pressScale.row : 1 }],
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Thumb source={recipeImageFor(recipe)} label={recipe.title} />
        <View style={[styles.grow, { gap: 2 }]}>
          <Text variant="body" numberOfLines={2} style={{ fontWeight: theme.fontWeight.semibold }}>
            {recipe.title}
          </Text>
          <Text variant="label" tone="muted" numberOfLines={2}>
            {[metaOf(t, whole, recipe, suggestion), coverage?.badge].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
      {onStar ? (
        <RoundIcon
          icon={recipe.favorite ? 'starFilled' : 'star'}
          label={t(recipe.favorite ? 'fit.recipe.unfavorite' : 'fit.recipe.favorite', {
            title: recipe.title,
          })}
          active={recipe.favorite === true}
          tone={recipe.favorite ? 'soft' : 'white'}
          onPress={onStar}
        />
      ) : null}
    </View>
  );
}

/** Zeilen in einem Block, getrennt durch Haarlinien. */
export function RecipeRows({
  entries,
  onOpen,
  onStar,
}: {
  entries: readonly { recipe: FitRecipe; suggestion?: RecipeSuggestion; starrable?: boolean }[];
  onOpen: (id: string) => void;
  onStar?: (recipe: FitRecipe) => void;
}) {
  return entries.map((entry, index) => (
    <View key={entry.recipe.id}>
      {index > 0 ? <Hairline /> : null}
      <RecipeRow
        recipe={entry.recipe}
        {...(entry.suggestion ? { suggestion: entry.suggestion } : {})}
        onPress={() => onOpen(entry.recipe.id)}
        onStar={entry.starrable && onStar ? () => onStar(entry.recipe) : undefined}
      />
    </View>
  ));
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  photo: { width: '100%', height: PHOTO },
  push: { marginLeft: 'auto' },
});
