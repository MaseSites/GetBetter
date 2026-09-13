import { View } from 'react-native';

import type { MailFolderRole } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Card, Divider, EmptyState, ListItem, Sheet } from '@/ui';

import { FOLDER_LABEL_KEYS } from './format';
import { FOLDER_ICONS } from './icons';

export type MoveSheetProps = {
  visible: boolean;
  /** Die Ordner, die das Postfach fuehrt — ohne den, in dem die Nachricht liegt. */
  targets: readonly MailFolderRole[];
  onMove: (role: MailFolderRole) => void;
  onClose: () => void;
};

/** Wohin verschoben wird — nur Ordner, die es in diesem Postfach wirklich gibt. */
export function MoveSheet({ visible, targets, onMove, onClose }: MoveSheetProps) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('mail.action.moveTitle')}>
      <View style={{ paddingBottom: theme.spacing.lg }}>
        {targets.length === 0 ? (
          <EmptyState title={t('mail.folders')} body={t('mail.error.folderMissing')} />
        ) : (
          <Card padded={false}>
            <View>
              {targets.map((role, index) => (
                <View key={role}>
                  {index > 0 ? <Divider /> : null}
                  <ListItem
                    title={t(FOLDER_LABEL_KEYS[role])}
                    icon={FOLDER_ICONS[role]}
                    showChevron
                    onPress={() => onMove(role)}
                  />
                </View>
              ))}
            </View>
          </Card>
        )}
      </View>
    </Sheet>
  );
}
