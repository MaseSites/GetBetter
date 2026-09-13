import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mailErrorOf } from '@/db/mail';
import type { MailAccountRow } from '@/db/types';
import { useI18n, type TranslationKey, type Translate } from '@/i18n';
import { useTheme } from '@/theme';
import {
  FLOATING_BUTTON_SIZE,
  HIT_TARGET,
  Icon,
  Menu,
  Text,
  measureAnchor,
  type MenuAnchor,
} from '@/ui';

import { BarButton, BottomBar, RoundButton } from './MailChrome';
import { MAIL_LIST_FILTERS, mailboxDomain, type MailListFilter } from './threads';

/** „gmx.ch: Anmeldung abgelehnt“ — oder, bei anderen Fehlern, dass der Abgleich scheiterte. */
export function problemText(mailbox: MailAccountRow, t: Translate): string {
  const domain = mailboxDomain(mailbox.email);
  return mailErrorOf(mailbox.lastError) === 'auth_failed'
    ? t('mailui.status.authFailed', { domain })
    : t('mailui.status.syncFailed', { domain });
}

export const FILTER_KEYS: Readonly<Record<MailListFilter, TranslationKey>> = {
  unread: 'mailui.filter.unread',
  flagged: 'mailui.filter.flagged',
  attachments: 'mailui.filter.attachments',
  toMe: 'mailui.filter.toMe',
  today: 'mailui.filter.today',
};

/** Was eine gefilterte, leere Liste sagt: „Keine ungelesenen E-Mails“. */
export const FILTER_EMPTY_KEYS: Readonly<Record<MailListFilter, TranslationKey>> = {
  unread: 'mailui.empty.unread',
  flagged: 'mailui.empty.flagged',
  attachments: 'mailui.empty.attachments',
  toMe: 'mailui.empty.toMe',
  today: 'mailui.empty.today',
};

/** Eine Zeile unter dem Titel: laedt, offline, abgelehnt · Beheben. */
export function StatusLine({
  text,
  actionLabel,
  onPress,
  danger = false,
}: {
  text: string;
  actionLabel?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();
  const content = (
    <View
      style={[
        styles.line,
        {
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radii.sm,
          backgroundColor: danger ? theme.colors.dangerSoft : theme.colors.surfaceMuted,
        },
      ]}
    >
      <Text
        variant="label"
        tone={danger ? 'danger' : 'muted'}
        numberOfLines={2}
        style={styles.grow}
      >
        {text}
      </Text>
      {actionLabel ? (
        <Text
          variant="label"
          tone={danger ? 'danger' : 'default'}
          style={{ fontWeight: theme.fontWeight.semibold }}
        >
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return <View accessibilityRole="alert">{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={actionLabel ? `${text}, ${actionLabel}` : text}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}

/**
 * Unten links der runde Filter-Knopf, unten mittig die Pille des aktiven
 * Filters. Beide liegen ueber der Liste, auf der Hoehe des Knopfs rechts.
 */
export function FilterControls({
  filter,
  onFilter,
}: {
  filter: MailListFilter | null;
  onFilter: (filter: MailListFilter | null) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const node = useRef<View>(null);
  const [menu, setMenu] = useState<{ anchor: MenuAnchor; open: boolean } | null>(null);

  const bottom = theme.spacing.lg + insets.bottom + (FLOATING_BUTTON_SIZE - HIT_TARGET) / 2;

  async function open() {
    const anchor = await measureAnchor(node.current);
    if (anchor) setMenu({ anchor, open: true });
  }

  return (
    <>
      {filter ? (
        <View style={[styles.pillHost, { bottom }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mailui.filter.clearNamed', { filter: t(FILTER_KEYS[filter]) })}
            onPress={() => onFilter(null)}
            style={({ pressed }) => [
              styles.line,
              theme.elevation.raised,
              {
                minHeight: HIT_TARGET,
                gap: theme.spacing.xs,
                paddingHorizontal: theme.spacing.lg,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.inverse,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text variant="label" style={{ color: theme.colors.onInverse }}>
              {t(FILTER_KEYS[filter])}
            </Text>
            <Icon name="close" size={16} color={theme.colors.onInverse} />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.filterHost, { left: theme.spacing.lg, bottom }]}>
        <RoundButton
          ref={node}
          label={t('mailui.filter.title')}
          icon="settings"
          filled
          onPress={() => void open()}
        />
      </View>

      <Menu
        visible={menu?.open ?? false}
        anchor={menu?.anchor ?? null}
        prefer="above"
        accessibilityLabel={t('mailui.filter.title')}
        items={MAIL_LIST_FILTERS.map((entry) => ({
          key: entry,
          label: t(FILTER_KEYS[entry]),
          selected: entry === filter,
          onPress: () => onFilter(entry === filter ? null : entry),
        }))}
        onClose={() => setMenu((current) => (current ? { ...current, open: false } : null))}
      />
    </>
  );
}

/** Unten beim Auswaehlen: Archivieren · Gelesen · Verschieben · Löschen. */
export function SelectionBar({
  count,
  canArchive,
  purge,
  onArchive,
  onRead,
  onMove,
  onDelete,
}: {
  count: number;
  canArchive: boolean;
  /** Im Papierkorb heisst Löschen endgültig. */
  purge: boolean;
  onArchive: () => void;
  onRead: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const off = count === 0;
  return (
    <BottomBar>
      {canArchive ? (
        <BarButton
          label={t('mailui.action.archive')}
          icon="briefcase"
          disabled={off}
          onPress={onArchive}
        />
      ) : null}
      <BarButton label={t('mailui.action.read')} icon="mailOpen" disabled={off} onPress={onRead} />
      <BarButton label={t('mailui.action.move')} icon="repeat" disabled={off} onPress={onMove} />
      <BarButton
        label={purge ? t('mailui.action.purge') : t('mailui.action.delete')}
        icon="trash"
        danger
        disabled={off}
        onPress={onDelete}
      />
    </BottomBar>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  filterHost: { position: 'absolute' },
  pillHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
});
