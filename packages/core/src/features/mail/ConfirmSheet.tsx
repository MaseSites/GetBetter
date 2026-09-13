import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Sheet, Text } from '@/ui';

export type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

/** Die Rueckfrage — nur fuer das, was sich nicht rueckgaengig machen laesst. */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        {body ? (
          <Text variant="body" tone="muted">
            {body}
          </Text>
        ) : null}
        <Button label={confirmLabel} variant="danger" icon="trash" onPress={onConfirm} />
        <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}
