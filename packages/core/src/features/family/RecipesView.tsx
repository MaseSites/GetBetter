import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { recipes as recipeRepo, useLiveQuery, type RecipeRow } from '@/db';
import { shopping as shoppingRepo } from '@/db/repositories';
import { guessCategory, splitQuantity } from '@/features/shopping/categories';
import { useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FloatingButton,
  Header,
  Icon,
  Input,
  Screen,
  Sheet,
  SwipeRow,
  Text,
} from '@/ui';

const SERVINGS = [1, 2, 4, 6] as const;
const TAGS = ['quick', 'vegi', 'kids', 'guests'] as const;

type Editor = { mode: 'new' } | { mode: 'edit'; row: RecipeRow } | null;

/** Rezepte des Haushalts — mit einem Knopf, der die Zutaten einkaufen laesst. */
export function RecipesView({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;

  const [editor, setEditor] = useState<Editor>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const list = useLiveQuery(
    () => recipeRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const rows = list.data ?? [];
  const visible = filter ? rows.filter((row) => row.tags.includes(filter)) : rows;
  const tagLabel = (tag: string) => t(`recipes.tag.${tag}` as TranslationKey);

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t(rows.length === 1 ? 'recipes.count.one' : 'recipes.count', {
            count: rows.length,
          })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState title={t('recipes.empty.title')} body={t('recipes.empty.body')} />
      ) : null}

      {rows.length > 0 ? (
        <View style={[styles.chips, { gap: theme.spacing.sm }]}>
          <Chip
            label={t('recipes.all')}
            selected={filter === null}
            onPress={() => setFilter(null)}
          />
          {TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tagLabel(tag)}
              selected={filter === tag}
              onPress={() => setFilter(tag)}
            />
          ))}
        </View>
      ) : null}

      {/* Antippen oeffnet das Rezept, nach links wischen loescht es. */}
      {visible.map((recipe) => (
        <SwipeRow
          key={recipe.id}
          radius={theme.radii.md}
          onDelete={() => void recipeRepo.remove(recipe.id)}
        >
          <Card
            onPress={() => setEditor({ mode: 'edit', row: recipe })}
            accessibilityLabel={recipe.title}
          >
            <View style={{ gap: theme.spacing.xs }}>
              <Text variant="title">{recipe.title}</Text>
              <Text variant="caption" tone="muted">
                {t('recipes.summary', {
                  servings: recipe.servings,
                  ingredients: recipe.ingredients.length,
                })}
              </Text>
              {recipe.tags.length > 0 ? (
                <Text variant="caption" tone="faint">
                  {recipe.tags.map(tagLabel).join(' · ')}
                </Text>
              ) : null}
            </View>
          </Card>
        </SwipeRow>
      ))}

      <FloatingButton label={t('recipes.add')} onPress={() => setEditor({ mode: 'new' })} />

      <RecipeEditor
        key={editor?.mode === 'edit' ? editor.row.id : (editor?.mode ?? 'closed')}
        editor={editor}
        scope={{ accountId: account.id, householdId }}
        onClose={() => setEditor(null)}
      />
    </Screen>
  );
}

function RecipeEditor({
  editor,
  scope,
  onClose,
}: {
  editor: Editor;
  scope: { accountId: string; householdId: string | null };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const existing = editor?.mode === 'edit' ? editor.row : null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [servings, setServings] = useState<number>(existing?.servings ?? 4);
  const [ingredients, setIngredients] = useState(existing?.ingredients.join('\n') ?? '');
  const [steps, setSteps] = useState(existing?.steps ?? '');
  const [tags, setTags] = useState<string[]>(existing ? [...existing.tags] : []);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(0);

  const lines = ingredients
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  async function save() {
    if (title.trim().length === 0) {
      setError(true);
      return;
    }
    const fields = { title, servings, ingredients: lines, steps, tags };
    if (existing) await recipeRepo.update(existing.id, fields);
    else await recipeRepo.add(scope, fields);
    onClose();
  }

  /** Jede Zutat als Posten auf die Liste — mit Menge, wenn eine davorsteht. */
  async function toShopping() {
    for (const line of lines) {
      const { name, quantity } = splitQuantity(line);
      await shoppingRepo.add({
        accountId: scope.accountId,
        householdId: scope.householdId,
        name,
        quantity,
        category: guessCategory(name),
      });
    }
    setSent(lines.length);
  }

  async function remove() {
    if (existing) await recipeRepo.remove(existing.id);
    onClose();
  }

  return (
    <Sheet
      visible={editor !== null}
      onClose={onClose}
      title={existing ? t('recipes.edit') : t('recipes.add')}
      fullScreen
    >
      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        <Input
          label={t('recipes.title')}
          placeholder={t('recipes.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          autoCapitalize="sentences"
          {...(error ? { error: t('money.error.name') } : {})}
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('recipes.servings')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {SERVINGS.map((count) => (
              <Chip
                key={count}
                label={t('recipes.persons', { count })}
                selected={servings === count}
                onPress={() => setServings(count)}
              />
            ))}
          </View>
        </View>

        <Input
          label={t('recipes.ingredients')}
          placeholder={t('recipes.ingredientsPlaceholder')}
          value={ingredients}
          onChangeText={setIngredients}
          multiline
        />

        {lines.length > 0 ? (
          <Button
            label={
              sent > 0
                ? t('recipes.sent', { count: sent })
                : t('recipes.toShopping', { count: lines.length })
            }
            variant="secondary"
            icon="cart"
            onPress={toShopping}
          />
        ) : null}

        <Input
          label={t('recipes.steps')}
          placeholder={t('recipes.stepsPlaceholder')}
          value={steps}
          onChangeText={setSteps}
          multiline
          autoCapitalize="sentences"
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('recipes.tags')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {TAGS.map((tag) => (
              <Chip
                key={tag}
                label={t(`recipes.tag.${tag}` as TranslationKey)}
                selected={tags.includes(tag)}
                onPress={() =>
                  setTags((current) =>
                    current.includes(tag) ? current.filter((v) => v !== tag) : [...current, tag],
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t('common.done')} icon="check" onPress={save} />
          {existing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.remove')}
              onPress={remove}
              style={[
                styles.removeRow,
                { gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
              ]}
            >
              <Icon name="trash" size={18} color={theme.colors.danger} />
              <Text variant="label" tone="danger">
                {t('common.remove')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
