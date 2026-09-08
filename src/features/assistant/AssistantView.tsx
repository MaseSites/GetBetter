import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import {
  ASSISTANT_CANNED_REPLY,
  ASSISTANT_REPLY_DELAY_MS,
  ASSISTANT_STARTERS,
  ASSISTANT_THREAD,
} from '@/mocks/assistant';
import { getModule } from '@/mocks/modules';
import type { AssistantMessage } from '@/mocks/types';
import { useTheme } from '@/theme';
import { Badge, Chip, Header, Icon, Input, Loading, Screen, Text } from '@/ui';

export type AssistantViewProps = {
  /** Als Tab ohne Zurueck, als aufgerufener Bildschirm mit. */
  showBack?: boolean;
};

/**
 * P-017: Chat-Oberflaeche mit dem Beispieldialog. Die Antwort ist fest,
 * kommt aber mit kurzer Verzoegerung, damit sich der Ablauf echt anfuehlt.
 */
export function AssistantView({ showBack = false }: AssistantViewProps) {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();

  const [messages, setMessages] = useState<readonly AssistantMessage[]>(ASSISTANT_THREAD);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [decided, setDecided] = useState(false);
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
    respondLater(ASSISTANT_CANNED_REPLY);
  }

  function send() {
    ask(draft.trim());
  }

  function decide(confirmed: boolean) {
    setDecided(true);
    append({
      id: `u-${(nextId.current += 1)}`,
      role: 'user',
      text: confirmed ? t('assistant.confirm') : t('assistant.adjust'),
    });
    respondLater(confirmed ? t('assistant.confirmed') : t('assistant.adjusted'));
  }

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <Header
          title={t('assistant.title')}
          subtitle={t('assistant.disclaimer')}
          showBack={showBack}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
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
            {ASSISTANT_STARTERS.map((starter) => (
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
        </>
      }
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((message) => (
          <View key={message.id} style={{ gap: theme.spacing.sm }}>
            <View
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

            {message.touches ? (
              <View style={[styles.touches, { gap: theme.spacing.xs }]}>
                {message.touches.map((id) => {
                  const module = getModule(id);
                  if (!module) return null;
                  return <Badge key={id} label={module.name} icon={module.icon} />;
                })}
              </View>
            ) : null}

            {message.needsConfirmation && !decided ? (
              <View style={[styles.actions, { gap: theme.spacing.sm }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('assistant.confirm')}
                  onPress={() => decide(true)}
                  style={({ pressed }) => [
                    styles.action,
                    {
                      borderRadius: theme.radii.pill,
                      backgroundColor: pressed ? theme.colors.accentStrong : theme.colors.accent,
                      borderColor: theme.colors.accent,
                    },
                  ]}
                >
                  <Text variant="label" tone="onAccent">
                    {t('assistant.confirm')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('assistant.adjust')}
                  onPress={() => decide(false)}
                  style={({ pressed }) => [
                    styles.action,
                    {
                      borderRadius: theme.radii.pill,
                      backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text variant="label">{t('assistant.adjust')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}

        {thinking ? <Loading label={t('assistant.thinking')} compact /> : null}

        <Text variant="caption" tone="faint" align="center">
          {t('assistant.fallback')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderWidth: 1 },
  touches: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  action: {
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
