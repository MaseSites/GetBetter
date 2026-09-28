import { View } from 'react-native';

import { formatMoney, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { IconButton, ProgressBar, Text, type TextTone } from '@/ui';

import { budgetPace } from './pace';

export { ProgressBar };

/** Der Papierkorb rechts in einer Zeile, die selbst nicht drueckbar ist. */
export function RemoveButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return <IconButton icon="trash" label={t('common.remove')} onPress={onPress} />;
}

/** Betrag und, wenn gewuenscht, der Papierkorb daneben. */
export function AmountCell({ amount, onRemove }: { amount: string; onRemove?: () => void }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Text variant="label" tone="muted">
        {amount}
      </Text>
      {onRemove ? <RemoveButton onPress={onRemove} /> : null}
    </View>
  );
}

/**
 * Das Budget-Tempo als eine Zeile: „Noch CHF 23 pro Tag“, „CHF 40 über dem
 * Plan · noch CHF 26 pro Tag“ oder „CHF 50 über dem Budget“. Ohne Budget null.
 */
export function usePaceLine(
  spent: number,
  limit: number | null,
): { text: string; tone: TextTone; over: boolean } | null {
  const { t, language } = useI18n();
  const pace = budgetPace({ spent, limit });
  if (!pace) return null;
  const money = (value: number) => formatMoney(language, value);
  if (pace.status === 'over') {
    return {
      text: t('moneyplus.pace.over', { amount: money(pace.overBy) }),
      tone: 'danger',
      over: true,
    };
  }
  if (pace.status === 'ahead') {
    return {
      text: t('moneyplus.pace.ahead', {
        amount: money(pace.overBy),
        perDay: money(pace.perDayLeft),
      }),
      tone: 'danger',
      over: false,
    };
  }
  return {
    text: t('moneyplus.pace.perDay', { amount: money(pace.perDayLeft) }),
    tone: 'muted',
    over: false,
  };
}
