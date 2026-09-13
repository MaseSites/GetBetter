import { createElement, useState } from 'react';
import { Image, Linking, Modal, Platform, Share, StyleSheet, View } from 'react-native';

import { mail, type MailMessage } from '@/db/mail';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text, usePhoneFrame } from '@/ui';

import { attachmentIcon, isImage, useSizeLabel } from './AttachmentGrid';
import { BarButton, BottomBar, TopBar } from './MailChrome';

export type AttachmentPreviewProps = {
  message: MailMessage | null;
  index: number | null;
  onClose: () => void;
};

/** Oeffnet die Adresse: im Browser in einem neuen Tab, auf dem Geraet im Browser des Systems. */
function openUrl(url: string) {
  // Scheitert es, bleibt die Vorschau offen — es gibt nichts, was verloren ginge.
  Linking.openURL(url).catch(() => undefined);
}

async function shareUrl(url: string, name: string) {
  if (Platform.OS === 'web') {
    const share = typeof navigator !== 'undefined' ? navigator.share?.bind(navigator) : undefined;
    if (share) {
      // Abbrechen im Teilen-Dialog ist kein Fehler.
      await share({ url, title: name }).catch(() => undefined);
      return;
    }
    openUrl(url);
    return;
  }
  await Share.share({ url, message: url, title: name }).catch(() => undefined);
}

/** Ein Anhang im Vollbild: Bild, PDF im Browser, sonst Symbol — unten Teilen und Sichern. */
export function AttachmentPreview({ message, index, onClose }: AttachmentPreviewProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const frame = usePhoneFrame();
  const sizeLabel = useSizeLabel();
  const [failed, setFailed] = useState<string | null>(null);

  const file = message && index !== null ? message.attachments[index] : undefined;
  const url = message && index !== null ? mail.attachmentUrl(message.id, index) : '';
  const name = file ? file.filename.trim() || t('mail.attachments.unnamed') : '';
  const pdf = file?.mime === 'application/pdf' && Platform.OS === 'web';
  const image = file ? isImage(file) && failed !== url : false;

  return (
    <Modal visible={file !== undefined} transparent animationType="fade" onRequestClose={onClose}>
      <View style={frame.framed ? styles.stage : styles.fill}>
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.colors.background },
            frame.framed
              ? { width: frame.width, height: frame.height, borderRadius: theme.radii.xl }
              : null,
          ]}
        >
          <TopBar backLabel={name} backAccessibilityLabel={t('common.close')} onBack={onClose} />
          <View style={[styles.fill, styles.center, { padding: theme.spacing.lg }]}>
            {file && image ? (
              <Image
                source={{ uri: url }}
                resizeMode="contain"
                accessibilityLabel={name}
                onError={() => setFailed(url)}
                style={styles.full}
              />
            ) : file && pdf ? (
              createElement('iframe', {
                title: name,
                src: url,
                style: { border: 0, width: '100%', height: '100%' },
              })
            ) : file ? (
              <View style={[styles.center, { gap: theme.spacing.sm }]}>
                <Icon name={attachmentIcon(file.mime)} size={48} color={theme.colors.textMuted} />
                <Text variant="body" align="center">
                  {name}
                </Text>
                <Text variant="label" tone="faint">
                  {sizeLabel(file.size)}
                </Text>
                <Text variant="label" tone="muted" align="center">
                  {t('mailui.attachment.noPreview')}
                </Text>
              </View>
            ) : null}
          </View>
          <BottomBar>
            <BarButton
              label={t('mailui.attachment.share')}
              icon="upload"
              onPress={() => void shareUrl(url, name)}
            />
            <BarButton
              label={t('mailui.attachment.save')}
              icon="download"
              onPress={() => openUrl(url)}
            />
          </BottomBar>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: { flex: 1, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  full: { width: '100%', height: '100%' },
});
