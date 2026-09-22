import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { fit, type FitAction, type ShoppingItem } from '@/db/fit';
import { SHOPPING_CATEGORIES } from '@/features/shopping/categories';
import { useI18n, type TranslationKey } from '@/i18n';
import { useScope } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Checkbox, EmptyState, Icon, Input, Text, useUndo } from '@/ui';

import { ActionCard } from './ActionCard';
import { sendToFamilyList } from './familyShopping';
import { FitState } from './FitGate';
import { kitchenError } from './kitchenErrors';
import { Block, Hairline, Pill, RoundIcon, Sec } from './KitchenKit';
import { parseManualItem } from './kitchenLogic';
import { ShoppingRow } from './ShoppingRow';
import { useFit } from './useFit';

const TOGGLE_HEIGHT = 36;

/**
 * Die Einkaufsliste aus dem bestaetigten Plan, sortiert wie im Laden; was im
 * Korb liegt, rutscht zugeklappt nach unten. Abhaken und Mengen aendern gehen
 * direkt; aendert sich der Plan, kommt ein Vorschlag mit dem Unterschied.
 * Eingekauftes sammelt sich und wandert als **ein** Vorschlag in den Vorrat.
 */
export function ShoppingPanel() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const undo = useUndo();
  const current = useFit(() => fit.currentPlan(), [], ['kitchen']);
  const list = useFit(() => fit.shoppingList(), [], ['kitchen']);
  const [action, setAction] = useState<FitAction | null>(null);
  const [toPantry, setToPantry] = useState(false);
  const [collected, setCollected] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const scope = useScope();
  const planId = current.data?.plan?.id ?? null;
  const data = list.data?.list ?? null;
  const number = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 });
  const unitLabel = (unit: string) => t(`fit.unit.${unit}` as TranslationKey);

  async function propose() {
    if (!planId) return;
    setBusy(true);
    setProblem(null);
    const result = await fit.proposeShoppingList(planId);
    setBusy(false);
    if (result.ok) setAction(result.data.action);
    else if (result.error === 'no_changes') {
      // Nichts anders: der Dienst nimmt „veraltet“ weg, die Liste bleibt.
      list.reload();
      current.reload();
      undo.show({ message: t('fit.shop.upToDate') });
    } else setProblem(kitchenError(t, result.error));
  }

  async function toggle(item: ShoppingItem) {
    if (!data) return;
    const result = await fit.editShoppingItem(data.id, item.id, { done: !item.done });
    if (!result.ok) {
      setProblem(kitchenError(t, result.error));
      return;
    }
    setProblem(null);
    if (!toPantry) return;
    setCollected((ids) =>
      item.done
        ? ids.filter((id) => id !== item.id)
        : [...ids.filter((id) => id !== item.id), item.id],
    );
  }

  async function amount(item: ShoppingItem, value: number): Promise<string | null> {
    if (!data) return null;
    const result = await fit.editShoppingItem(data.id, item.id, { amount: value });
    return result.ok ? null : kitchenError(t, result.error);
  }

  /** Alles Gesammelte in einem Vorschlag — bestaetigt wird einmal. */
  async function collectToPantry() {
    if (!data) return;
    const chosen = data.items.filter(
      (item) => collected.includes(item.id) && item.done && item.foodId,
    );
    if (chosen.length === 0) return;
    setBusy(true);
    const result = await fit.proposePantry(
      chosen.map((item) => ({
        foodId: item.foodId as string,
        amount: item.amount,
        unit: item.unit,
      })),
      'shopping',
    );
    setBusy(false);
    if (!result.ok) {
      setProblem(kitchenError(t, result.error));
      return;
    }
    setAction(result.data.action);
    setCollected([]);
  }

  /** Was noch offen ist, auf die gemeinsame Liste in BetterFamily — dort kauft der Haushalt ein. */
  async function toFamily() {
    if (!data || busy) return;
    setBusy(true);
    try {
      const result = await sendToFamilyList(
        scope,
        data.items
          .filter((item) => !item.done)
          .map((item) => ({
            name: item.name,
            amount: item.amount,
            unit: item.unit,
            category: item.shopCategory,
          })),
        {
          quantity: (value, unit) => `${number.format(value)} ${unitLabel(unit)}`,
          unit: unitLabel,
        },
      );
      undo.show({
        message:
          result.added + result.raised === 0
            ? t('fit.family.already')
            : result.raised > 0
              ? t('fit.family.sentRaised', { count: result.added, raised: result.raised })
              : t('fit.family.sent', { count: result.added }),
      });
    } catch {
      setProblem(t('fit.family.error'));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!data || adding.trim().length === 0) return;
    const parsed = parseManualItem(adding);
    if (parsed.name.length === 0) return;
    const result = await fit.addShoppingItem(data.id, parsed);
    if (!result.ok) {
      setProblem(kitchenError(t, result.error));
      return;
    }
    setAdding('');
  }

  const open = (data?.items ?? []).filter((item) => !item.done);
  const done = (data?.items ?? []).filter((item) => item.done);
  const groups = SHOPPING_CATEGORIES.map((category) => ({
    category,
    items: open.filter((item) =>
      (SHOPPING_CATEGORIES as readonly string[]).includes(item.shopCategory)
        ? item.shopCategory === category
        : category === 'other',
    ),
  })).filter((group) => group.items.length > 0);
  const ready = collected.filter((id) => done.some((item) => item.id === id && item.foodId)).length;
  const withoutFood = done
    .filter((item) => collected.includes(item.id) && !item.foodId)
    .map((item) => item.name);
  const rows = (items: readonly ShoppingItem[]) => (
    <Block flush>
      {items.map((item, index) => (
        <View key={item.id}>
          {index > 0 ? <Hairline /> : null}
          <ShoppingRow
            item={item}
            onToggle={() => void toggle(item)}
            onAmount={(value) => amount(item, value)}
            onRemove={() => data && void fit.removeShoppingItem(data.id, item.id)}
          />
        </View>
      ))}
    </Block>
  );

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {action ? (
        <ActionCard
          key={action.id}
          action={action}
          onDone={() => {
            list.reload();
            current.reload();
          }}
        />
      ) : null}
      {problem ? (
        <Text variant="label" tone="danger">
          {problem}
        </Text>
      ) : null}
      <FitState
        loading={list.loading || current.loading}
        error={list.error ?? current.error}
        onRetry={list.reload}
      >
        {!planId ? (
          <EmptyState title={t('fit.shop.noPlanTitle')} body={t('fit.shop.noPlanBody')} />
        ) : !data ? (
          <EmptyState
            title={t('fit.shop.emptyTitle')}
            body={t('fit.shop.emptyBody')}
            actionLabel={t('fit.shop.create')}
            onAction={() => void propose()}
          />
        ) : (
          <>
            {data.stale || current.data?.shoppingListStale ? (
              <Block style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Icon name="refresh" size={theme.fontSize.lede} color={theme.colors.text} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {t('fit.shop.stale')}
                  </Text>
                </View>
                <Pill
                  label={t('fit.shop.update')}
                  onPress={() => void propose()}
                  loading={busy}
                  disabled={busy}
                />
              </Block>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <Pill
                label={t('fit.family.sendList')}
                icon="cart"
                tone="soft"
                size="sm"
                onPress={() => void toFamily()}
                loading={busy}
                disabled={busy || open.length === 0}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: toPantry }}
                aria-checked={toPantry}
                accessibilityLabel={t('fit.shop.toPantry')}
                onPress={() => {
                  setToPantry((value) => !value);
                  setCollected([]);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  minHeight: TOGGLE_HEIGHT,
                  flexShrink: 1,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Checkbox checked={toPantry} />
                <Text variant="label" tone="muted" style={{ flexShrink: 1 }}>
                  {t('fit.shop.toPantry')}
                </Text>
              </Pressable>
            </View>
            {toPantry && ready > 0 ? (
              <Pill
                label={t('fit.shop.collected', { count: ready })}
                icon="check"
                fullWidth
                onPress={() => void collectToPantry()}
                loading={busy}
                disabled={busy}
              />
            ) : null}
            {toPantry && withoutFood.length > 0 ? (
              <Text variant="label" tone="muted">
                {t('fit.shop.noFood', { names: withoutFood.join(', ') })}
              </Text>
            ) : null}
            {groups.map((group) => (
              <View key={group.category}>
                <Sec
                  title={t(`shopping.category.${group.category}` as TranslationKey)}
                  more={String(group.items.length)}
                />
                {rows(group.items)}
              </View>
            ))}
            {open.length === 0 ? (
              <EmptyState
                compact
                title={t('fit.shop.allDoneTitle')}
                body={t('fit.shop.allDoneBody')}
              />
            ) : null}
            {done.length > 0 ? (
              <View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: cartOpen }}
                  accessibilityLabel={t(cartOpen ? 'fit.shop.cartClose' : 'fit.shop.cartOpen')}
                  onPress={() => setCartOpen((value) => !value)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Sec
                    title={t('shopping.doneSection', { count: done.length })}
                    more={
                      <Icon
                        name={cartOpen ? 'down' : 'forward'}
                        size={theme.fontSize.caption}
                        color={theme.colors.textFaint}
                      />
                    }
                  />
                </Pressable>
                {cartOpen ? rows(done) : null}
              </View>
            ) : null}
            {data.covered.length > 0 ? (
              <Text variant="label" tone="muted" style={{ marginTop: theme.spacing.sm }}>
                {t('fit.shop.covered', { list: data.covered.map((item) => item.name).join(', ') })}
              </Text>
            ) : null}
            <Block style={{ marginTop: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t('fit.shop.addLabel')}
                    placeholder={t('fit.shop.addPlaceholder')}
                    value={adding}
                    onChangeText={setAdding}
                    onSubmitEditing={() => void add()}
                    returnKeyType="done"
                  />
                </View>
                <RoundIcon
                  icon="plus"
                  label={t('fit.shop.add')}
                  tone="ink"
                  onPress={() => void add()}
                />
              </View>
            </Block>
          </>
        )}
      </FitState>
    </View>
  );
}
