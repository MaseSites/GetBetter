import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { sendCommand } from '@/app/bridge';
import { APPS } from '@/app/identity';
import { ASSISTANT_REPLY_DELAY_MS } from '@/mocks/assistant';
import type { AssistantMessage } from '@/mocks/types';

import { route } from './route';
import { useTheme } from '@/theme';
import { EmptyState, Icon, Input, Loading, Screen, Text } from '@/ui';

/**
 * Der Assistent. Er startet leer — kein Kopfbereich, kein Beispieldialog,
 * keine Vorschlaege. Nur die Frage, womit er helfen soll, und ein Feld.
 */
export function AssistantView() {
  const t = useTranslate();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<readonly AssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fortlaufend statt Zeitstempel: stabile, eindeutige Schluessel.
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

  function respondLater(text: string) {
    setThinking(true);
    timer.current = setTimeout(() => {
      setThinking(false);
      append({ id: `a-${(nextId.current += 1)}`, role: 'assistant', text });
    }, ASSISTANT_REPLY_DELAY_MS);
  }

  function ask(text: string) {
    if (text.length === 0 || thinking) return;
    setDraft('');
    append({ id: `u-${(nextId.current += 1)}`, role: 'user', text });

    // Was in eine andere Better-App gehoert, wird dorthin geschickt.
    const routed = route(text);
    if (!routed) {
      respondLater(t('assistant.reply'));
      return;
    }

    const target = APPS[routed.command.app].name;
    setThinking(true);
    void sendCommand(routed.command).then((sent) => {
      setThinking(false);
      append({
        id: `a-${(nextId.current += 1)}`,
        role: 'assistant',
        text: sent
          ? t('assistant.handedOver', { app: target, subject: routed.subject })
          : t('assistant.notInstalled', { app: target }),
      });
    });
  }

  function send() {
    ask(draft.trim());
  }

  return (
    <Screen
      scroll={false}
      padded={false}
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder={t('assistant.placeholder')}
              onSubmitEditing={send}
              returnKeyType="send"
              editable={!thinking}
              accessibilityLabel={t('assistant.placeholder')}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('assistant.send')}
            accessibilityState={{ disabled: draft.trim().length === 0 || thinking }}
            disabled={draft.trim().length === 0 || thinking}
            onPress={send}
            style={({ pressed }) => [
              styles.send,
              {
                borderRadius: theme.radii.md,
                backgroundColor:
                  draft.trim().length === 0 || thinking
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
              color={
                draft.trim().length === 0 || thinking
                  ? theme.colors.disabledText
                  : theme.colors.textOnAccent
              }
            />
          </Pressable>
        </View>
      }
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1,
          padding: theme.spacing.lg,
          paddingTop: theme.spacing.lg + insets.top,
          gap: theme.spacing.md,
          // Solange nichts dasteht, sitzt die Frage in der Mitte.
          justifyContent: messages.length === 0 ? 'center' : 'flex-start',
        }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && !thinking ? (
          <EmptyState
            icon="sparkles"
            title={t('assistant.empty.title')}
            body={t('assistant.empty.body')}
          />
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
