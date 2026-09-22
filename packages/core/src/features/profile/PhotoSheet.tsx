import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { canPickImage, pickImage } from '@/features/personalize/pickImage';
import { removeUpload, uploadBackdrop } from '@/features/personalize/uploads';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Sheet, Text } from '@/ui';

import { AccountPhoto } from './AccountPhoto';

/** So gross steht das Bild im Blatt — man soll sehen, was man bekommt. */
const PREVIEW = 112;

type PhotoState = 'idle' | 'busy' | 'failed';

/**
 * Das Profilbild: gross das jetzige, darunter „Foto wählen“ und, wo es eines
 * gibt, „Foto entfernen“. Gewaehlt wird wie ein eigener Hintergrund —
 * verkleinert und unter `/v1/uploads` abgelegt; das alte Bild raeumt die App
 * danach weg. Im Browser geht die Auswahl, am Handy braucht sie noch
 * expo-image-picker: dann sagt das Blatt das ehrlich.
 */
export function PhotoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const { account, setPhoto } = useApp();
  const [state, setState] = useState<PhotoState>('idle');

  if (!account) return null;
  const accountId = account.id;
  const current = account.photoUploadId ?? null;
  const picking = canPickImage();
  const busy = state === 'busy';

  function close() {
    setState('idle');
    onClose();
  }

  // Direkt aus dem Tipp heraus: der Browser oeffnet den Dateidialog nur als Antwort darauf.
  async function choose() {
    let dataUrl: string | null;
    try {
      dataUrl = await pickImage();
    } catch {
      setState('failed');
      return;
    }
    if (!dataUrl) return;
    setState('busy');
    const uploaded = await uploadBackdrop(accountId, dataUrl);
    if (!uploaded.ok) {
      setState('failed');
      return;
    }
    await setPhoto(uploaded.id);
    // Auf das alte Bild zeigt nichts mehr.
    if (current) void removeUpload(current);
    close();
  }

  async function remove() {
    setState('busy');
    await setPhoto(null);
    if (current) void removeUpload(current);
    close();
  }

  return (
    <Sheet visible={visible} onClose={close} title={t('profile.photo')}>
      <View style={[styles.center, { gap: theme.spacing.md, paddingVertical: theme.spacing.sm }]}>
        <AccountPhoto size={PREVIEW} />
        {state === 'failed' ? (
          <Text variant="caption" tone="danger" style={styles.text}>
            {t('profile.photo.error')}
          </Text>
        ) : null}
        {picking ? null : (
          <Text variant="label" tone="muted" style={styles.text}>
            {t('profile.photo.device')}
          </Text>
        )}
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={t('profile.photo.choose')}
          icon="image"
          loading={busy}
          disabled={!picking || busy}
          onPress={() => void choose()}
        />
        {current ? (
          <Button
            label={t('profile.photo.remove')}
            variant="ghost"
            disabled={busy}
            onPress={() => void remove()}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  text: { textAlign: 'center' },
});
