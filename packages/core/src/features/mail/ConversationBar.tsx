import { useRef, useState } from 'react';
import type { View } from 'react-native';

import { useI18n } from '@/i18n';
import { Menu, measureAnchor, type MenuAnchor, type MenuEntry } from '@/ui';

import { BarButton, BottomBar } from './MailChrome';

export type ConversationBarProps = {
  canArchive: boolean;
  /** Im Papierkorb heisst Löschen endgültig. */
  inTrash: boolean;
  flagged: boolean;
  onArchive: () => void;
  onMove: () => void;
  onReply: (all: boolean) => void;
  onForward: () => void;
  onFlag: () => void;
  onUnread: () => void;
  onDelete: () => void;
};

type Open = { which: 'reply' | 'mark'; anchor: MenuAnchor; open: boolean };

/**
 * Die Leiste unter der Unterhaltung: Archivieren · Verschieben · Antworten ·
 * Markieren · Löschen. Langer Druck auf Antworten zeigt Allen antworten und
 * Weiterleiten; Markieren fragt Fahne oder ungelesen.
 */
export function ConversationBar(props: ConversationBarProps) {
  const { t } = useI18n();
  const reply = useRef<View>(null);
  const mark = useRef<View>(null);
  const [menu, setMenu] = useState<Open | null>(null);

  async function open(which: Open['which']) {
    const anchor = await measureAnchor((which === 'reply' ? reply : mark).current);
    if (anchor) setMenu({ which, anchor, open: true });
  }

  const items: MenuEntry[] =
    menu?.which === 'reply'
      ? [
          {
            key: 'replyAll',
            label: t('mailui.action.replyAll'),
            icon: 'reply',
            onPress: () => props.onReply(true),
          },
          {
            key: 'forward',
            label: t('mailui.action.forward'),
            icon: 'send',
            onPress: props.onForward,
          },
        ]
      : [
          {
            key: 'flag',
            label: props.flagged ? t('mailui.action.unflag') : t('mailui.action.flag'),
            icon: props.flagged ? 'flag' : 'flagFilled',
            onPress: props.onFlag,
          },
          {
            key: 'unread',
            label: t('mailui.action.markUnread'),
            icon: 'mail',
            onPress: props.onUnread,
          },
        ];

  return (
    <>
      <BottomBar>
        {props.canArchive ? (
          <BarButton
            label={t('mailui.action.archive')}
            icon="briefcase"
            onPress={props.onArchive}
          />
        ) : null}
        <BarButton label={t('mailui.action.move')} icon="repeat" onPress={props.onMove} />
        <BarButton
          ref={reply}
          label={t('mailui.action.reply')}
          icon="reply"
          onPress={() => props.onReply(false)}
          onLongPress={() => void open('reply')}
        />
        <BarButton
          ref={mark}
          label={t('mailui.action.mark')}
          icon={props.flagged ? 'flagFilled' : 'flag'}
          onPress={() => void open('mark')}
        />
        <BarButton
          label={props.inTrash ? t('mailui.action.purge') : t('mailui.action.delete')}
          icon="trash"
          danger
          onPress={props.onDelete}
        />
      </BottomBar>
      <Menu
        visible={menu?.open ?? false}
        anchor={menu?.anchor ?? null}
        prefer="above"
        align="end"
        items={items}
        onClose={() => setMenu((current) => (current ? { ...current, open: false } : null))}
      />
    </>
  );
}
