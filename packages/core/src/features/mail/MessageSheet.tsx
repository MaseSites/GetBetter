import { useEffect, useRef, useState } from 'react';
import { Text as NativeText, StyleSheet, View } from 'react-native';

import { mail, type MailError } from '@/db/mail';
import type { MailAccountRow, MailMessageRow } from '@/db/types';
import { formatLongDate, formatTime, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Divider, Sheet, Text } from '@/ui';

import {
  formatAddress,
  listDateKind,
  mailErrorKey,
  replyDraft,
  senderName,
  type ComposeDraft,
} from './format';

type Action = 'unread' | 'delete';

export type MessageSheetProps = {
  visible: boolean;
  message: MailMessageRow | null;
  mailbox: MailAccountRow | null;
  onClose: () => void;
  onReply: (draft: ComposeDraft) => void;
};

/**
 * Eine E-Mail ganz: Kopf, Text zum Markieren, darunter Antworten, als ungelesen
 * markieren und Loeschen. Wer sie oeffnet, hat sie gelesen.
 */
export function MessageSheet({ visible, message, mailbox, onClose, onReply }: MessageSheetProps) {
  const { t, language } = useI18n();
  const theme = useTheme();

  // Fehler und Laden gehoeren zu einer bestimmten Nachricht — so muss nichts zurueckgesetzt werden.
  const [failure, setFailure] = useState<{ id: string; error: MailError } | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null);

  const messageId = message?.id ?? null;
  const unseen = message ? !message.seen : false;

  // Einmal je Oeffnen als gelesen markieren — nicht erneut, nachdem man sie
  // bewusst wieder auf ungelesen gesetzt hat.
  const marked = useRef<string | null>(null);
  useEffect(() => {
    if (!visible || !messageId) {
      marked.current = null;
      return;
    }
    if (marked.current === messageId) return;
    marked.current = messageId;
    if (!unseen) return;
    void mail.setSeen(messageId, true).then((result) => {
      if (!result.ok) setFailure({ id: messageId, error: result.error });
    });
  }, [visible, messageId, unseen]);

  const subject = message?.subject.trim() || t('mail.noSubject');
  // Ein kaputtes Datum wuerde Intl zum Werfen bringen.
  const hasDate = message ? listDateKind(message.date) !== 'none' : false;

  async function run(action: Action) {
    if (!message || busy) return;
    const id = message.id;
    setBusy({ id, action });
    setFailure(null);
    const result = action === 'delete' ? await mail.remove(id) : await mail.setSeen(id, false);
    setBusy(null);
    if (!result.ok) {
      setFailure({ id, error: result.error });
      return;
    }
    onClose();
  }

  function reply() {
    if (!message) return;
    const name = senderName(message.from) || t('mail.unknownSender');
    const header = hasDate
      ? t('mail.quoteHeader', {
          date: t('mail.message.dateAt', {
            date: formatLongDate(language, message.date),
            time: formatTime(language, message.date),
          }),
          name,
        })
      : t('mail.quoteHeaderNoDate', { name });
    onReply(replyDraft(message, header));
  }

  const error = failure && message && failure.id === message.id ? failure.error : null;
  const working = busy && message && busy.id === message.id ? busy.action : null;

  return (
    <Sheet visible={visible} onClose={onClose} title={subject} fullScreen>
      {message ? (
        <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
          <View style={{ gap: theme.spacing.sm }}>
            <MetaRow label={t('mail.message.from')} value={formatAddress(message.from)} />
            {message.to.length > 0 ? (
              <MetaRow
                label={t('mail.message.to')}
                value={message.to.map(formatAddress).join(', ')}
              />
            ) : null}
            {message.cc.length > 0 ? (
              <MetaRow
                label={t('mail.message.cc')}
                value={message.cc.map(formatAddress).join(', ')}
              />
            ) : null}
            {hasDate ? (
              <MetaRow
                label={t('mail.message.date')}
                value={t('mail.message.dateAt', {
                  date: formatLongDate(language, message.date),
                  time: formatTime(language, message.date),
                })}
              />
            ) : null}
            {mailbox ? <MetaRow label={t('mail.message.mailbox')} value={mailbox.email} /> : null}
          </View>

          <Divider />

          {message.text.trim().length > 0 ? (
            <NativeText
              selectable
              style={{
                fontFamily: theme.fontFamily,
                fontSize: theme.fontSize.md,
                lineHeight: theme.lineHeight.md,
                color: theme.colors.text,
              }}
            >
              {message.text}
            </NativeText>
          ) : (
            <Text variant="body" tone="faint">
              {t('mail.message.empty')}
            </Text>
          )}

          {error ? (
            <Text variant="label" tone="danger">
              {t(mailErrorKey(error))}
            </Text>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label={t('mail.message.reply')}
              icon="reply"
              onPress={reply}
              disabled={working !== null}
            />
            <Button
              label={t('mail.message.markUnread')}
              icon="mail"
              variant="secondary"
              onPress={() => void run('unread')}
              loading={working === 'unread'}
              disabled={working === 'delete'}
            />
            <Button
              label={t('mail.message.delete')}
              icon="trash"
              variant="danger"
              onPress={() => void run('delete')}
              loading={working === 'delete'}
              disabled={working === 'unread'}
            />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

/** Eine Zeile im Kopf: kleine Beschriftung links, der Wert daneben. */
function MetaRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.meta, { gap: theme.spacing.md }]}>
      <Text variant="label" tone="faint" style={{ width: theme.spacing.xxl * 2 }}>
        {label}
      </Text>
      <NativeText
        selectable
        style={[
          styles.metaValue,
          {
            fontFamily: theme.fontFamily,
            fontSize: theme.fontSize.sm,
            lineHeight: theme.lineHeight.sm,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.text,
          },
        ]}
      >
        {value}
      </NativeText>
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'flex-start' },
  metaValue: { flex: 1 },
});
