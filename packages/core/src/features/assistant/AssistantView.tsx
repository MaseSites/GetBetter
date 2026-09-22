import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { APP_MODULES, currentApp } from '@/app/identity';
import { isViewing, reportReadOnly } from '@/app/viewMode';
import { ai, dayKey, useLiveQuery, type AiAction } from '@/db';
import { appAccess } from '@/db/appAccess';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';
import { usePlanSheet } from '@/features/plan/PlanSheet';
import type { AssistantMessage } from '@/mocks/types';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, ComposeBar, Loading, Screen, SuggestionChip, Text, useUndo } from '@/ui';

import { agendaText, pickText, whenText } from './agenda';
import {
  ASSISTANT_HISTORY_LIMIT,
  aiFailureOf,
  aiFailureOffersPlan,
  aiFailureText,
  turnsFor,
} from './aiTurns';
import type { ContextRefs } from './context';
import { seedOf, suggestionsFor } from './suggestions';
import { AssistantAvatar } from './AssistantAvatar';
import { runActions, type ActionEnv, type ActionOutcome } from './runActions';
import { pendingOf, understand, whenHint, type Pending } from './understand';
import { useAssistantContext } from './useAssistantContext';
import { useVoice } from './useVoice';
import { vetActions } from './vet';
import { VoiceControls } from './VoiceControls';

/**
 * Wo der Avatar gerade steht: `here` wartet er, `leaving` zerfaellt er in die
 * Nachricht hinein, `gone` ist er aus dem Baum.
 */
type AvatarState = 'here' | 'leaving' | 'gone';

/** Eine Antwort: was dasteht und was er im Gespraech vorliest. */
type Reply = { text: string; spoken: string };

/**
 * Der Assistent. Er folgt dem Aussehen des Kontos wie jeder andere Bildschirm —
 * hell, dunkel oder wie das Geraet. Er startet leer mit der Frage, womit er
 * helfen soll; unten liegt das Feld als Pille, der Senden-Knopf in Signalgruen.
 */
export function AssistantView() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { account, household, personal, setAppearance } = useApp();
  const plan = usePlanSheet();
  const celebrate = useCelebrate();
  const undo = useUndo();
  const router = useRouter();
  // Was er ueber die Daten dieser App weiss — gebaut im Moment der Frage.
  const snapshotContext = useAssistantContext();
  // Wer ihm einen Namen gibt (mit Abo), wird von ihm mit diesem Namen begruesst.
  const name = personal.assistantName;

  const app = currentApp();
  // Nur Beispiele zu Apps, in denen das Konto schon war — und nach jeder Frage andere.
  const accountId = account?.id ?? null;
  const seen = useLiveQuery(
    () => (accountId === null ? Promise.resolve([]) : appAccess.appsOf(accountId)),
    [accountId],
  );
  const [rolls, setRolls] = useState(0);
  const suggestions = suggestionsFor({
    current: app.id,
    seen: seen.data ?? [],
    seed: seedOf(accountId ?? app.id) + rolls,
  });

  const [messages, setMessages] = useState<readonly AssistantMessage[]>([]);
  // Ist das Gratis-Kontingent aufgebraucht, steht unter dem Gespraech „Abo ansehen“.
  const [planOffer, setPlanOffer] = useState(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  // Die offene Rueckfrage „Welchen meinst du?“ — die naechste Antwort waehlt daraus.
  const [pending, setPending] = useState<Pending | null>(null);
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
   * Was aus den Aktionen wurde, Satz fuer Satz. Eine Feier fuer die erste,
   * die etwas angelegt hat; Rueckgaengig fuer die letzte, die sich zuruecknehmen laesst.
   */
  function settled(outcomes: readonly ActionOutcome[]): Reply {
    const kind = outcomes.find((outcome) => outcome.celebrate)?.celebrate;
    if (kind) celebrate(kind);
    const reversible = [...outcomes].reverse().find((outcome) => outcome.undo);
    const back = reversible?.undo;
    if (reversible && back) undo.show({ message: reversible.text, onUndo: () => void back() });
    return said(outcomes.map((outcome) => outcome.text).join('\n'));
  }

  /** Womit die Aktionen laufen — dieselben Repositories wie die Bildschirme. */
  function envFor(accountId: string, refs: ContextRefs): ActionEnv {
    return {
      t,
      language,
      app: currentApp().id,
      accountId,
      householdId: household?.id ?? null,
      refs,
      now: new Date(),
      openModule: (module) => router.push(`/run/${module}`),
      setMode: (mode) => void setAppearance({ mode }),
    };
  }

  /**
   * Die Antwort auf einen Satz. **Jeder Satz geht an die KI** — sie entscheidet,
   * was gemeint ist, mit allen Funktionen der App, der Liste und den letzten
   * Zuegen; kein Wortmuster schickt ihn vorher woanders hin. Die App prueft jede
   * Aktion, bevor sie geschieht (`vetActions`), und tut sie selbst.
   *
   * Was die App selbst liest (`understand`), gilt nur, wo die KI nichts
   * Brauchbares tut: dann das, was sich sicher an den Daten nachpruefen laesst,
   * sonst eine Rueckfrage — und ohne KI (offline, Kontingent leer) als Rueckfall.
   * Einzige Ausnahme: die Antwort auf die eigene Rueckfrage „Welchen meinst du?“
   * waehlt die App direkt aus ihrer Liste.
   */
  async function answerTo(text: string, voice: boolean): Promise<Reply> {
    if (!account) return said(t('assistant.reply'));
    const appId = currentApp().id;
    const snapshot = snapshotContext();
    const items = snapshot.context.items;
    const today = dayKey(new Date());
    const check = { text, today, items };
    const waiting = pending;
    setPending(null);

    /** „Welchen meinst du?“ — und merken, woraus die naechste Antwort waehlt. */
    const offer = (next: Pending): Reply => {
      const picked = pickText(t, language, items, next, today);
      if (picked.open) setPending(next);
      return said(picked.text);
    };
    /** Erst pruefen, dann tun — null, wenn nichts uebrig bleibt. */
    const perform = async (actions: readonly AiAction[]): Promise<Reply | null> => {
      const vetted = vetActions(actions, check).actions;
      if (vetted.length === 0) return null;
      const outcomes = await runActions(vetted, envFor(account.id, snapshot.refs));
      return outcomes.length > 0 ? settled(outcomes) : null;
    };
    /** Was die App selbst sicher tun kann — oder die Rueckfrage dazu. */
    const own = async (): Promise<Reply | null> => {
      if (local?.kind === 'pick') return offer(local.pending);
      return local?.kind === 'actions' && local.sure ? perform(local.actions) : null;
    };

    const local = understand({ text, today, modules: APP_MODULES[appId], items, pending: waiting });
    // Die Antwort auf die eigene Rueckfrage: aus der Liste, die die App eben gezeigt hat.
    if (waiting && local?.kind === 'actions' && local.sure) {
      const done = await perform(local.actions);
      if (done) return done;
    }

    // Tag und Uhrzeit rechnet die App vor — das kleine Modell verrechnet sich
    // dabei sonst gern.
    const hint = whenHint(text, today);
    const result = await ai.reply({
      accountId: account.id,
      app: appId,
      voice,
      tools: true,
      messages: turnsFor(messages, hint ? `${text} (${hint})` : text).slice(-ASSISTANT_HISTORY_LIMIT),
      context: snapshot.context,
    });
    if (!result.ok) {
      // Ohne KI gilt, was die App selbst gelesen hat — geprueft wie jede Antwort.
      if (local?.kind === 'agenda') return said(agendaText(t, language, items, local, today));
      if (local?.kind === 'when') return said(whenText(t, language, local.item, today));
      const fallback = (await own()) ?? (local?.kind === 'actions' ? await perform(local.actions) : null);
      if (fallback) return fallback;
      const failure = aiFailureOf(result);
      setPlanOffer(aiFailureOffersPlan(failure));
      return said(aiFailureText(t, language, failure));
    }
    setPlanOffer(false);

    const actions = result.data.actions ?? [];
    const done = await perform(actions);
    if (done) return done;
    // Nichts von der KI hat die Pruefung ueberstanden (oder sie hat nur
    // geredet): was die App sicher an den Daten nachpruefen kann, sonst nachfragen.
    const checked = await own();
    if (checked) return checked;
    if (actions.length > 0) {
      const next = pendingOf(text, today);
      return next ? offer(next) : said(t('assistant.did.unsure'));
    }
    const reply = result.data.response || t('assistant.did.failed');
    return { text: reply, spoken: result.data.voice_text ?? reply };
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
    // Beim naechsten Mal stehen andere Beispiele da.
    setRolls((current) => current + 1);
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
          {empty && draft.length === 0 && voicing.mode === 'off' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.edge }}
            >
              {suggestions.map((key) => (
                <SuggestionChip key={key} label={t(key)} onPress={() => void ask(t(key))} />
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
  offer: { alignSelf: 'flex-start' },
  ask: { alignSelf: 'flex-end', maxWidth: '85%' },
  said: { maxWidth: 305 },
});
