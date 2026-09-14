import { View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

/**
 * Die schmale Leiste oben, wenn der Admin eine App nur ansieht: wessen Konto
 * es ist und dass nichts geaendert wird. Auf `inverse` steht nur `onInverse`.
 */
export function ViewBanner({ username }: { username: string | null }) {
  const t = useTranslate();
  const theme = useTheme();

  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: theme.colors.inverse,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <Text
        variant="caption"
        numberOfLines={1}
        style={{ color: theme.colors.onInverse, textAlign: 'center' }}
      >
        {username ? t('view.banner', { username }) : t('view.bannerAnon')}
      </Text>
    </View>
  );
}
