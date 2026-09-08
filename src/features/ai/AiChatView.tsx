import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useFavouriteAction } from '@/features/modules/useFavouriteAction';
import { useTranslate } from '@/i18n';
import {
  AI_CHAT_CANNED_REPLY,
  AI_CHAT_REPLY_DELAY_MS,
  AI_CHAT_STARTERS,
  AI_CHAT_THREAD,
} from '@/mocks/aiChat';
import type { AssistantMessage, ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import { Chip, EmptyState, Header, Icon, Input, Loading, Screen, Text } from '@/ui';

export type AiChatViewProps = {
  module: ModuleDefinition;
};

/**
 * Das Modul "KI-Chat": ein offenes Gespraech, ohne Zugriff auf die Module.
 * Bewusst schlichter als der Assistent — keine Modul-Marken, keine Bestaetigung.
 */
export function AiChatView({ module }: AiChatViewProps) {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const favouriteAction = useFavouriteAction(module.id);

  const [messages, setMessages] = useState<readonly AssistantMessage[]>(AI_CHAT_THREAD);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function append(message: AssistantMessage) {
    setMessages((current) => [...current, message]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  function ask(text: string) {
    if (text.length === 0 || thinking) return;
    setDraft('');
    append({ id: `u-${(nextId.current += 1)}`, role: 'user', text });
    setThinking(true);
    timer.current = setTimeout(() => {
      setThinking(false);
      append({ id: `a-${(nextId.current += 1)}`, role: 'assistant', text: AI_CHAT_CANNED_REPLY });
    }, AI_CHAT_REPLY_DELAY_MS);
  }

  const sendDisabled = draft.trim().length === 0 || thinking;

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <Header
          title={module.name}
          subtitle={t('aiChat.intro')}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={
            messages.length > 0
              ? [
                  {
                    icon: 'repeat' as const,
                    label: t('aiChat.new'),
                    onPress: () => setMessages([]),
                  },
                  favouriteAction,
                ]
              : [favouriteAction]
          }
        />
      }
      footer={
        <>
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
