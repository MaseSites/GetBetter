import { View } from 'react-native';

import { useTranslate } from '@/i18n';
import { getModule } from '@/mocks/modules';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Icon, Sheet, Text } from '@/ui';

export type UninstallDialogProps = {
  moduleId: string | null;
  onClose: () => void;
  /** Laeuft nach dem Deinstallieren, z.B. um einen Bildschirm zu verlassen. */
  onUninstalled?: () => void;
};

/**
 * P-015: Deinstallieren fragt nach und zeigt an, was dabei verschwindet.
 */
export function UninstallDialog({ moduleId, onClose, onUninstalled }: UninstallDialogProps) {
  const t = useTranslate();
  const theme = useTheme();
  const { uninstallModule } = useApp();

  const module = moduleId ? getModule(moduleId) : undefined;

  const consequences = [
    t('detail.uninstall.card'),
    t('detail.uninstall.tile'),
    t('detail.uninstall.data'),
  ];

  return (
    <Sheet
      visible={module !== undefined}
      onClose={onClose}
      title={module ? t('detail.uninstall.title', { name: module.name }) : undefined}
    >
      {module ? (
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              {t('detail.uninstall.body')}
            </Text>
            {consequences.map((line) => (
              <View
                key={line}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
              >
                <Icon name="close" size={16} color={theme.colors.danger} />
                <Text variant="label">{line}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label={t('detail.uninstall.confirm')}
              variant="danger"
              icon="trash"
              onPress={() => {
                uninstallModule(module.id);
                onClose();
                onUninstalled?.();
              }}
            />
            <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}
