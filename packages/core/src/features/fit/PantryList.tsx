import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PantryItem } from '@/db/fit';
import type { PantryChange } from '@/db/fitKitchen';
import { formatShortDate, useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Icon, IconButton, Input, Sheet, Text } from '@/ui';

import { shortFoodName } from './foodLabel';
import { ExpiryPicker } from './ExpiryPicker';
import { Block, Hairline, Pill, RoundIcon, Sec } from './KitchenKit';
import { daysBetween, expiryOf, splitPantry, stepOf } from './kitchenLogic';
import { parseDecimal } from './setupForm';

type Props = {
  items: readonly PantryItem[];
  today: string;
  busy: boolean;
  onPropose: (change: PantryChange) => Promise<string | null>;
};

/**
 * Der Vorrat: oben, was bald ablaeuft (nach Datum, Abgelaufenes rot und in
 * Worten), darunter der Rest. Die Menge aendert sich direkt in der Zeile, in
 * ihrer Einheit; gespeichert wird sie als Vorschlag.
 */
export function PantryList({ items, today, busy, onPropose }: Props) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const { soon, rest } = splitPantry(items, today);

  async function saveDraft(item: PantryItem) {
    const amount = drafts[item.id];
    if (amount === undefined) return;
    const problem = await onPropose({ id: item.id, amount, unit: item.unit ?? 'g' });
    if (!problem)
      setDrafts((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== item.id)),
      );
  }

  const rows = (list: readonly PantryItem[]) => (
    <Block flush>
      {list.map((item, index) => (
        <View key={item.id}>
          {index > 0 ? <Hairline /> : null}
          <PantryRow
            item={item}
            today={today}
            draft={drafts[item.id]}
            busy={busy}
            onDraft={(amount) => setDrafts((current) => ({ ...current, [item.id]: amount }))}
            onSave={() => void saveDraft(item)}
            onEdit={() => setEditing(item)}
            onRemove={() => void onPropose({ id: item.id, remove: true })}
          />
        </View>
      ))}
    </Block>
  );

  return (
    <View>
      {soon.length > 0 ? (
        <>
          <Sec title={t('fit.pantry.soonTitle')} more={String(soon.length)} />
          {rows(soon)}
        </>
      ) : null}
      {rest.length > 0 ? (
        <>
          <Sec title={t('fit.pantry.allTitle')} more={String(rest.length)} />
          {rows(rest)}
        </>
      ) : null}
      {editing ? (
        <PantryEditSheet
          item={editing}
          today={today}
          onClose={() => setEditing(null)}
          onPropose={async (change) => {
            const problem = await onPropose(change);
            if (!problem) setEditing(null);
            return problem;
          }}
        />
      ) : null}
    </View>
  );
}

function PantryRow({
  item,
  today,
  draft,
  busy,
  onDraft,
  onSave,
  onEdit,
  onRemove,
}: {
  item: PantryItem;
  today: string;
  draft: number | undefined;
  busy: boolean;
  onDraft: (amount: number) => void;
  onSave: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const number = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 });
  const unit = item.unit ?? 'g';
  const amount = draft ?? item.amount;
  const step = stepOf(unit);
  const expiry = expiryOf(item.bestBefore, today);
  const unitLabel = t(`fit.unit.${unit}` as TranslationKey);

  let when: string | null = null;
  if (item.bestBefore) {
    const left = daysBetween(today, item.bestBefore);
    const date = formatShortDate(language, `${item.bestBefore}T12:00:00`);
    when =
      left < 0
        ? t('fit.pantry.expired', { date })
        : left === 0
          ? t('fit.pantry.expiresToday')
          : left === 1
            ? t('fit.pantry.expiresTomorrow')
            : expiry === 'soon'
              ? t('fit.pantry.expiresIn', { count: left })
              : t('fit.pantry.bestBefore', { date });
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('fit.pantry.edit', { name: item.name })}
        onPress={onEdit}
        style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed ? 0.6 : 1 })}
      >
        <Text variant="body" style={{ fontWeight: theme.fontWeight.semibold }}>
          {shortFoodName(item.name)}
        </Text>
        {when ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            {expiry ? (
              <Icon
                name={expiry === 'expired' ? 'warning' : 'clock'}
                size={theme.fontSize.caption}
                color={theme.colors.danger}
              />
            ) : null}
            <Text
              variant="label"
              tone={expiry ? 'danger' : 'muted'}
              style={expiry ? { fontWeight: theme.fontWeight.semibold } : null}
            >
              {when}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {amount === null ? (
        <Text variant="label" tone="muted">
          {t('fit.pantry.amountOpen')}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Pill
            label={t('fit.stepper.minus')}
            accessibilityLabel={t('fit.pantry.less', { name: item.name })}
            tone="soft"
            size="sm"
            disabled={busy || amount - step <= 0}
            onPress={() => onDraft(Math.round((amount - step) * 10) / 10)}
          />
          <Text
            variant="label"
            style={[
              numeric,
              {
                minWidth: theme.spacing.xxl * 1.5,
                textAlign: 'center',
                fontWeight: theme.fontWeight.semibold,
              },
            ]}
          >
            {`${number.format(amount)} ${unitLabel}`}
          </Text>
          <Pill
            label={t('fit.stepper.plus')}
            accessibilityLabel={t('fit.pantry.more', { name: item.name })}
            tone="soft"
            size="sm"
            disabled={busy}
            onPress={() => onDraft(Math.round((amount + step) * 10) / 10)}
          />
        </View>
      )}
      {draft !== undefined && draft !== item.amount ? (
        <RoundIcon
          icon="check"
          label={t('fit.pantry.saveAmount', { name: item.name })}
          onPress={onSave}
          tone="ink"
        />
      ) : (
        <IconButton
          icon="trash"
          label={t('fit.pantry.remove', { name: item.name })}
          onPress={onRemove}
          tone="faint"
        />
      )}
    </View>
  );
}

/** Menge und Ablaufdatum einer Zeile — ein Vorschlag, bestaetigt wird in der Karte darueber. */
function PantryEditSheet({
  item,
  today,
  onClose,
  onPropose,
}: {
  item: PantryItem;
  today: string;
  onClose: () => void;
  onPropose: (change: PantryChange) => Promise<string | null>;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [amount, setAmount] = useState(item.amount === null ? '' : String(item.amount));
  const [bestBefore, setBestBefore] = useState<string | null>(item.bestBefore);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unit = item.unit ?? 'g';

  async function submit() {
    const value = amount.trim() === '' ? null : parseDecimal(amount);
    if (value !== null && value <= 0) {
      setProblem(t('fit.shop.amountInvalid'));
      return;
    }
    if (amount.trim() !== '' && value === null) {
      setProblem(t('fit.shop.amountInvalid'));
      return;
    }
    setBusy(true);
    setProblem(null);
    const failed = await onPropose({
      id: item.id,
      amount: value,
      unit: value === null ? null : unit,
      bestBefore,
    });
    setBusy(false);
    if (failed) setProblem(failed);
  }

  return (
    <Sheet visible onClose={onClose} title={shortFoodName(item.name)}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={`${t('fit.pantry.amountLabel')} (${t(`fit.unit.${unit}` as TranslationKey)})`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder={t('fit.pantry.amountOpen')}
        />
        <ExpiryPicker value={bestBefore} onChange={setBestBefore} today={today} />
        {problem ? (
          <Text variant="label" tone="danger">
            {problem}
          </Text>
        ) : null}
        <Pill
          label={t('fit.pantry.proposeChange')}
          icon="check"
          fullWidth
          onPress={() => void submit()}
          loading={busy}
          disabled={busy}
        />
      </View>
    </Sheet>
  );
}
