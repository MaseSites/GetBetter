import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { notifications as notificationRepo, useLiveQuery } from '@/db';
import { useTranslate } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Icon, SectionHead, Text } from '@/ui';

import { NotificationItem } from './NotificationItem';

/** Mehr passt auf die Startseite nicht, ohne dass sie zur Glocke wird. */
const NEWS_LIMIT = 5;

/**
 * „Was gibt's Neues“ auf der Startseite: was noch ungelesen ist, als Karten zum
 * direkt Beantworten. Gelesenes verschwindet von hier und bleibt in der Glocke.
 */
export function NewsSection() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const unread = useLiveQuery(() => notificationRepo.unread(account.id), [account.id]);
  const rows = unread.data ?? [];
  const shown = rows.slice(0, NEWS_LIMIT);
  const hidden = rows.length - shown.length;

  const openInbox = () => router.push('/notifications');

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionHead
        title={t('news.title')}
        count={rows.length > 0 ? String(rows.length) : undefined}
        onPress={openInbox}
      />

      {/* Erst wenn geladen ist — sonst blitzt „Keine Neuigkeiten“ kurz auf. */}
      {unread.data && rows.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('news.empty')}
        </Text>
      ) : null}

      {shown.map((row) => (
        <NotificationItem key={row.id} notification={row} place="news" />
      ))}

      {hidden > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('news.more', { count: hidden })}
          onPress={openInbox}
          hitSlop={theme.spacing.sm}
          style={({ pressed }) => [
            styles.more,
            {
              gap: theme.spacing.xs,
              paddingVertical: theme.spacing.xs,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text variant="label" tone="muted" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t('news.more', { count: hidden })}
          </Text>
          <Icon name="forward" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  more: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
