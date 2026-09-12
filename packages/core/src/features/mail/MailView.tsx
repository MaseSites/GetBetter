import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { mail, useLiveQuery } from '@/db';
import type { MailError } from '@/db/mail';
import type { MailAccountRow, MailMessageRow } from '@/db/types';
import {
  formatShortDate,
  formatTime,
  formatWeekdayLong,
  useI18n,
  type Language,
  type Translate,
} from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Header,
  Icon,
  Loading,
  Screen,
  SwipeRow,
  Text,
  type HeaderAction,
} from '@/ui';

import { AccountsSheet } from './AccountsSheet';
import { ComposeSheet } from './ComposeSheet';
import { emptyDraft, listDateKind, mailErrorKey, senderName, type ComposeDraft } from './format';
import { MessageSheet } from './MessageSheet';

/** Das offene Blatt behaelt seine Nachricht, bis es ganz zu ist. */
type Reading = { id: string; open: boolean };
/** Ein neuer Schluessel je Oeffnen: dann beginnt das Formular mit dem Entwurf. */
type Compose = { open: boolean; key: number; draft: ComposeDraft };

/** Wann eine Nachricht kam: heute die Uhrzeit, gestern, der Wochentag, sonst das Datum. */
function whenOf(iso: string, t: Translate, language: Language): string {
  switch (listDateKind(iso)) {
    case 'time':
      return formatTime(language, iso);
    case 'yesterday':
      return t('day.yesterday');
    case 'weekday':
      return formatWeekdayLong(language, new Date(iso));
    case 'date':
      return formatShortDate(language, iso);
    case 'none':
      return '';
  }
}

/**
 * Der zentrale Posteingang: alle verbundenen Postfaecher in einer Liste, die
 * neueste Nachricht zuerst. Beim Oeffnen wird einmal abgeglichen; ein Wisch
 * nach links loescht, ein Tipp oeffnet die Nachricht.
 */
export function MailView({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [filter, setFilter] = useState<string | null>(null);
  // Der Bildschirm gleicht beim Oeffnen ab — deshalb beginnt er ladend.
  const [syncing, setSyncing] = useState(true);
  const [failure, setFailure] = useState<MailError | null>(null);
  const [sent, setSent] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [compose, setCompose] = useState<Compose>({
    open: false,
    key: 0,
    draft: emptyDraft(null),
  });

  const boxes = useLiveQuery(() => mail.accounts(account.id), [account.id]);
  const mailboxes = boxes.data ?? [];
  const loaded = boxes.data !== undefined;
  // Ein Filter auf ein getrenntes Postfach faellt auf „Alle“ zurueck.
  const activeBox = filter ? (mailboxes.find((box) => box.id === filter) ?? null) : null;
  const activeId = activeBox?.id ?? null;

  const list = useLiveQuery(() => mail.messages(account.id, activeId), [account.id, activeId]);
  const messages = list.data ?? [];

  const unread = messages.filter((row) => !row.seen).length;
  const failing = mailboxes.filter((box) => box.lastError).length;
  const showMailbox = activeBox === null && mailboxes.length > 1;
  const readingMessage = reading ? (messages.find((row) => row.id === reading.id) ?? null) : null;
  const readingBox = readingMessage
    ? (mailboxes.find((box) => box.id === readingMessage.mailAccountId) ?? null)
    : null;

  useEffect(() => {
    let cancelled = false;
    void mail.sync(account.id).then((result) => {
      if (cancelled) return;
      setSyncing(false);
      setFailure(result.ok ? null : result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setSent(false);
    const result = await mail.sync(account.id);
    setSyncing(false);
    setFailure(result.ok ? null : result.error);
  }

  async function removeMessage(id: string) {
    const result = await mail.remove(id);
    setFailure(result.ok ? null : result.error);
  }

  function openCompose(draft: ComposeDraft) {
    setSent(false);
    setCompose((previous) => ({ open: true, key: previous.key + 1, draft }));
  }

  function closeCompose() {
    setCompose((previous) => ({ ...previous, open: false }));
  }

  function closeReading() {
    setReading((previous) => (previous ? { ...previous, open: false } : previous));
  }

  function subtitle(): string | undefined {
    if (syncing) return t('mail.syncing');
    if (mailboxes.length === 0) return undefined;
    if (unread > 0) return t('mail.unread', { count: unread });
    return activeBox ? activeBox.email : t('mail.allMailboxes');
  }

  const actions: HeaderAction[] = [
    ...(mailboxes.length > 0
      ? [
          {
            icon: 'refresh' as const,
            label: t('mail.refresh'),
            onPress: () => void syncNow(),
            active: syncing,
          },
        ]
      : []),
    { icon: 'at', label: t('mail.mailboxes'), onPress: () => setAccountsOpen(true) },
  ];

  const footer = !loaded ? null : mailboxes.length === 0 ? (
    <Button label={t('mail.connect')} icon="plus" onPress={() => setAccountsOpen(true)} />
  ) : (
    <Button
      label={t('mail.new')}
      icon="plus"
      onPress={() => openCompose(emptyDraft(activeId ?? mailboxes[0]?.id ?? null))}
    />
  );

  const subtitleText = subtitle();

  return (
    <Screen
      header={
        <Header
          title={module.name}
          {...(subtitleText ? { subtitle: subtitleText } : {})}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          actions={actions}
        />
      }
      footer={footer}
    >
      {!loaded ? <Loading /> : null}

      {failure ? <Notice text={t(mailErrorKey(failure))} /> : null}
      {failing > 0 ? (
        <Notice
          text={
            failing === 1 ? t('mail.syncFailed.one') : t('mail.syncFailed.many', { count: failing })
          }
          onPress={() => setAccountsOpen(true)}
        />
      ) : null}
      {sent ? (
        <Text variant="label" tone="accent">
          {t('mail.sent')}
        </Text>
      ) : null}

      {loaded && mailboxes.length === 0 ? (
        <EmptyState title={t('mail.empty.title')} body={t('mail.empty.body')} />
      ) : null}

      {mailboxes.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chips}
          contentContainerStyle={{ gap: theme.spacing.sm }}
        >
          <Chip
            label={t('mail.filter.all')}
            selected={activeBox === null}
            onPress={() => setFilter(null)}
          />
          {mailboxes.map((box) => (
            <Chip
              key={box.id}
              label={box.email}
              selected={box.id === activeId}
              onPress={() => setFilter(box.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {mailboxes.length > 0 && messages.length === 0 ? (
        syncing || list.loading ? (
          <Loading />
        ) : (
          <EmptyState title={t('mail.inbox.empty.title')} body={t('mail.inbox.empty.body')} />
        )
      ) : null}

      {mailboxes.length > 0 && messages.length > 0 ? (
        <Card>
          <View>
            {messages.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow onDelete={() => void removeMessage(row.id)}>
                  <MessageRow
                    message={row}
                    mailbox={
                      showMailbox
                        ? (mailboxes.find((box) => box.id === row.mailAccountId) ?? null)
                        : null
                    }
                    onPress={() => setReading({ id: row.id, open: true })}
                  />
                </SwipeRow>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <MessageSheet
        visible={reading?.open === true && readingMessage !== null}
        message={readingMessage}
        mailbox={readingBox}
        onClose={closeReading}
        onReply={(draft) => {
          closeReading();
          openCompose(draft);
        }}
      />
      <ComposeSheet
        visible={compose.open}
        draft={compose.draft}
        draftKey={compose.key}
        mailboxes={mailboxes}
        onClose={closeCompose}
        onSent={() => {
          closeCompose();
          setSent(true);
        }}
      />
      <AccountsSheet
        visible={accountsOpen}
        mailboxes={mailboxes}
        onClose={() => setAccountsOpen(false)}
      />
    </Screen>
  );
}

type MessageRowProps = {
  message: MailMessageRow;
  /** Nur in „Alle“ mit mehreren Postfaechern: wohin die Nachricht kam. */
  mailbox: MailAccountRow | null;
  onPress: () => void;
};

/** Punkt fuer ungelesen, Absender und Zeit, Betreff, zwei Zeilen Vorschau. */
function MessageRow({ message, mailbox, onPress }: MessageRowProps) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const sender = senderName(message.from) || t('mail.unknownSender');
  const subject = message.subject.trim() || t('mail.noSubject');
  const unread = !message.seen;
  const snippet = message.snippet.trim();
  const dot = theme.spacing.sm;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(unread ? 'mail.row.labelUnread' : 'mail.row.label', {
        sender,
        subject,
      })}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { gap: theme.spacing.sm, paddingVertical: theme.spacing.md, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={{ width: dot, marginTop: (theme.lineHeight.md - dot) / 2 }}>
        {unread ? (
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.accent,
            }}
          />
        ) : null}
      </View>
      <View style={[styles.grow, { gap: theme.spacing.xs }]}>
        <View style={[styles.head, { gap: theme.spacing.sm }]}>
          <Text
            variant="body"
            numberOfLines={1}
            style={[
              styles.grow,
              { fontWeight: unread ? theme.fontWeight.bold : theme.fontWeight.medium },
            ]}
          >
            {sender}
          </Text>
          <Text variant="caption" tone="faint">
            {whenOf(message.date, t, language)}
          </Text>
        </View>
        <Text
          variant="label"
          numberOfLines={1}
          style={{ fontWeight: unread ? theme.fontWeight.semibold : theme.fontWeight.regular }}
        >
          {subject}
        </Text>
        {snippet.length > 0 ? (
          <Text variant="label" tone="muted" numberOfLines={2}>
            {snippet}
          </Text>
        ) : null}
        {mailbox ? (
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {mailbox.email}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Ein Fehler oben im Posteingang; mit `onPress` fuehrt er dorthin, wo man ihn behebt. */
function Notice({ text, onPress }: { text: string; onPress?: () => void }) {
  const theme = useTheme();

  const content = (
    <View
      style={[
        styles.row,
        styles.center,
        {
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.dangerSoft,
        },
      ]}
    >
      <Icon name="warning" size={18} color={theme.colors.danger} />
      <Text variant="label" tone="danger" style={styles.grow}>
        {text}
      </Text>
      {onPress ? <Icon name="forward" size={16} color={theme.colors.danger} /> : null}
    </View>
  );

  if (!onPress) {
    return <View accessibilityRole="alert">{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  center: { alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'baseline' },
  grow: { flex: 1, minWidth: 0 },
  // Sonst waechst die waagrechte Leiste im Browser in die Hoehe.
  chips: { flexGrow: 0 },
});
