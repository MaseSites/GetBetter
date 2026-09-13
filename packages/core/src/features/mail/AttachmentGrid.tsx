import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { mail, type MailAttachmentPart, type MailMessage } from '@/db/mail';
import { formatNumber, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

import { fileSize } from './format';

/** Hoehe der Vorschau in einer Kachel. */
const PREVIEW_HEIGHT = 96;
/** Zwei Spalten mit etwas Luft dazwischen. */
const TILE_WIDTH = '48%';

export function attachmentIcon(mime: string): IconName {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || mime.startsWith('text/')) return 'doc';
  return 'attach';
}

export function isImage(file: MailAttachmentPart): boolean {
  return file.mime.startsWith('image/');
}

/** „2,4 MB“ — ueber Intl, in der Sprache des Kontos. */
export function useSizeLabel() {
  const { t, language } = useI18n();
  return (bytes: number) => {
    const size = fileSize(bytes);
    return t(`mail.size.${size.unit}`, { value: formatNumber(language, size.value) });
  };
}

export type AttachmentGridProps = {
  message: MailMessage;
  /** Anhaenge, die schon als Bild im Text stehen. */
  hidden: readonly number[];
  onOpen: (index: number) => void;
  /** Ein Anhang ohne Teil-Nummer ist noch nicht abgeglichen: gleicht ab. */
  onReload: () => void;
};

/** Die Anhaenge als Kacheln in zwei Spalten: Bild oder Symbol, Name, Groesse. */
export function AttachmentGrid({ message, hidden, onOpen, onReload }: AttachmentGridProps) {
  const theme = useTheme();
  const tiles = message.attachments
    .map((file, index) => ({ file, index }))
    .filter((entry) => !hidden.includes(entry.index));
  if (tiles.length === 0) return null;

  return (
    <View style={[styles.grid, { rowGap: theme.spacing.sm }]}>
      {tiles.map(({ file, index }) => (
        <Tile
          key={`${index}:${file.filename}`}
          file={file}
          url={mail.attachmentUrl(message.id, index)}
          onPress={() => (file.part === null ? onReload() : onOpen(index))}
        />
      ))}
    </View>
  );
}

function Tile({
  file,
  url,
  onPress,
}: {
  file: MailAttachmentPart;
  url: string;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const sizeLabel = useSizeLabel();
  const [failed, setFailed] = useState(false);

  const name = file.filename.trim() || t('mail.attachments.unnamed');
  const missing = file.part === null;
  const showImage = isImage(file) && !missing && !failed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        missing ? t('mailui.attachment.missingLabel', { name }) : `${name}, ${sizeLabel(file.size)}`
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          width: TILE_WIDTH,
          borderRadius: theme.radii.sm,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.preview,
          { height: PREVIEW_HEIGHT, backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: url }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            onError={() => setFailed(true)}
            style={StyleSheet.absoluteFill}
          />
        ) : missing ? (
          <Text variant="caption" tone="muted" align="center">
            {t('mailui.attachment.missing')}
          </Text>
        ) : (
          <Icon name={attachmentIcon(file.mime)} size={28} color={theme.colors.textMuted} />
        )}
      </View>
      <View style={{ padding: theme.spacing.sm, gap: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" tone="faint">
          {sizeLabel(file.size)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  preview: { alignItems: 'center', justifyContent: 'center' },
});
