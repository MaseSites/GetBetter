import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APPS_WITH_HOUSEHOLD, currentApp } from '@/app/identity';
import { notifications as notificationRepo, useLiveQuery } from '@/db';
import { SettingsGroup, SettingsList, SettingsRow } from '@/features/personalize/SettingsList';
import { ProfileStats } from '@/features/profile/ProfileStats';
import { formatMonth, formatNumber, useI18n } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Avatar, Badge, Screen, Text } from '@/ui';

/**
 * Das Profil: oben wer du bist — Bild, Spitzname, `@name` und die Abzeichen,
 * die gerade gelten. Darunter der Ueberblick in Zahlen und die Wege nach innen.
 *
 * Geaendert wird nichts davon hier: das Aussehen und alles andere steht in den
 * Einstellungen, damit es nur eine Stelle dafuer gibt.
 */
export function ProfileScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const router = useRouter();
  const { household } = useApp();

  const app = currentApp();
  const unread = useLiveQuery(() => notificationRepo.unread(account.id), [account.id]);
  const waiting = unread.data?.length ?? 0;

  const handle = account.username ? `@${account.username}` : account.email;
  const since = t('profile.since', { date: formatMonth(language, new Date(account.createdAt)) });

  return (
    <Screen gap={theme.spacing.lg}>
      <View style={{ gap: theme.spacing.md, paddingTop: insets.top + theme.spacing.lg }}>
        <View style={[styles.me, { gap: theme.spacing.md }]}>
          <Avatar name={account.firstName || account.email} size={64} />
          <View style={styles.grow}>
            <Text
              variant="display"
              numberOfLines={1}
              style={{ fontSize: theme.fontSize.xl - 2, lineHeight: theme.lineHeight.xl - 4 }}
            >
              {account.firstName || t('profile.noName')}
            </Text>
            <Text variant="label" tone="muted" numberOfLines={1}>
              {handle}
            </Text>
          </View>
        </View>

        <View style={[styles.marks, { gap: theme.spacing.xs }]}>
          <Badge icon="calendar" label={since} />
          {household ? <Badge icon="home" label={household.name} /> : null}
        </View>
      </View>

      <SettingsGroup title={t('profile.stats')}>
        <ProfileStats />
      </SettingsGroup>

      <SettingsGroup title={t('profile.more')}>
        <SettingsList>
          <SettingsRow
            first
            icon="settings"
            label={t('settings.title')}
            chevron
            onPress={() => router.push('/settings')}
          />
          {app.id === 'getbetter' ? (
            <SettingsRow
              icon="bell"
              label={t('profile.settings.notifications')}
              value={waiting > 0 ? formatNumber(language, waiting) : undefined}
              chevron
              onPress={() => router.push('/notifications')}
            />
          ) : null}
          {APPS_WITH_HOUSEHOLD.includes(app.id) ? (
            <SettingsRow
              icon="home"
              label={t('profile.household')}
              value={household ? household.name : undefined}
              chevron
              onPress={() => router.push('/household')}
            />
          ) : null}
        </SettingsList>
      </SettingsGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  marks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
