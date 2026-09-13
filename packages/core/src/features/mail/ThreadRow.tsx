import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MailFolderRole } from '@/db/types';
import { useI18n, type Translate } from '@/i18n';
import { useTheme } from '@/theme';
import {
  Checkbox,
  ContextMenu,
  HIT_TARGET,
  Icon,
  ROW_MIN_HEIGHT,
  SwipeRow,
  Text,
  measureAnchor,
  type IconName,
  type MenuAnchor,
  type MenuEntry,
  type SwipeAction,
} from '@/ui';

import { firstNameOf } from './conversation';
import { senderName } from './format';
import type { MailThread, SwipeAway } from './threads';
import { listTime } from './time';

export type ThreadCommand =
  | 'open'
  | 'toggle'
  | 'select'
  | 'seen'
  | 'unseen'
  | 'flag'
  | 'unflag'
  | 'archive'
  | 'delete'
  | 'purge'
  | 'reply'
  | 'forward'
  | 'move'
  | 'spam';

export type PreviewLines = 0 | 1 | 2;

/** Der Ungelesen-Punkt, 10 gross, in einer Spalte von 20. */
const DOT_SIZE = 10;
const FLAG_SIZE = 12;

/** In „Gesendet“ und „Entwürfe“ steht vorne, an wen es ging. */
export function threadSender(thread: MailThread, role: MailFolderRole, t: Translate): string {
  const { latest } = thread;
  if (role === 'sent' || role === 'drafts') {
    const names = latest.to.map(firstNameOf).filter((name) => name.length > 0);
    return names.length > 0
      ? t('mailui.row.to', { names: names.join(', ') })
      : t('mailui.row.noRecipients');
  }
  return senderName(latest.from) || t('mail.unknownSender');
}

type MenuOptions = { canSpam: boolean; swipeAway: SwipeAway; full: boolean };

/**
 * Die Punkte beim langen Druck (`full`) und hinter „Mehr“: Antworten,
 * Weiterleiten, Markieren, Verschieben — dazu Gelesen, Archivieren und
 * Löschen beim langen Druck, Spam hinter „Mehr“.
 */
export function threadMenu(
  thread: MailThread,
  options: MenuOptions,
  t: Translate,
  run: (command: ThreadCommand) => void,
): MenuEntry[] {
  const item = (
    command: ThreadCommand,
    label: string,
    icon: IconName,
    destructive = false,
  ): MenuEntry => ({ key: command, label, icon, destructive, onPress: () => run(command) });

  const away =
    options.swipeAway === 'archive'
      ? [item('archive', t('mailui.action.archive'), 'briefcase')]
      : [];
  const remove =
    options.swipeAway === 'purge'
      ? item('purge', t('mailui.action.purge'), 'trash', true)
      : item('delete', t('mailui.action.delete'), 'trash', true);

  return [
    item('reply', t('mailui.action.reply'), 'reply'),
    item('forward', t('mailui.action.forward'), 'send'),
    ...(options.full
      ? [
          thread.unread
            ? item('seen', t('mailui.action.markRead'), 'mailOpen')
            : item('unseen', t('mailui.action.markUnread'), 'mail'),
        ]
      : []),
    thread.flagged
      ? item('unflag', t('mailui.action.unflag'), 'flag')
      : item('flag', t('mailui.action.flag'), 'flagFilled'),
    item('move', t('mailui.action.move'), 'repeat'),
    ...(!options.full && options.canSpam ? [item('spam', t('mailui.action.spam'), 'warning')] : []),
    ...(options.full ? [...away, remove] : []),
  ];
}

export type ThreadRowProps = {
  thread: MailThread;
  role: MailFolderRole;
  swipeAway: SwipeAway;
  canSpam: boolean;
  /** Nur im Sammel-Posteingang mit mehr als einem Postfach: „gmx“. */
  mailboxLabel: string | null;
  previewLines: PreviewLines;
  selecting: boolean;
  checked: boolean;
  onCommand: (command: ThreadCommand) => void;
  /** „Mehr“ im Wisch: das Menue gehoert der Liste, die Zeile sagt nur, wo sie steht. */
  onMore: (anchor: MenuAnchor) => void;
};

/**
 * Eine Unterhaltung in der Liste, gezeigt mit ihrer neuesten Nachricht. Kein
 * Bild links: die Spalte traegt nur den Punkt fuer ungelesen und die Fahne.
 */
export function ThreadRow({
  thread,
  role,
  swipeAway,
  canSpam,
  mailboxLabel,
  previewLines,
  selecting,
  checked,
  onCommand,
  onMore,
}: ThreadRowProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const node = useRef<View>(null);

  const { latest } = thread;
  const sender = threadSender(thread, role, t);
  const subject = latest.subject.trim() || t('mail.noSubject');
  const time = listTime(language, latest.date, t('day.yesterday'));
  const label = t(thread.unread ? 'mailui.row.labelUnread' : 'mailui.row.label', {
    sender,
    subject,
    time,
  });

  async function openMore() {
    const anchor = await measureAnchor(node.current);
    if (anchor) onMore(anchor);
  }

  const body = (
    <RowBody
      thread={thread}
      sender={sender}
      subject={subject}
      time={time}
      mailboxLabel={mailboxLabel}
      previewLines={previewLines}
      selecting={selecting}
      checked={checked}
    />
  );

  if (selecting) {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onCommand('toggle')}
        style={({ pressed }) => ({
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.background,
        })}
      >
        {body}
      </Pressable>
    );
  }

  const leading: SwipeAction = thread.unread
    ? {
        key: 'seen',
        label: t('mailui.action.read'),
        icon: 'mailOpen',
        tone: 'accent',
        onPress: () => onCommand('seen'),
      }
    : {
        key: 'unseen',
        label: t('mailui.action.unread'),
        icon: 'mail',
        tone: 'accent',
        onPress: () => onCommand('unseen'),
      };
  const removeAction: SwipeAction =
    swipeAway === 'purge'
      ? {
          key: 'purge',
          label: t('mailui.action.purge'),
          icon: 'trash',
          tone: 'danger',
          onPress: () => onCommand('purge'),
        }
      : {
          key: 'delete',
          label: t('mailui.action.delete'),
          icon: 'trash',
          tone: 'danger',
          onPress: () => onCommand('delete'),
        };
  const away: SwipeAction =
    swipeAway === 'archive'
      ? {
          key: 'archive',
          label: t('mailui.action.archive'),
          icon: 'briefcase',
          tone: 'accent',
          onPress: () => onCommand('archive'),
        }
      : removeAction;
  const more: SwipeAction = {
    key: 'more',
    label: t('mailui.action.more'),
    icon: 'lines',
    tone: 'default',
    onPress: () => void openMore(),
  };

  return (
    <SwipeRow
      leading={leading}
      trailing={[more, removeAction]}
      trailingFull={away}
      backgroundColor={theme.colors.background}
    >
      <View ref={node} collapsable={false}>
        <ContextMenu
          items={threadMenu(thread, { canSpam, swipeAway, full: true }, t, onCommand)}
          onPress={() => onCommand('open')}
          onSelectMode={() => onCommand('select')}
          accessibilityLabel={label}
        >
          {body}
        </ContextMenu>
      </View>
    </SwipeRow>
  );
}

function RowBody({
  thread,
  sender,
  subject,
  time,
  mailboxLabel,
  previewLines,
  selecting,
  checked,
}: {
  thread: MailThread;
  sender: string;
  subject: string;
  time: string;
  mailboxLabel: string | null;
  previewLines: PreviewLines;
  selecting: boolean;
  checked: boolean;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const preview = thread.latest.snippet.trim();
  const showPreview = previewLines > 0;

  const mailbox = mailboxLabel ? (
    <Text variant="caption" tone="faint" numberOfLines={1}>
      {mailboxLabel}
    </Text>
  ) : null;

  return (
    <View
      style={[
        styles.row,
        {
          minHeight: showPreview ? ROW_MIN_HEIGHT.three : ROW_MIN_HEIGHT.two,
          paddingVertical: theme.spacing.sm,
          paddingRight: theme.spacing.edge,
          gap: theme.spacing.xs,
        },
      ]}
    >
      <View
        style={[
          styles.status,
          {
            width: selecting ? HIT_TARGET : theme.spacing.edge,
            gap: theme.spacing.xs,
            paddingTop: selecting ? 0 : (theme.lineHeight.md - DOT_SIZE) / 2,
          },
        ]}
      >
        {selecting ? (
          <Checkbox checked={checked} />
        ) : (
          <>
            {thread.unread ? (
              <View
                accessibilityLabel={t('mailui.row.unread')}
                style={{
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  borderRadius: theme.radii.pill,
                  backgroundColor: theme.colors.accent,
                }}
              />
            ) : null}
            {thread.flagged ? (
              <View accessible accessibilityLabel={t('mail.row.flagged')}>
                <Icon name="flagFilled" size={FLAG_SIZE} color={theme.colors.textMuted} />
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={[styles.grow, { gap: 1 }]}>
        <View style={[styles.line, { gap: theme.spacing.xs }]}>
          <Text
            variant="body"
            numberOfLines={1}
            style={[
              styles.shrink,
              {
                fontWeight: thread.unread ? theme.fontWeight.semibold : theme.fontWeight.regular,
              },
            ]}
          >
            {sender}
          </Text>
          {thread.count > 1 ? (
            <View
              style={[
                styles.capsule,
                {
                  borderColor: theme.colors.borderStrong,
                  borderRadius: theme.radii.xs,
                  paddingHorizontal: theme.spacing.xs,
                },
              ]}
            >
              <Text variant="caption" tone="muted">
                {String(thread.count)}
              </Text>
            </View>
          ) : null}
          <View style={styles.grow} />
          <Text variant="caption" tone="faint">
            {time}
          </Text>
        </View>

        <View style={[styles.line, { gap: theme.spacing.xs }]}>
          <Text variant="body" numberOfLines={1} style={styles.grow}>
            {subject}
          </Text>
          {thread.hasAttachments ? (
            <View accessible accessibilityLabel={t('mail.row.attachments')}>
              <Icon name="attach" size={14} color={theme.colors.textFaint} />
            </View>
          ) : null}
          {!showPreview ? mailbox : null}
        </View>

        {showPreview ? (
          <View style={[styles.line, styles.top, { gap: theme.spacing.sm }]}>
            <Text variant="body" tone="muted" numberOfLines={previewLines} style={styles.grow}>
              {preview.length > 0 ? preview : t('mailui.row.noPreview')}
            </Text>
            {mailbox}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  status: { alignItems: 'center' },
  line: { flexDirection: 'row', alignItems: 'center' },
  top: { alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  capsule: { borderWidth: StyleSheet.hairlineWidth },
});
