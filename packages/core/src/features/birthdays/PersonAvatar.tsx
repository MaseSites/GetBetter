import { Image, StyleSheet, View } from 'react-native';

import { useTheme, type Theme } from '@/theme';
import { uploadSource } from '@/theme/backdrops';
import { Text } from '@/ui';

/** Je naeher der Tag, desto groesser das Bild. */
export const AVATAR = {
  detail: 96,
  hero: 64,
  form: 56,
  week: 48,
  compact: 40,
  suggestion: 32,
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function initialsType(theme: Theme, size: number) {
  if (size >= AVATAR.detail)
    return { fontSize: theme.fontSize.xl, lineHeight: theme.lineHeight.xl };
  if (size >= AVATAR.hero)
    return { fontSize: theme.fontSize.stat, lineHeight: theme.lineHeight.lg };
  if (size >= AVATAR.week) return { fontSize: theme.fontSize.md, lineHeight: theme.lineHeight.md };
  return { fontSize: theme.fontSize.sm, lineHeight: theme.lineHeight.sm };
}

/**
 * Foto, wo eines da ist — sonst Initialen in einem ruhigen Kreis, nicht bunt:
 * die Freude gehoert der Person, nicht der Oberflaeche.
 */
export function PersonAvatar({
  name,
  photoUploadId,
  size,
}: {
  name: string;
  photoUploadId?: string | null;
  size: number;
}) {
  const theme = useTheme();
  const shape = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: theme.colors.surfaceMuted,
  };

  if (photoUploadId) {
    return (
      <Image accessibilityIgnoresInvertColors source={uploadSource(photoUploadId)} style={shape} />
    );
  }

  return (
    <View style={[styles.center, shape]}>
      <Text
        style={[
          initialsType(theme, size),
          { color: theme.colors.textMuted, fontWeight: theme.fontWeight.semibold },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
