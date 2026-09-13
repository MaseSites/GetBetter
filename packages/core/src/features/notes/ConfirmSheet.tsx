import { View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Sheet, Text } from '@/ui';

export type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Die eine Rueckfrage, die es gibt: fuer das, was sich nicht mehr
 * zuruecknehmen laesst — endgueltig loeschen.
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const t = useTranslate();
  const theme = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        <Text variant="body" tone="muted">
          {body}
        </Text>
        <Button
          label={confirmLabel}
          variant="danger"
          icon="trash"
          onPress={() => {
            onClose();
            onConfirm();
          }}
        />
        <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}
