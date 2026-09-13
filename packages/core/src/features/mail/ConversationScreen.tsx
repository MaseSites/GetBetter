import { Fragment, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { MailMessage } from '@/db/mail';
import type { MailAccountRow } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { ListSeparator, Screen, Text } from '@/ui';

import { ConversationBar, type ConversationBarProps } from './ConversationBar';
import { focusOf, initiallyExpanded, planConversation } from './conversation';
import { RoundButton, TopBar } from './MailChrome';
import { MessageCard } from './MessageCard';

/** Erst nach so langer Anzeige gilt die Unterhaltung als gelesen. */
export const READ_DELAY_MS = 1000;

/** Was sich eine offene Unterhaltung ausserhalb von React merkt. */
class ConversationMemory {
  private marked = false;
  private scrolled = false;
  private onRead: (ids: readonly string[]) => void = () => undefined;

  setOnRead(onRead: (ids: readonly string[]) => void) {
    this.onRead = onRead;
  }

  /** Einmal je Oeffnen — wer sie danach bewusst ungelesen macht, behaelt das. */
  markRead(ids: readonly string[]) {
    if (this.marked) return;
    this.marked = true;
    this.onRead(ids);
  }

  claimScroll(): boolean {
    if (this.scrolled) return false;
    this.scrolled = true;
    return true;
  }
}

export type ConversationScreenProps = ConversationBarProps & {
  /** Die aelteste zuerst. */
  messages: readonly MailMessage[];
  subject: string;
  backLabel: string;
  onBack: () => void;
  mailboxes: readonly MailAccountRow[];
  own: ReadonlySet<string>;
  previous: (() => void) | null;
  next: (() => void) | null;
  onMarkRead: (ids: readonly string[]) => void;
  onOpenAttachment: (message: MailMessage, index: number) => void;
  onReload: () => void;
};

/**
 * Eine Unterhaltung im Vollbild. Oben „‹ Posteingang“ und ˄ ˅, darunter der
 * Betreff und die Nachrichten: die neueste ungelesene ist aufgeklappt, und der
 * Bildschirm rollt zu ihrem Anfang.
 */
export function ConversationScreen(props: ConversationScreenProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const { messages } = props;

  const scroll = useRef<ScrollView>(null);
  const [memory] = useState(() => new ConversationMemory());
  const [focusId] = useState(() => focusOf(messages));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(initiallyExpanded(messages)),
  );
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());

  const unreadKey = messages
    .filter((message) => !message.seen)
    .map((message) => message.id)
    .join('|');

  useEffect(() => {
    memory.setOnRead(props.onMarkRead);
  });

  useEffect(() => {
    if (unreadKey.length === 0) return;
    const timer = setTimeout(() => memory.markRead(unreadKey.split('|')), READ_DELAY_MS);
    return () => clearTimeout(timer);
  }, [memory, unreadKey]);

  function toggle(id: string) {
    setExpanded((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  }

  function reveal(ids: readonly string[]) {
    setRevealed((current) => new Set([...current, ...ids]));
  }

  function handleFocusLayout(event: LayoutChangeEvent) {
    const { y } = event.nativeEvent.layout;
    if (y <= 0 || !memory.claimScroll()) return;
    scroll.current?.scrollTo({ y: Math.max(0, y - theme.spacing.sm), animated: false });
  }

  const plan = planConversation(messages, { expanded, revealed });
  const count = messages.length;

  return (
    <Screen
      scroll={false}
      padded={false}
      gap={0}
      header={
        <TopBar
          backLabel={props.backLabel}
          backAccessibilityLabel={t('mailui.conversation.back', { folder: props.backLabel })}
          onBack={props.onBack}
          right={
            <>
              <RoundButton
                label={t('mailui.conversation.previous')}
                icon="down"
                flip
                disabled={props.previous === null}
                onPress={() => props.previous?.()}
              />
              <RoundButton
                label={t('mailui.conversation.next')}
                icon="down"
                disabled={props.next === null}
                onPress={() => props.next?.()}
              />
            </>
          }
        />
      }
    >
      <ScrollView
        ref={scroll}
        style={styles.fill}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.edge,
          paddingBottom: theme.spacing.xxl,
        }}
      >
        <View style={{ gap: theme.spacing.xs, paddingBottom: theme.spacing.sm }}>
          <Text
            variant="title"
            style={{
              fontSize: theme.fontSize.stat,
              lineHeight: theme.lineHeight.xl,
              fontWeight: theme.fontWeight.semibold,
            }}
          >
            {props.subject}
          </Text>
          <Text variant="label" tone="faint">
            {count === 1 ? t('mailui.conversation.one') : t('mailui.conversation.count', { count })}
          </Text>
        </View>

        {plan.map((item, index) => (
          <Fragment key={item.kind === 'bundle' ? item.key : item.id}>
            {index > 0 ? <ListSeparator /> : null}
            {item.kind === 'bundle' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('mailui.conversation.more', { count: item.ids.length })}
                onPress={() => reveal(item.ids)}
                style={({ pressed }) => [
                  styles.bundle,
                  { paddingVertical: theme.spacing.md, opacity: pressed ? 0.5 : 1 },
                ]}
              >
                <Text variant="label" tone="muted">
                  {t('mailui.conversation.more', { count: item.ids.length })}
                </Text>
              </Pressable>
            ) : (
              <MessageRowSlot
                message={messages.find((message) => message.id === item.id)}
                expanded={item.expanded}
                onLayout={item.id === focusId ? handleFocusLayout : undefined}
                props={props}
                onToggle={() => toggle(item.id)}
              />
            )}
          </Fragment>
        ))}
      </ScrollView>

      <ConversationBar {...props} />
    </Screen>
  );
}

function MessageRowSlot({
  message,
  expanded,
  onLayout,
  onToggle,
  props,
}: {
  message: MailMessage | undefined;
  expanded: boolean;
  onLayout: ((event: LayoutChangeEvent) => void) | undefined;
  onToggle: () => void;
  props: ConversationScreenProps;
}) {
  if (!message) return null;
  return (
    <View onLayout={onLayout}>
      <MessageCard
        message={message}
        mailbox={props.mailboxes.find((box) => box.id === message.mailAccountId) ?? null}
        own={props.own}
        expanded={expanded}
        onToggle={onToggle}
        onOpenAttachment={props.onOpenAttachment}
        onReload={props.onReload}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bundle: { alignItems: 'center' },
});
