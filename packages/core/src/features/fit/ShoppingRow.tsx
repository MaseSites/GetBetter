import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { ShoppingItem } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { IconButton, Input, Text } from '@/ui';

import { shortFoodName } from './foodLabel';
import { RoundCheck } from './KitchenMedia';
import { parseDecimal } from './setupForm';

/**
 * Speichert eine Eingabe genau einmal, auch wenn „Fertig“ und das Verlassen des
 * Feldes beide melden. Eine kleine Klasse statt eines Refs (React-Compiler).
 */
class OnceGuard {
  private active = false;

  start(): boolean {
    if (this.active) return false;
    this.active = true;
    return true;
  }

  end(): void {
    this.active = false;
  }
}

/**
 * Ein Posten: Haken, Name mit Hinweisen, Menge (antippen zum Aendern) und bei
 * Handposten der Papierkorb. Kein Knopf im Knopf — jedes Element fuer sich.
 */
export function ShoppingRow({
  item,
  onToggle,
  onAmount,
  onRemove,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  /** Gibt einen Fehlertext zurueck, oder null. */
  onAmount: (amount: number) => Promise<string | null>;
  onRemove: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const number = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 });
  const plain = new Intl.NumberFormat(`${language}-CH`, {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [guard] = useState(() => new OnceGuard());
  const amountText = `${number.format(item.amount)} ${t(`fit.unit.${item.unit}` as TranslationKey)}`;

  async function commit() {
    if (editing === null || !guard.start()) return;
    const amount = parseDecimal(editing);
    if (amount === null || amount <= 0) {
      setProblem(t('fit.shop.amountInvalid'));
      guard.end();
      return;
    }
    if (amount === item.amount) {
      setEditing(null);
      guard.end();
      return;
    }
    const failed = await onAmount(amount);
    guard.end();
    if (failed) setProblem(failed);
    else {
      setProblem(null);
      setEditing(null);
    }
  }

  const hints = [
    item.basic ? t('fit.shop.basic') : null,
    item.pantryCheck ? t('fit.shop.checkPantry') : null,
    item.substituted ? t('fit.shop.substitute') : null,
    item.manual ? t('fit.shop.manual') : null,
  ].filter(Boolean);

  return (
    <View style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.done }}
          aria-checked={item.done}
          accessibilityLabel={item.name}
          onPress={onToggle}
          hitSlop={theme.spacing.sm}
        >
          <RoundCheck checked={item.done} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            variant="body"
            tone={item.done ? 'muted' : 'default'}
            style={[
              { fontWeight: theme.fontWeight.semibold },
              item.done ? { textDecorationLine: 'line-through' } : null,
            ]}
          >
            {shortFoodName(item.name)}
          </Text>
          {hints.length > 0 || item.recipes.length > 0 ? (
            <Text variant="label" tone="muted">
              {hints.join(' · ') || item.recipes.join(', ')}
            </Text>
          ) : null}
        </View>
        {editing !== null ? (
          <View style={{ width: theme.spacing.xxl * 3 }}>
            <Input
              value={editing}
              onChangeText={(value) => {
                setEditing(value);
                setProblem(null);
              }}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={() => void commit()}
              onBlur={() => void commit()}
              accessibilityLabel={t('fit.shop.editAmount', { name: item.name })}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('fit.shop.editAmount', { name: item.name })}
            onPress={() => setEditing(plain.format(item.amount))}
            hitSlop={theme.spacing.sm}
          >
            <Text
              variant="label"
              tone={item.done ? 'muted' : 'default'}
              style={[numeric, { fontWeight: theme.fontWeight.semibold }]}
            >
              {amountText}
            </Text>
          </Pressable>
        )}
        {item.manual ? (
          <IconButton
            icon="trash"
            label={t('fit.shop.remove', { name: item.name })}
            onPress={onRemove}
            tone="faint"
          />
        ) : null}
      </View>
      {problem ? (
        <Text variant="caption" tone="danger">
          {problem}
        </Text>
      ) : null}
    </View>
  );
}
