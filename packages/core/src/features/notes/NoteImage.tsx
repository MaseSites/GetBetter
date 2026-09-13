import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, usePhoneFrame } from '@/ui';

import { noteImageSource } from './images';

/** Bis das Bild seine Groesse verraet, steht ein Platzhalter in diesem Format. */
const FALLBACK_RATIO = 4 / 3;
/** Das Vorschaubild in einer Zeile. */
export const THUMB_SIZE = 44;

/** Einmal gemessen, springt ein Bild beim naechsten Oeffnen nicht mehr. */
class RatioCache {
  private readonly known = new Map<string, number>();

  get(id: string): number | undefined {
    return this.known.get(id);
  }

  remember(id: string, ratio: number): void {
    this.known.set(id, ratio);
  }
}

const ratios = new RatioCache();

function uriOf(uploadId: string): string | null {
  const source = noteImageSource(uploadId);
  return typeof source === 'object' && source !== null && 'uri' in source && source.uri
    ? source.uri
    : null;
}

function useRatio(uploadId: string): number | null {
  const [ratio, setRatio] = useState<number | null>(() => ratios.get(uploadId) ?? null);

  useEffect(() => {
    if (ratios.get(uploadId) !== undefined) return;
    const uri = uriOf(uploadId);
    if (!uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled || width <= 0 || height <= 0) return;
        ratios.remember(uploadId, width / height);
        setRatio(width / height);
      },
      // Laedt es nicht, bleibt der Platzhalter — das Bild fehlt dann eben.
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [uploadId]);

  return ratio;
}

/** Ein Bild ueber die volle Breite, mit Platzhalter im richtigen Format. */
export function NoteImageBlock({ uploadId }: { uploadId: string }) {
  const theme = useTheme();
  const ratio = useRatio(uploadId);
  const [loaded, setLoaded] = useState(false);

  return (
    <View
      style={[
        styles.full,
        {
          aspectRatio: ratio ?? FALLBACK_RATIO,
          borderRadius: theme.radii.xs,
          backgroundColor: theme.colors.surfaceMuted,
        },
      ]}
    >
      <Image
        source={noteImageSource(uploadId)}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        onLoad={() => setLoaded(true)}
        style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
      />
    </View>
  );
}

export function NoteThumb({ uploadId }: { uploadId: string }) {
  const theme = useTheme();
  return (
    <Image
      source={noteImageSource(uploadId)}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: theme.radii.xs,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    />
  );
}

/** Ein Bild im Vollbild; ein Tipp auf Schliessen oder Zurueck fuehrt zur Notiz. */
export function ImagePreview({
  uploadId,
  onClose,
}: {
  uploadId: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useTranslate();
  const insets = useSafeAreaInsets();
  const frame = usePhoneFrame();

  return (
    <Modal visible={uploadId !== null} animationType="fade" transparent onRequestClose={onClose}>
      <View style={frame.framed ? styles.stage : styles.fill}>
        <View
          style={[
            styles.fill,
            { backgroundColor: theme.colors.inverse },
            frame.framed
              ? {
                  flexGrow: 0,
                  flexShrink: 0,
                  flexBasis: 'auto',
                  width: frame.width,
                  height: frame.height,
                  borderRadius: theme.radii.xl,
                  overflow: 'hidden',
                }
              : null,
          ]}
        >
          {uploadId ? (
            <Image
              source={noteImageSource(uploadId)}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            style={[
              styles.close,
              {
                top: insets.top + theme.spacing.lg,
                left: theme.spacing.edge,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Icon name="close" size={20} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  full: { width: '100%', overflow: 'hidden' },
  close: {
    position: 'absolute',
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
