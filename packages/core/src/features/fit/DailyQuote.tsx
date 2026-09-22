import { View } from 'react-native';

import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { quoteNumberOf } from './quoteOfDay';

/**
 * Der Spruch des Tages: ein Satz in der Displayschrift, ohne Karte, ohne
 * Symbol — er steht zwischen Titel und erstem Block und nimmt der grossen
 * Zahl darunter nichts weg. Jeden Tag ein anderer (Zürcher Tag).
 */
/** Luft zwischen den Buchstaben: -.01em, wie im Entwurf. */
const TRACKING_EM = -0.01;

export function DailyQuote({
  day,
  bare = false,
}: {
  day: string;
  /** Ohne eigenen Rand — der Bildschirm setzt die Abstaende selbst (Ernaehrung). */
  bare?: boolean;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const text = t(`fit.quote.${quoteNumberOf(day)}` as TranslationKey);
  const quoted = t('fit.quote.wrap', { text });

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${t('fit.quote.label')}: ${text}`}
      style={
        bare
          ? null
          : {
              paddingHorizontal: theme.spacing.xs,
              paddingTop: theme.spacing.xs,
              paddingBottom: theme.spacing.md,
            }
      }
    >
      <Text
        variant="title"
        tone="muted"
        style={{
          fontSize: theme.fontSize.lg,
          lineHeight: theme.lineHeight.lg,
          fontWeight: theme.fontWeight.semibold,
          letterSpacing: theme.fontSize.lg * TRACKING_EM,
        }}
      >
        {quoted}
      </Text>
    </View>
  );
}
