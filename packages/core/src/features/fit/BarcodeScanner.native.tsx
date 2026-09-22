import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Text } from '@/ui';

const SCANNER_HEIGHT = 260;

/** Auf dem Telefon gibt es den Scanner mit der Kamera. */
export const canScanLive = true;

/**
 * Strichcode live mit der Kamera lesen (EAN-13/8, UPC). Meldet den ersten
 * Treffer genau einmal; danach ist die Kamera aus. Ohne Erlaubnis ein Knopf,
 * der danach fragt — nie ungefragt.
 */
export function BarcodeScanner({
  onCode,
  onCancel,
}: {
  onCode: (code: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [done, setDone] = useState(false);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="body" tone="muted">
          {t(permission.canAskAgain ? 'fit.scan.permission' : 'fit.photo.permission')}
        </Text>
        {permission.canAskAgain ? (
          <Button label={t('fit.scan.allow')} icon="eye" onPress={() => void requestPermission()} />
        ) : null}
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          height: SCANNER_HEIGHT,
          borderRadius: theme.radii.item,
          overflow: 'hidden',
          backgroundColor: theme.colors.inverse,
        }}
      >
        {done ? null : (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={({ data }) => {
              if (done || !/^\d{8,14}$/.test(data)) return;
              setDone(true);
              onCode(data);
            }}
          />
        )}
      </View>
      <Text variant="caption" tone="muted">
        {t('fit.scan.hint')}
      </Text>
      <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </View>
  );
}
