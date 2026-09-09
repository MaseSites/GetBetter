import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { currentApp } from '@/app/identity';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { AppIcon, Button, Screen, Text } from '@/ui';

export function StartScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const app = currentApp();

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
        <AppIcon appId={app.id} size="xl" />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="display" align="center">
            {app.name}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {t(app.taglineKey as TranslationKey)}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center' },
});
