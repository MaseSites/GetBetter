import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { sendCommand } from '@/app/bridge';
import { APPS, currentApp } from '@/app/identity';
import { isViewing, reportReadOnly } from '@/app/viewMode';
import { ai } from '@/db';
import type { AssistantMessage } from '@/mocks/types';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { ComposeBar, Loading, Screen, SuggestionChip, Text } from '@/ui';

import { aiFailureOf, aiFailureText, turnsFor } from './aiTurns';
import { AssistantAvatar } from './AssistantAvatar';
import { route } from './route';
import { useVoice } from './useVoice';
import { VoiceControls } from './VoiceControls';

/**
 * Wo der Avatar gerade steht: `here` wartet er, `leaving` zerfaellt er in die
 * Nachricht hinein, `gone` ist er aus dem Baum.
 */
type AvatarState = 'here' | 'leaving' | 'gone';

/** Eine Antwort: was dasteht und was er im Gespraech vorliest. */
type Reply = { text: string; spoken: string };

/** Beispiele, die wirklich ankommen — beide erkennt `route()` als Auftrag. */
const SUGGESTIONS = ['assistant.chip.shopping', 'assistant.chip.chore'] as const;

/**
 * Der Assistent. Er folgt dem Aussehen des Kontos wie jeder andere Bildschirm —
 * hell, dunkel oder wie das Geraet. Er startet leer mit der Frage, womit er
 * helfen soll; unten liegt das Feld als Pille, der Senden-Knopf in Signalgruen.
 */
export function AssistantView() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { account } = useApp();
  // Wer ihm unter Aussehen einen Namen gibt, wird von ihm mit diesem Namen begruesst.
  const name = account?.assistantName?.trim() ?? '';

  const [messages, setMessages] = useState<readonly AssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Fortlaufend statt Zeitstempel: stabile, eindeutige Schluessel.
  const nextId = useRef(0);
  // Eine Frage nach der anderen — auch wenn sie aus dem Gespraech kommt.
  const asking = useRef(false);
  const alive = useRef(true);
  // In welche Nachricht er geflogen ist. Mehr braucht es nicht: wo er steht,
  // ergibt sich daraus und aus dem Gespraech.
  const [flownInto, setFlownInto] = useState<string | null>(null);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  function append(message: AssistantMessage) {
    setMessages((current) => [...current, message]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  /** Ein Satz, der zugleich dasteht und vorgelesen wird. */
  function said(text: string): Reply {
    return { text, spoken: text };
  }

  /**
   * Die Antwort auf einen Satz. Was in eine andere Better-App gehoert, geht
   * dorthin; alles andere beantwortet die KI im Dienst — mit dem guenstigsten
   * Modell, das die Frage kann, und im Gespraech kurz und sprechbar.
   */
  async function answerTo(text: string, voice: boolean): Promise<Reply> {
    const routed = route(text);
    if (routed) {
      const target = APPS[routed.command.app].name;
      const sent = await sendCommand(routed.command);
      return said(
        sent
          ? t('assistant.handedOver', { app: target, subject: routed.subject })
          : t('assistant.notInstalled', { app: target }),
      );
    }

    if (!account) return said(t('assistant.reply'));
    const result = await ai.reply({
      accountId: account.id,
      app: currentApp().id,
      messages: turnsFor(messages, text),
      voice,
    });
    if (!result.ok) return said(aiFailureText(t, language, aiFailureOf(result)));
    return { text: result.data.response, spoken: result.data.voice_text ?? result.data.response };
  }

  /**
   * Fragen und antworten. Gibt zurueck, was vorgelesen werden soll — geschrieben
   * steht die Antwort ohnehin schon da.
   */
  async function ask(text: string, voice = false): Promise<string | null> {
    if (text.length === 0 || asking.current) return null;
    // Nur ansehen: keine Frage im Gespraech, die es nie gab.
    if (isViewing()) {
      reportReadOnly();
      return null;
    }
    asking.current = true;
    setDraft('');
    append({ id: `u-${(nextId.current += 1)}`, role: 'user', text });
    setThinking(true);

    const reply = await answerTo(text, voice);
    if (!alive.current) return null;
    asking.current = false;
    setThinking(false);
    append({ id: `a-${(nextId.current += 1)}`, role: 'assistant', text: reply.text });
    return reply.spoken;
  }

  const voicing = useVoice({
    // Eine einzelne Sprachnachricht landet im Feld — so kann man sie noch aendern.
    onDictate: setDraft,
    // Im Gespraech antwortet er kuerzer und liest den Sprechtext vor.
    onTurn: (text) => ask(text, true),
  });
  const talking = voicing.mode === 'talk';

  // Leer steht er da und schaut sich um. Ist etwas abgeschickt, fliegt er der
  // Nachricht nach; ist er dort angekommen, ist er weg. Wuerde das Gespraech
  // je wieder leer, gaebe es die Nachricht nicht mehr — und er setzt sich
  // von selbst wieder zusammen.
  const empty = messages.length === 0 && !thinking;
  const landed = flownInto !== null && messages.some((message) => message.id === flownInto);
  const avatar: AvatarState = empty ? 'here' : landed ? 'gone' : 'leaving';

  return (
    <Screen
      scroll={false}
      padded={false}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {draft.length === 0 && !thinking && voicing.mode === 'off' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.sm }}
            >
              {SUGGESTIONS.map((key) => (
                <SuggestionChip key={key} label={t(key)} onPress={() => void ask(t(key))} />
              ))}
            </ScrollView>
          ) : null}

          <ComposeBar
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              // Wer tippt, hat die Meldung gelesen.
              voicing.clear();
            }}
            onSubmit={() => void ask(draft.trim())}
            placeholder={
              name
                ? t('personalize.assistant.placeholderNamed', { name })
                : t('assistant.placeholder')
            }
            sendLabel={t('assistant.send')}
            busy={thinking || talking}
          />

          <VoiceControls voicing={voicing} name={name} busy={thinking && !talking} />
        </View>
      }
    >
      <View style={styles.stage}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: theme.spacing.edge,
            paddingTop: theme.spacing.xxl + insets.top,
            paddingBottom: theme.spacing.lg,
            gap: theme.spacing.lg,
            // Das Gespraech waechst von unten nach oben, wie im Entwurf. Solange
            // nichts dasteht, steht der Avatar in der Mitte darueber.
            justifyContent: 'flex-end',
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}

          {thinking ? (
            <Loading
              label={name ? t('personalize.assistant.thinking', { name }) : t('assistant.thinking')}
              compact
            />
          ) : null}
        </ScrollView>

        {avatar === 'gone' ? null : (
          <AssistantAvatar
            name={name}
            leaving={avatar === 'leaving'}
            onGone={() => setFlownInto(messages[messages.length - 1]?.id ?? null)}
          />
        )}
      </View>
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
  // Das Gespraech und darueber der Avatar — er soll nichts verschieben.
  stage: { flex: 1 },
  ask: { alignSelf: 'flex-end', maxWidth: '85%' },
  said: { maxWidth: 305 },
});
