import { useState } from 'react';
import { Text as NativeText, Pressable, StyleSheet, View } from 'react-native';

import type { MailMessage } from '@/db/mail';
import type { MailAccountRow } from '@/db/types';
import { formatLongDate, formatTime, useI18n, type Translate } from '@/i18n';
import { useTheme } from '@/theme';
import { Avatar, Icon, Text } from '@/ui';

import { AttachmentGrid } from './AttachmentGrid';
import { recipientLabels } from './conversation';
import { formatAddress, listDateKind, senderName } from './format';
import { MessageBody } from './MessageBody';
import { listTime } from './time';
import { useMailBody } from './useMailBody';

/** Das Bild im Kopf einer Nachricht: hier unterscheidet es die Beteiligten. */
const AVATAR_SIZE = 36;

export type MessageCardProps = {
  message: MailMessage;
  mailbox: MailAccountRow | null;
  own: ReadonlySet<string>;
  expanded: boolean;
  onToggle: () => void;
  onOpenAttachment: (message: MailMessage, index: number) => void;
  onReload: () => void;
};

function recipientsLine(message: MailMessage, own: ReadonlySet<string>, t: Translate): string {
  const names = recipientLabels(message, own).map((entry) =>
    entry.me ? t('mailui.message.me') : entry.name,
  );
  return names.length > 0
    ? t('mailui.message.toList', { names: names.join(', ') })
    : t('mailui.message.noRecipients');
}

/**
 * Eine Nachricht der Unterhaltung. Zugeklappt eine Zeile (Absender · Anfang ·
 * Zeit), aufgeklappt mit Bild, „an mich, Luca ▾“, Text und Anhaengen.
 */
export function MessageCard(props: MessageCardProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { message, expanded, onToggle } = props;

  const name = senderName(message.from) || t('mail.unknownSender');
  const time = listTime(language, message.date, t('day.yesterday'));

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityLabel={t('mailui.message.expand', { name, time })}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.row,
          { gap: theme.spacing.sm, paddingVertical: theme.spacing.md, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text
          variant="body"
          numberOfLines={1}
          style={[
            styles.name,
            { fontWeight: message.seen ? theme.fontWeight.regular : theme.fontWeight.semibold },
          ]}
        >
          {name}
        </Text>
        <Text variant="body" tone="muted" numberOfLines={1} style={styles.grow}>
          {message.snippet.trim()}
        </Text>
        <Text variant="caption" tone="faint">
          {time}
        </Text>
      </Pressable>
    );
  }

  return <ExpandedMessage {...props} name={name} time={time} />;
}

function ExpandedMessage({
  message,
  mailbox,
  own,
  onToggle,
  onOpenAttachment,
  onReload,
  name,
  time,
}: MessageCardProps & { name: string; time: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [details, setDetails] = useState(false);
  const [images, setImages] = useState(false);
  const body = useMailBody(message.id, images);

  const recipients = recipientsLine(message, own, t);
  const hasDate = listDateKind(message.date) !== 'none';

  return (
    <View style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: true }}
        accessibilityLabel={t('mailui.message.collapse', { name, time })}
        onPress={onToggle}
        style={({ pressed }) => [styles.row, { gap: theme.spacing.md, opacity: pressed ? 0.6 : 1 }]}
      >
        <Avatar name={name} size={AVATAR_SIZE} />
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.grow, { fontWeight: theme.fontWeight.semibold }]}
        >
          {name}
        </Text>
        <Text variant="caption" tone="faint">
          {time}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: details }}
        accessibilityLabel={recipients}
        onPress={() => setDetails((open) => !open)}
        style={({ pressed }) => [
          styles.row,
          styles.start,
          {
            gap: theme.spacing.xs,
            marginLeft: AVATAR_SIZE + theme.spacing.md,
            opacity: pressed ? 0.5 : 1,
          },
        ]}
      >
        <Text variant="label" tone="muted" numberOfLines={1} style={styles.shrink}>
          {recipients}
        </Text>
        <View style={details ? styles.flip : undefined}>
          <Icon name="down" size={14} color={theme.colors.textMuted} />
        </View>
      </Pressable>

      {details ? (
        <View
          style={{
            gap: theme.spacing.xs,
            padding: theme.spacing.md,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <Detail label={t('mail.message.from')} value={formatAddress(message.from)} />
          {message.to.length > 0 ? (
            <Detail label={t('mail.message.to')} value={message.to.map(formatAddress).join(', ')} />
          ) : null}
          {message.cc.length > 0 ? (
            <Detail label={t('mail.message.cc')} value={message.cc.map(formatAddress).join(', ')} />
          ) : null}
          {hasDate ? (
            <Detail
              label={t('mail.message.date')}
              value={t('mail.message.dateAt', {
                date: formatLongDate(language, message.date),
                time: formatTime(language, message.date),
              })}
            />
          ) : null}
          {mailbox ? <Detail label={t('mail.message.mailbox')} value={mailbox.email} /> : null}
        </View>
      ) : null}

      <MessageBody
        message={message}
        state={body}
        images={images}
        onLoadImages={() => setImages(true)}
      />

      <AttachmentGrid
        message={message}
        hidden={body.body?.inlineAttachments ?? []}
        onOpen={(index) => onOpenAttachment(message, index)}
        onReload={onReload}
      />
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.start, { gap: theme.spacing.sm }]}>
      <Text variant="label" tone="faint" style={{ width: theme.spacing.xxl * 2 }}>
        {label}
      </Text>
      <NativeText
        selectable
        style={[
          styles.grow,
          {
            fontFamily: theme.fontFamily,
            fontSize: theme.fontSize.sm,
            lineHeight: theme.lineHeight.sm,
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
  row: { flexDirection: 'row', alignItems: 'center' },
  start: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  name: { flexShrink: 0, maxWidth: '45%' },
  flip: { transform: [{ rotate: '180deg' }] },
});
