import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Icon, Screen, Text } from '@/ui';

export default function StartScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen
      scroll={false}
      contentStyle={styles.content}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t('auth.start.signIn')} onPress={() => router.push('/sign-in')} />
          <Button
            label={t('auth.start.createAccount')}
            variant="secondary"
            onPress={() => router.push('/sign-up')}
          />
        </View>
      }
    >
      <View style={[styles.hero, { gap: theme.spacing.lg }]}>
        <View
          style={[
            styles.mark,
            { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radii.xl },
          ]}
        >
          <Icon name="sparkles" size={32} color={theme.colors.accentStrong} />
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="display" align="center">
            {t('app.name')}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {t('app.tagline')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center' },
  mark: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
});
