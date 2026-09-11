import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { sendCommand } from '@/app/bridge';
import { APPS } from '@/app/identity';
import { ASSISTANT_REPLY_DELAY_MS } from '@/mocks/assistant';
import type { AssistantMessage } from '@/mocks/types';
import { useApp } from '@/state/AppContext';
import { ThemeProvider, createTheme, useTheme } from '@/theme';
import { ComposeBar, EmptyState, Loading, Screen, SuggestionChip, Text } from '@/ui';

import { route } from './route';

/** Beispiele, die wirklich ankommen — beide erkennt `route()` als Auftrag. */
const SUGGESTIONS = ['assistant.chip.shopping', 'assistant.chip.chore'] as const;

/**
 * Die dunkle Flaeche fuer alles, womit man redet: der Assistent in GetBetter
 * und die Gespraeche in BetterAi. Farbe und Voreinstellung bleiben die des Kontos.
 */
export function DarkSurface({ children }: { children: ReactNode }) {
  const { appearance } = useApp();
  const dark = useMemo(
    () => createTheme('dark', appearance.accent, appearance.preset),
    [appearance.accent, appearance.preset],
  );

  return <ThemeProvider value={dark}>{children}</ThemeProvider>;
}

/**
 * Der Assistent — die eine dunkle Flaeche in einer hellen App.
 *
 * Er steht quer ueber allen Bereichen, und der Wechsel ins Dunkle sagt ohne
 * Worte: hier redest du mit etwas. Er startet leer mit der Frage, womit er
 * helfen soll; unten liegt das Feld als Pille, der Senden-Knopf in Signalgruen.
 */
export function AssistantView() {
  return (
    <DarkSurface>
      <Conversation />
    </DarkSurface>
  );
}

function Conversation() {
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

  return (
    <Screen
      scroll={false}
      padded={false}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {draft.length === 0 && !thinking ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.sm }}
            >
              {SUGGESTIONS.map((key) => (
                <SuggestionChip key={key} label={t(key)} onPress={() => ask(t(key))} />
              ))}
            </ScrollView>
          ) : null}

          <ComposeBar
            value={draft}
            onChangeText={setDraft}
            onSubmit={() => ask(draft.trim())}
            placeholder={t('assistant.placeholder')}
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
          paddingTop: theme.spacing.xxl + insets.top,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.lg,
          // Solange nichts dasteht, sitzt die Frage in der Mitte; danach
          // waechst das Gespraech von unten nach oben, wie im Entwurf.
          justifyContent: messages.length === 0 && !thinking ? 'center' : 'flex-end',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && !thinking ? (
          <EmptyState
            icon="sparkles"
            title={t('assistant.empty.title')}
            body={t('assistant.empty.body')}
          />
        ) : null}

        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}

        {thinking ? <Loading label={t('assistant.thinking')} compact /> : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * Eine Nachricht wie im Entwurf: die eigene als Blase rechts, die Antwort als
 * ruhiger Text ohne Kasten.
 */
export function Message({ message }: { message: AssistantMessage }) {
  const theme = useTheme();

  if (message.role !== 'user') {
    return (
      <Text variant="body" tone="muted" style={styles.said}>
        {message.text}
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.ask,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          borderBottomRightRadius: theme.radii.xs,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
        },
      ]}
    >
      <Text variant="body">{message.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ask: { alignSelf: 'flex-end', maxWidth: '85%' },
  said: { maxWidth: 305 },
});
