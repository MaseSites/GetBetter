import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { chatMessages as messageRepo, chats as chatRepo, useLiveQuery } from '@/db';
import { DarkSurface, Message } from '@/features/assistant/AssistantView';
import { useTranslate } from '@/i18n';
import { AI_CHAT_CANNED_REPLY, AI_CHAT_REPLY_DELAY_MS, AI_CHAT_STARTERS } from '@/mocks/aiChat';
import type { AssistantMessage, ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { ComposeBar, EmptyState, Header, Loading, Screen, SuggestionChip } from '@/ui';

export type AiChatViewProps = {
  module: ModuleDefinition;
  /**
   * Mit Id bleibt das Gespraech in der Datenbank und steht in der Liste von
   * BetterAi; ohne Id (die Funktion in GetBetter) lebt es nur bis zum Schliessen.
   */
  chatId?: string;
};

/**
 * Das Modul "KI-Chat": ein offenes Gespraech, ohne Zugriff auf die Module.
 * Bewusst schlichter als der Assistent — keine Modul-Marken, keine Bestaetigung —,
 * aber auf derselben dunklen Flaeche und mit demselben Feld.
 */
export function AiChatView(props: AiChatViewProps) {
  return (
    <DarkSurface>
      <ChatView {...props} />
    </DarkSurface>
  );
}

function ChatView({ module, chatId }: AiChatViewProps) {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [local, setLocal] = useState<readonly AssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const stored = useLiveQuery(
    () => (chatId ? messageRepo.list(chatId) : Promise.resolve([])),
    [chatId],
  );
  const chat = useLiveQuery(
    () => (chatId ? chatRepo.find(chatId) : Promise.resolve(undefined)),
    [chatId],
  );
  const messages: readonly AssistantMessage[] = chatId
    ? (stored.data ?? []).map((row) => ({ id: row.id, role: row.role, text: row.text }))
    : local;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function scrollDown() {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  async function append(role: 'user' | 'assistant', text: string) {
    if (chatId) {
      await messageRepo.add({ chatId, accountId: account.id, role, text });
    } else {
      setLocal((current) => [...current, { id: `${role}-${(nextId.current += 1)}`, role, text }]);
    }
    scrollDown();
  }

  function ask(text: string) {
    if (text.length === 0 || thinking) return;
    setDraft('');
    void append('user', text);
    setThinking(true);
    timer.current = setTimeout(() => {
      setThinking(false);
      void append('assistant', AI_CHAT_CANNED_REPLY);
    }, AI_CHAT_REPLY_DELAY_MS);
  }

  async function removeChat() {
    if (!chatId) return;
    await chatRepo.remove(chatId);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const title = chatId ? chat.data?.title || t('chats.untitled') : module.name;
  const empty = messages.length === 0 && !thinking;

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <Header
          title={title}
          subtitle={chatId ? undefined : t('aiChat.intro')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          actions={
            chatId
              ? [
                  {
                    icon: 'trash' as const,
                    label: t('chats.remove'),
                    onPress: () => void removeChat(),
                  },
                ]
              : messages.length > 0
                ? [{ icon: 'repeat' as const, label: t('aiChat.new'), onPress: () => setLocal([]) }]
                : []
          }
        />
      }
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {messages.length === 0 && draft.length === 0 ? (
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
                  disabled={thinking}
                  onPress={() => ask(starter)}
                />
              ))}
            </ScrollView>
          ) : null}
          <ComposeBar
            value={draft}
            onChangeText={setDraft}
            onSubmit={() => ask(draft.trim())}
            placeholder={t('aiChat.placeholder')}
            sendLabel={t('assistant.send')}
            busy={thinking}
          />
        </View>
      }
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: theme.spacing.edge,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.lg,
          justifyContent: empty ? 'center' : 'flex-end',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollDown}
      >
        {empty ? (
          <EmptyState title={t('aiChat.empty.title')} body={t('aiChat.empty.body')} />
        ) : null}

        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}

        {thinking ? <Loading label={t('assistant.thinking')} compact /> : null}
      </ScrollView>
    </Screen>
  );
}
