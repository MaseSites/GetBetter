import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { chatMessages as messageRepo, chats as chatRepo, useLiveQuery } from '@/db';
import { useTranslate } from '@/i18n';
import { AI_CHAT_CANNED_REPLY, AI_CHAT_REPLY_DELAY_MS, AI_CHAT_STARTERS } from '@/mocks/aiChat';
import type { AssistantMessage, ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Chip, EmptyState, Header, Icon, Input, Loading, Screen, Text } from '@/ui';

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
 * Bewusst schlichter als der Assistent — keine Modul-Marken, keine Bestaetigung.
 */
export function AiChatView({ module, chatId }: AiChatViewProps) {
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

  const sendDisabled = draft.trim().length === 0 || thinking;
  const title = chatId ? chat.data?.title || t('chats.untitled') : module.name;

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
        <>
          {messages.length === 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.lg }}
            >
              {AI_CHAT_STARTERS.map((starter) => (
                <Chip
                  key={starter}
                  label={starter}
                  disabled={thinking}
                  onPress={() => ask(starter)}
                />
              ))}
            </ScrollView>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                value={draft}
                onChangeText={setDraft}
                placeholder={t('aiChat.placeholder')}
                onSubmitEditing={() => ask(draft.trim())}
                returnKeyType="send"
                editable={!thinking}
                accessibilityLabel={t('aiChat.placeholder')}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('assistant.send')}
              accessibilityState={{ disabled: sendDisabled }}
              disabled={sendDisabled}
              onPress={() => ask(draft.trim())}
              style={({ pressed }) => [
                styles.send,
                {
                  borderRadius: theme.radii.md,
                  backgroundColor: sendDisabled
                    ? theme.colors.disabledBackground
                    : pressed
                      ? theme.colors.accentStrong
                      : theme.colors.accent,
                },
              ]}
            >
              <Icon
                name="send"
                size={20}
                color={sendDisabled ? theme.colors.disabledText : theme.colors.textOnAccent}
              />
            </Pressable>
          </View>
        </>
      }
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollDown}
      >
        {messages.length === 0 && !thinking ? (
          <EmptyState icon="bulb" title={t('aiChat.empty.title')} body={t('aiChat.empty.body')} />
        ) : null}

        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.bubble,
              {
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                borderRadius: theme.radii.lg,
                padding: theme.spacing.md,
                backgroundColor:
                  message.role === 'user' ? theme.colors.accent : theme.colors.surface,
                borderColor: message.role === 'user' ? theme.colors.accent : theme.colors.border,
              },
            ]}
          >
            <Text variant="body" tone={message.role === 'user' ? 'onAccent' : 'default'}>
              {message.text}
            </Text>
          </View>
        ))}

        {thinking ? <Loading label={t('assistant.thinking')} compact /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderWidth: 1 },
  send: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
