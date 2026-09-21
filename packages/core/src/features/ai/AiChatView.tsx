import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { currentApp } from '@/app/identity';
import { isViewing, reportReadOnly } from '@/app/viewMode';
import { ai, chatMessages as messageRepo, chats as chatRepo, useLiveQuery } from '@/db';
import { aiFailureOf, aiFailureOffersPlan, aiFailureText, turnsFor } from '@/features/assistant/aiTurns';
import { Message } from '@/features/assistant/AssistantView';
import { usePlanSheet } from '@/features/plan/PlanSheet';
import { useI18n } from '@/i18n';
import { AI_CHAT_STARTER_KEYS } from '@/mocks/aiChat';
import { moduleName } from '@/mocks/moduleText';
import type { AssistantMessage, ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, ComposeBar, EmptyState, Header, Loading, Screen, SuggestionChip } from '@/ui';

export type AiChatViewProps = {
  module: ModuleDefinition;
  /**
   * Mit Id bleibt das Gespraech in der Datenbank und steht in der Liste von
   * BetterAi; ohne Id (die Funktion in GetBetter) lebt es nur bis zum Schliessen.
   */
  chatId?: string;
};

/**
 * Jede Frage bekommt genau eine Antwort — auch wenn die Liste neu laedt, waehrend
 * die KI noch schreibt.
 */
class Answered {
  private readonly ids = new Set<string>();

  claim(id: string): boolean {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    return true;
  }
}

/**
 * Das Modul "KI-Chat": ein offenes Gespraech, ohne Zugriff auf die Module.
 * Bewusst schlichter als der Assistent — keine Modul-Marken, keine Bestaetigung —,
 * aber mit demselben Feld. Die Antwort kommt von der KI im Dienst.
 */
export function AiChatView({ module, chatId }: AiChatViewProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const plan = usePlanSheet();

  const [local, setLocal] = useState<readonly AssistantMessage[]>([]);
  // Ist das Gratis-Kontingent aufgebraucht, steht ueber dem Feld „Abo ansehen“.
  const [planOffer, setPlanOffer] = useState(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [answered] = useState(() => new Answered());
  const scrollRef = useRef<ScrollView>(null);
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

  /**
   * Die Antwort der KI — oder ein ehrlicher Satz, wenn keine kommt. Dazu, ob
   * das Abo helfen wuerde; den Zustand setzt, wer die Antwort bekommt.
   */
  async function fetchReply(
    history: readonly AssistantMessage[],
    question: string,
  ): Promise<{ text: string; offersPlan: boolean }> {
    const result = await ai.reply({
      accountId: account.id,
      app: currentApp().id,
      messages: turnsFor(history, question),
    });
    if (result.ok) return { text: result.data.response, offersPlan: false };
    const failure = aiFailureOf(result);
    return { text: aiFailureText(t, language, failure), offersPlan: aiFailureOffersPlan(failure) };
  }

  // Ein gespeichertes Gespraech, dessen letzte Nachricht noch keine Antwort hat —
  // etwa frisch aus der Liste angefangen —, beantwortet sich selbst. Solange
  // denkt er nach; das ergibt sich aus der Liste, ohne eigenen Zustand.
  const lastStored = chatId ? stored.data?.[stored.data.length - 1] : undefined;
  const awaiting = lastStored?.role === 'user';
  const busy = thinking || awaiting;

  useEffect(() => {
    if (!chatId || !lastStored || lastStored.role !== 'user') return;
    if (!answered.claim(lastStored.id)) return;
    const history = (stored.data ?? [])
      .slice(0, -1)
      .map((row) => ({ id: row.id, role: row.role, text: row.text }));
    void fetchReply(history, lastStored.text).then((reply) => {
      setPlanOffer(reply.offersPlan);
      return messageRepo.add({ chatId, accountId: account.id, role: 'assistant', text: reply.text });
    });
  });

  /** Ohne Speicher (die Funktion in GetBetter) antwortet das Gespraech gleich hier. */
  async function respondLocally(history: readonly AssistantMessage[], question: string) {
    setThinking(true);
    const reply = await fetchReply(history, question);
    setThinking(false);
    setPlanOffer(reply.offersPlan);
    await append('assistant', reply.text);
  }

  function ask(text: string) {
    if (text.length === 0 || busy) return;
    // Nur ansehen: keine Frage, die nie gespeichert wird.
    if (isViewing()) {
      reportReadOnly();
      return;
    }
    setDraft('');
    const history = messages;
    void append('user', text);
    // Gespeichert antwortet der Effekt oben, sobald die Frage in der Liste steht.
    if (!chatId) void respondLocally(history, text);
  }

  async function removeChat() {
    if (!chatId) return;
    await chatRepo.remove(chatId);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const title = chatId ? chat.data?.title || t('chats.untitled') : moduleName(t, module.id);
  const empty = messages.length === 0 && !busy;

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
              {AI_CHAT_STARTER_KEYS.map((key) => (
                <SuggestionChip
                  key={key}
                  label={t(key)}
                  disabled={busy}
                  onPress={() => ask(t(key))}
                />
              ))}
            </ScrollView>
          ) : null}
          {planOffer ? (
            <View style={styles.offer}>
              <Button
                label={t('plan.see')}
                size="sm"
                variant="secondary"
                icon="star"
                fullWidth={false}
                onPress={plan.open}
              />
            </View>
          ) : null}
          <ComposeBar
            value={draft}
            onChangeText={setDraft}
            onSubmit={() => ask(draft.trim())}
            placeholder={t('aiChat.placeholder')}
            sendLabel={t('assistant.send')}
            busy={busy}
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

        {busy ? <Loading label={t('assistant.thinking')} compact /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  offer: { alignSelf: 'flex-start' },
});
