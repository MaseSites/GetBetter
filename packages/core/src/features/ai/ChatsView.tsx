import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { chatMessages as messageRepo, chats as chatRepo, dayKey, useLiveQuery } from '@/db';
import { DarkSurface } from '@/features/assistant/AssistantView';
import { relativeDay } from '@/features/shared/days';
import { useI18n } from '@/i18n';
import { AI_CHAT_CANNED_REPLY, AI_CHAT_STARTERS } from '@/mocks/aiChat';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { ComposeBar, EmptyState, Header, Screen, SuggestionChip, SwipeRow, Text } from '@/ui';

/**
 * Die Startseite von BetterAi: die Gespraeche, das Neueste zuerst — auf der
 * dunklen Flaeche wie der Assistent. Unten das Feld: wer tippt, faengt ein
 * neues Gespraech an; die Vorschlaege darueber tun dasselbe mit einem Tipp.
 */
export function ChatsView() {
  return (
    <DarkSurface>
      <Chats />
    </DarkSurface>
  );
}

function Chats() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [draft, setDraft] = useState('');

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

  function send() {
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft('');
    void startChat(text);
  }

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <Header
          large
          crumb={{ label: t('tabs.assistant') }}
          title={t('chats.title')}
          subtitle={t(rows.length === 1 ? 'chats.count.one' : 'chats.count', {
            count: rows.length,
          })}
          actions={[
            { icon: 'plus' as const, label: t('chats.new'), onPress: () => void startChat() },
          ]}
        />
      }
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {draft.length === 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: theme.spacing.sm }}
            >
              {AI_CHAT_STARTERS.map((starter) => (
                <SuggestionChip
                  key={starter}
                  label={starter}
                  onPress={() => void startChat(starter)}
                />
              ))}
            </ScrollView>
          ) : null}
          <ComposeBar
            value={draft}
            onChangeText={setDraft}
            onSubmit={send}
            placeholder={t('aiChat.placeholder')}
            sendLabel={t('assistant.send')}
          />
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: theme.spacing.edge,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.sm,
          justifyContent: rows.length === 0 ? 'center' : 'flex-start',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {rows.length === 0 ? (
          <EmptyState title={t('chats.empty.title')} body={t('chats.empty.body')} />
        ) : null}

        {rows.map((chat) => {
          const preview = previews.get(chat.id);
          const title = chat.title || t('chats.untitled');
          // Loeschen: nach links wischen, oder im Gespraech selbst.
          return (
            <SwipeRow
              key={chat.id}
              radius={theme.radii.item}
              onDelete={() => void chatRepo.remove(chat.id)}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={title}
                onPress={() => router.push(`/chat/${chat.id}`)}
                style={({ pressed }) => ({
                  gap: theme.spacing.xs,
                  padding: theme.spacing.lg,
                  borderRadius: theme.radii.item,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                })}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}
                >
                  <Text
                    variant="label"
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: theme.fontSize.lede,
                      lineHeight: theme.lineHeight.lede,
                      fontWeight: theme.fontWeight.semibold,
                    }}
                  >
                    {title}
                  </Text>
                  <Text variant="caption" tone="faint">
                    {relativeDay(t, language, dayKey(new Date(chat.updatedAt)))}
                  </Text>
                </View>
                {preview ? (
                  <Text variant="label" tone="muted" numberOfLines={2}>
                    {preview.text}
                  </Text>
                ) : null}
              </Pressable>
            </SwipeRow>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
