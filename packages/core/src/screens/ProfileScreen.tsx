import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appUrl } from '@/app/bridge';
import { APP_IDS, APPS, APPS_WITH_HOUSEHOLD, currentApp, type AppId } from '@/app/identity';
import { notifications as notificationRepo, useLiveQuery } from '@/db';
import { appAccess } from '@/db/appAccess';
import { SettingsGroup, SettingsList, SettingsRow } from '@/features/personalize/SettingsList';
import { AccountPhoto } from '@/features/profile/AccountPhoto';
import { ProfileSheets, type ProfileSheet } from '@/features/profile/ProfileSheets';
import { usernameFreeAt } from '@/features/profile/usernameCooldown';
import { formatDayMonth, formatMonth, formatNumber, useI18n } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { AppIcon, Badge, Icon, Screen, Text } from '@/ui';

/** Das Bild oben — gross genug, dass es das Profil traegt. */
const PHOTO = 96;
/** Der kleine Kreis mit der Kamera, unten rechts am Bild. */
const EDIT_BADGE = 30;

/**
 * Das Profil, wie man es aus anderen Apps kennt: oben gross das Bild — ein
 * Tipp darauf aendert es —, Spitzname, `@name` und die Abzeichen, die gerade
 * gelten. Darunter, was man an sich selbst aendert (Bild, Spitzname,
 * Benutzername), die Better-Apps, in denen man schon war, und die Wege nach
 * innen. Keine Zahlen, kein Aussehen, kein Abo — das steht in den Einstellungen.
 */
export function ProfileScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const router = useRouter();
  const { household } = useApp();
  const [sheet, setSheet] = useState<ProfileSheet | null>(null);

  const app = currentApp();
  const unread = useLiveQuery(() => notificationRepo.unread(account.id), [account.id]);
  const seen = useLiveQuery(() => appAccess.appsOf(account.id), [account.id]);
  const waiting = unread.data?.length ?? 0;

  const name = account.firstName || t('profile.noName');
  const handle = account.username ? `@${account.username}` : account.email;
  const since = t('profile.since', { date: formatMonth(language, new Date(account.createdAt)) });
  const freeAt = usernameFreeAt(account.usernameChangedAt);
  // Die laufende App gehoert immer dazu, dann die anderen in ihrer festen Reihenfolge.
  const mine: AppId[] = APP_IDS.filter(
    (id) => id === app.id || (seen.data ?? []).includes(id),
  );

  return (
    <Screen gap={theme.spacing.lg}>
      <View style={[styles.center, { gap: theme.spacing.md, paddingTop: insets.top + theme.spacing.lg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.photo.change')}
          onPress={() => setSheet('photo')}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <AccountPhoto size={PHOTO} />
          <View
            style={[
              styles.editBadge,
              {
                backgroundColor: theme.colors.inverse,
                borderColor: theme.colors.background,
              },
            ]}
          >
            <Icon name="camera" size={15} color={theme.colors.onInverse} />
          </View>
        </Pressable>

        <View style={[styles.center, { gap: theme.spacing.xs }]}>
          <Text
            variant="display"
            numberOfLines={1}
            style={[styles.text, { fontSize: theme.fontSize.xl - 2, lineHeight: theme.lineHeight.xl - 4 }]}
          >
            {name}
          </Text>
          <Text variant="label" tone="muted" numberOfLines={1} style={styles.text}>
            {handle}
          </Text>
        </View>

        <View style={[styles.marks, { gap: theme.spacing.xs }]}>
          <Badge icon="calendar" label={since} />
          {household ? <Badge icon="home" label={household.name} /> : null}
        </View>
      </View>

      <SettingsGroup
        title={t('profile.section')}
        hint={
          freeAt
            ? t('settings.username.locked', { date: formatDayMonth(language, freeAt) })
            : t('profile.username.monthly')
        }
      >
        <SettingsList>
          <SettingsRow
            first
            icon="image"
            label={t('profile.photo')}
            value={account.photoUploadId ? t('profile.photo.own') : t('profile.photo.none')}
            chevron
            onPress={() => setSheet('photo')}
          />
          <SettingsRow
            icon="person"
            label={t('settings.nickname')}
            value={account.firstName || t('settings.nickname.none')}
            chevron
            onPress={() => setSheet('nickname')}
          />
          <SettingsRow
            icon="at"
            label={t('settings.username')}
            value={`@${account.username}`}
            chevron
            onPress={() => setSheet('username')}
          />
          <SettingsRow icon="mail" label={t('settings.email')} value={account.email} />
        </SettingsList>
      </SettingsGroup>

      <SettingsGroup
        title={t('profile.apps')}
        hint={t('profile.apps.hint', { count: mine.length, total: APP_IDS.length })}
      >
        <SettingsList>
          {mine.map((id, index) => (
            <SettingsRow
              key={id}
              first={index === 0}
              leading={<AppIcon appId={id} size="sm" />}
              label={APPS[id].name}
              {...(id === app.id
                ? { value: t('profile.apps.here') }
                : { chevron: true, onPress: () => void Linking.openURL(appUrl(id)) })}
            />
          ))}
        </SettingsList>
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

      <ProfileSheets open={sheet} onClose={() => setSheet(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  text: { textAlign: 'center' },
  marks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: EDIT_BADGE,
    height: EDIT_BADGE,
    borderRadius: EDIT_BADGE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
