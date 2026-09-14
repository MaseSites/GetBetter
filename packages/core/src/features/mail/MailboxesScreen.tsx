import { Pressable, StyleSheet, View } from 'react-native';

import { MAIL_FOLDER_ROLES, type MailMessage } from '@/db/mail';
import type { MailAccountRow, MailFolderRole } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, PlainList, PlainRow, Screen, Text, type IconName } from '@/ui';

import { countUnread, FOLDER_LABEL_KEYS, rolesOf } from './format';
import { FOLDER_ICONS } from './icons';
import { problemText, StatusLine } from './InboxParts';
import { TopBar } from './MailChrome';
import { UNIFIED_INBOX, type MailPlace } from './threads';

export type MailboxesScreenProps = {
  mailboxes: readonly MailAccountRow[];
  messages: readonly MailMessage[];
  /** Postfaecher, deren Ordner zugeklappt sind. */
  collapsed: ReadonlySet<string>;
  onToggle: (mailboxId: string) => void;
  onOpen: (place: MailPlace) => void;
  /** „‹“ fuehrt zurueck, woher man kam — aus der E-Mail hinaus. */
  onExit: () => void;
  onManage: () => void;
  onFix: (mailbox: MailAccountRow) => void;
};

/** Die Zahl rechts: ungelesene im Posteingang und Spam, alle in den Entwuerfen. */
function countFor(messages: readonly MailMessage[], mailAccountId: string, role: MailFolderRole) {
  if (role === 'drafts') {
    return messages.filter((row) => row.mailAccountId === mailAccountId && row.folderRole === role)
      .length;
  }
  return role === 'inbox' || role === 'junk' ? countUnread(messages, { mailAccountId, role }) : 0;
}

/**
 * Eine Ebene ueber dem Posteingang: „Alle Posteingänge“, darunter je Postfach
 * seine Ordner. Eine Hierarchie statt Seitenmenue — sie passt zur Tab-Leiste.
 * Ein Tipp auf die Adresse klappt die Ordner dieses Postfachs auf oder zu.
 */
export function MailboxesScreen({
  mailboxes,
  messages,
  collapsed,
  onToggle,
  onOpen,
  onExit,
  onManage,
  onFix,
}: MailboxesScreenProps) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <Screen
      header={<TopBar backAccessibilityLabel={t('common.back')} onBack={onExit} />}
      padded={false}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.edge,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.sm,
        }}
      >
        <Text variant="display" numberOfLines={1}>
          {t('mailui.mailboxes.title')}
        </Text>

        <PlainList>
          <FolderRow
            icon="inbox"
            label={t('mailui.mailboxes.allInboxes')}
            count={countUnread(messages)}
            onPress={() => onOpen(UNIFIED_INBOX)}
          />
        </PlainList>

        {mailboxes.map((box) => {
          const open = !collapsed.has(box.id);
          return (
            <View key={box.id} style={{ gap: theme.spacing.xs }}>
              <MailboxToggle email={box.email} open={open} onPress={() => onToggle(box.id)} />
              {box.lastError ? (
                <StatusLine
                  danger
                  text={problemText(box, t)}
                  actionLabel={t('mailui.fix.action')}
                  onPress={() => onFix(box)}
                />
              ) : null}
              {open ? (
                <PlainList>
                  {rolesOf(box.folders, MAIL_FOLDER_ROLES).map((role) => (
                    <FolderRow
                      key={role}
                      icon={FOLDER_ICONS[role]}
                      label={t(FOLDER_LABEL_KEYS[role])}
                      count={countFor(messages, box.id, role)}
                      onPress={() => onOpen({ mailAccountId: box.id, role })}
                    />
                  ))}
                </PlainList>
              ) : null}
            </View>
          );
        })}

        <View style={{ paddingTop: theme.spacing.xl }}>
          <PlainList>
            <FolderRow
              icon="settings"
              label={t('mailui.mailboxes.manage')}
              count={0}
              onPress={onManage}
            />
          </PlainList>
        </View>
      </View>
    </Screen>
  );
}

/**
 * Die Adresse eines Postfachs als Kopf: klein geschrieben wie eine Adresse,
 * nicht als Ueberschrift in Grossbuchstaben, und direkt daneben das Klappsymbol.
 */
function MailboxToggle({
  email,
  open,
  onPress,
}: {
  email: string;
  open: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const address = email.toLowerCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={address}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggle,
        {
          minHeight: HIT_TARGET,
          gap: theme.spacing.xs,
          paddingTop: theme.spacing.lg,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text
        variant="label"
        tone="muted"
        numberOfLines={1}
        style={[styles.shrink, { fontWeight: theme.fontWeight.semibold }]}
      >
        {address}
      </Text>
      <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
        <Icon name="forward" size={14} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

function FolderRow({
  icon,
  label,
  count,
  onPress,
}: {
  icon: IconName;
  label: string;
  count: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PlainRow
      title={label}
      leading={<Icon name={icon} size={22} />}
      accessibilityLabel={count > 0 ? `${label}, ${count}` : label}
      trailing={
        <View style={[styles.trailing, { gap: theme.spacing.sm }]}>
          {count > 0 ? (
            <Text variant="body" tone="faint">
              {String(count)}
            </Text>
          ) : null}
          <Icon name="forward" size={16} color={theme.colors.textFaint} />
        </View>
      }
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%' },
  shrink: { flexShrink: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center' },
});
