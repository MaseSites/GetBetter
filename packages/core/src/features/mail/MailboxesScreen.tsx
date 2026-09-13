import { StyleSheet, View } from 'react-native';

import { MAIL_FOLDER_ROLES, type MailMessage } from '@/db/mail';
import type { MailAccountRow, MailFolderRole } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, PlainList, PlainRow, Screen, SectionHeader, Text, type IconName } from '@/ui';

import { countUnread, FOLDER_LABEL_KEYS, rolesOf } from './format';
import { FOLDER_ICONS } from './icons';
import { problemText, StatusLine } from './InboxParts';
import { TopBar } from './MailChrome';
import { UNIFIED_INBOX, type MailPlace } from './threads';

export type MailboxesScreenProps = {
  mailboxes: readonly MailAccountRow[];
  messages: readonly MailMessage[];
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
 */
export function MailboxesScreen({
  mailboxes,
  messages,
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

        {mailboxes.map((box) => (
          <View key={box.id} style={{ gap: theme.spacing.xs }}>
            <SectionHeader label={box.email} />
            {box.lastError ? (
              <StatusLine
                danger
                text={problemText(box, t)}
                actionLabel={t('mailui.fix.action')}
                onPress={() => onFix(box)}
              />
            ) : null}
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
          </View>
        ))}

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
  trailing: { flexDirection: 'row', alignItems: 'center' },
});
