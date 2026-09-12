import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLiveQuery, type ShoppingItemRow } from '@/db';
import { shopping as shoppingRepo } from '@/db/repositories';
import { useTranslate, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  AddBar,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Header,
  Icon,
  Loading,
  Screen,
  SwipeRow,
  Text,
} from '@/ui';

import {
  SHOPPING_CATEGORIES,
  guessCategory,
  isShoppingCategory,
  splitQuantity,
  type ShoppingCategory,
} from './categories';

/** Die Abteilung einer Zeile — gespeichert oder geraten. */
function categoryOf(item: ShoppingItemRow): ShoppingCategory {
  return isShoppingCategory(item.category) ? item.category : guessCategory(item.name);
}

/**
 * Die Einkaufsliste wie im Laden sortiert: Abteilung fuer Abteilung, damit man
 * nicht dreimal zurueck muss. Die Abteilung raet die App aus dem Namen; wer
 * will, waehlt sie vor dem Eintragen selbst.
 */
export function ShoppingView({ module }: { module: ModuleDefinition }) {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;

  const [draft, setDraft] = useState('');
  const [chosen, setChosen] = useState<ShoppingCategory | null>(null);
  const list = useLiveQuery(
    () => shoppingRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const items = list.data ?? [];
  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);

  const sections = SHOPPING_CATEGORIES.map((category) => ({
    category,
    rows: open.filter((item) => categoryOf(item) === category),
  })).filter((section) => section.rows.length > 0);

  const label = (category: ShoppingCategory) =>
    t(`shopping.category.${category}` as TranslationKey);

  async function add() {
    const { name, quantity } = splitQuantity(draft);
    if (name.length === 0) return;
    setDraft('');
    await shoppingRepo.add({
      accountId: account.id,
      householdId,
      name,
      quantity,
      category: chosen ?? guessCategory(name),
    });
  }

  /**
   * Eine Zeile der Liste: nach links wischen loescht, der Papierkorb bleibt.
   * Die Zeile hat den Kartengrund, damit die rote Flaeche erst beim Wischen erscheint.
   */
  function row(item: ShoppingItemRow) {
    return (
      <SwipeRow onDelete={() => void shoppingRepo.remove(item.id)}>
        <View
          style={[
            styles.row,
            {
              paddingVertical: theme.spacing.md,
              gap: theme.spacing.md,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
            accessibilityLabel={item.name}
            onPress={() => void shoppingRepo.setDone(item.id, !item.done)}
            hitSlop={8}
          >
            <Icon
              name={item.done ? 'checkCircle' : 'circle'}
              size={24}
              color={item.done ? theme.colors.accent : theme.colors.borderStrong}
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              variant="body"
              tone={item.done ? 'faint' : 'default'}
              style={item.done ? { textDecorationLine: 'line-through' } : undefined}
            >
              {item.name}
            </Text>
          </View>
          {item.quantity ? (
            <Text variant="label" tone="muted">
              {item.quantity}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('shopping.remove')}: ${item.name}`}
            onPress={() => void shoppingRepo.remove(item.id)}
            hitSlop={8}
          >
            <Icon name="trash" size={18} color={theme.colors.textFaint} />
          </Pressable>
        </View>
      </SwipeRow>
    );
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            household
              ? `${household.name} · ${t('shopping.openCount', { count: open.length })}`
              : t('shopping.openCount', { count: open.length })
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {/* Die Abteilung vorwaehlen — sonst raet die App. */}
          <View style={[styles.chips, { gap: theme.spacing.xs }]}>
            <Chip
              label={t('shopping.category.auto')}
              selected={chosen === null}
              onPress={() => setChosen(null)}
            />
            {SHOPPING_CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={label(category)}
                selected={chosen === category}
                onPress={() => setChosen(category)}
              />
            ))}
          </View>
          <AddBar
            value={draft}
            onChangeText={setDraft}
            onSubmit={() => void add()}
            placeholder={t('shopping.placeholder')}
            addLabel={t('shopping.add')}
          />
        </View>
      }
    >
      {list.loading && items.length === 0 ? <Loading /> : null}

      {!list.loading && items.length === 0 ? (
        <EmptyState title={t('shopping.empty.title')} body={t('shopping.empty.body')} />
      ) : null}

      {sections.map((section) => (
        <View key={section.category} style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {label(section.category)}
          </Text>
          <Card padded={false} style={{ paddingHorizontal: theme.spacing.lg }}>
            {section.rows.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                {row(item)}
              </View>
            ))}
          </Card>
        </View>
      ))}

      {done.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('shopping.doneSection', { count: done.length })}
          </Text>
          <Card padded={false} style={{ paddingHorizontal: theme.spacing.lg }}>
            {done.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                {row(item)}
              </View>
            ))}
          </Card>
          <Button
            label={t('shopping.clearDone', { count: done.length })}
            variant="secondary"
            icon="trash"
            onPress={() => void shoppingRepo.clearDone(account.id, householdId)}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
