import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { chatMessages as messageRepo, chats as chatRepo, dayKey, useLiveQuery } from '@/db';
import { relativeDay } from '@/features/shared/days';
import { useI18n } from '@/i18n';
import { AI_CHAT_CANNED_REPLY, AI_CHAT_STARTERS } from '@/mocks/aiChat';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Card, Chip, EmptyState, FloatingButton, Header, Screen, Text } from '@/ui';

/**
 * Die Startseite von BetterAi: die Gespraeche, das Neueste zuerst — wie in
 * jeder Chat-App. Ein Tipp oeffnet eines, der Knopf unten faengt ein neues an.
 */
export function ChatsView() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const list = useLiveQuery(() => chatRepo.list(account.id), [account.id]);
  const latest = useLiveQuery(() => messageRepo.latest(account.id), [account.id]);
  const rows = list.data ?? [];
  const previews = latest.data ?? new Map();

  async function startChat(firstMessage?: string) {
    const created = await chatRepo.create(account.id);
    if (firstMessage) {
      await messageRepo.add({
        chatId: created.id,
        accountId: account.id,
        role: 'user',
        text: firstMessage,
      });
      // Die Antwort gleich dazu — im Gespraech soll niemand auf sie warten muessen.
      await messageRepo.add({
        chatId: created.id,
        accountId: account.id,
        role: 'assistant',
        text: AI_CHAT_CANNED_REPLY,
      });
    }
    router.push(`/chat/${created.id}`);
  }

  return (
    <Screen
      header={
        <Header
          large
          title={t('chats.title')}
          subtitle={t(rows.length === 1 ? 'chats.count.one' : 'chats.count', {
            count: rows.length,
          })}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon="sparkles" title={t('chats.empty.title')} body={t('chats.empty.body')} />
      ) : null}

      {/* Die Anfaenge: ein Tipp legt ein Gespraech mit dieser Frage an. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.lg }}
      >
        {AI_CHAT_STARTERS.map((starter) => (
          <Chip key={starter} label={starter} onPress={() => void startChat(starter)} />
        ))}
      </ScrollView>

      {rows.map((chat) => {
        const preview = previews.get(chat.id);
        return (
          <Card
            key={chat.id}
            onPress={() => router.push(`/chat/${chat.id}`)}
            accessibilityLabel={chat.title || t('chats.untitled')}
          >
            <View style={{ gap: theme.spacing.xs }}>
              <Text variant="title" numberOfLines={1}>
                {chat.title || t('chats.untitled')}
              </Text>
              {preview ? (
                <Text variant="label" tone="muted" numberOfLines={2}>
                  {preview.text}
                </Text>
              ) : null}
              <Text variant="caption" tone="faint">
                {relativeDay(t, language, dayKey(new Date(chat.updatedAt)))}
              </Text>
            </View>
          </Card>
        );
      })}

      <FloatingButton label={t('chats.new')} onPress={() => void startChat()} />
    </Screen>
  );
}
