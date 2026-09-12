import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { notifications as notificationRepo, useLiveQuery, type NotificationRow } from '@/db';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { EmptyState, Header, Loading, Screen, SectionHead, Text } from '@/ui';

import { NotificationItem } from './NotificationItem';

/**
 * Die Glocke: alle Mitteilungen, Neue zuerst. Hier heisst gelesen „weg“ —
 * wer eine Mitteilung noch braucht, laesst sie stehen.
 */
export function NotificationsScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { account } = useApp();

  const [clearing, setClearing] = useState(false);
  const [failed, setFailed] = useState(false);

  const list = useLiveQuery(
    () => (account ? notificationRepo.list(account.id) : Promise.resolve([])),
    [account?.id],
  );
  const rows = list.data ?? [];
  const fresh = rows.filter((row) => !row.readAt);
  const earlier = rows.filter((row) => Boolean(row.readAt));

  // Beim Abmelden steht dieser Bildschirm kurz ohne Konto da.
  if (!account) return null;
  const accountId = account.id;

  async function clearAll() {
    if (clearing) return;
    setClearing(true);
    setFailed(false);
    const result = await notificationRepo.removeAll(accountId);
    setClearing(false);
    setFailed(!result.ok);
  }

  function group(title: string, items: readonly NotificationRow[]) {
    if (items.length === 0) return null;
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <SectionHead title={title} count={String(items.length)} />
        {items.map((row) => (
          <NotificationItem key={row.id} notification={row} place="inbox" />
        ))}
      </View>
    );
  }

  return (
    <Screen
      header={
        <Header
          title={t('news.inbox.title')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={
            rows.length > 0
              ? [
                  {
                    icon: 'trash' as const,
                    label: t('news.inbox.clear'),
                    onPress: () => void clearAll(),
                  },
                ]
              : []
          }
        />
      }
    >
      {failed ? (
        <Text variant="caption" tone="danger">
          {t('news.error.failed')}
        </Text>
      ) : null}

      {list.loading && rows.length === 0 ? <Loading /> : null}

      {!list.loading && rows.length === 0 ? (
        <EmptyState title={t('news.inbox.empty.title')} body={t('news.inbox.empty.body')} />
      ) : null}

      {group(t('news.inbox.new'), fresh)}
      {group(t('news.inbox.earlier'), earlier)}
    </Screen>
  );
}
