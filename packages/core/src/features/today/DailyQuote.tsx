import { View } from 'react-native';

import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

/** So viele Sprueche stehen in `i18n/de.ts` (`quote.1` bis `quote.40`). */
export const QUOTE_COUNT = 40;

/** Jeder Tag des Jahres nimmt den naechsten Spruch — morgen steht ein anderer da. */
export function quoteIndex(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return (day % QUOTE_COUNT) + 1;
}

/**
 * Der Satz fuer heute, direkt unter der Begruessung. Keine Karte, kein
 * Zitatzeichen, keine Farbe: er soll Lust auf den Tag machen, nicht mit dem
 * Tagesband um Aufmerksamkeit ringen.
 */
export function DailyQuote({ date = new Date() }: { date?: Date }) {
  const { t } = useI18n();
  const theme = useTheme();
  const quote = t(`quote.${quoteIndex(date)}` as TranslationKey);

  return (
    <View
      accessible
      accessibilityLabel={`${t('today.quote.label')}: ${quote}`}
      style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md, maxWidth: 320 }}
    >
      <Text variant="overline" tone="faint">
        {t('today.quote.label')}
      </Text>
      {/* Klein und ruhig: der Spruch ist nie groesser als das, was heute ansteht. */}
      <Text variant="body" style={{ fontWeight: theme.fontWeight.medium }}>
        {quote}
      </Text>
    </View>
  );
}
