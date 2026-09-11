import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type AvatarProps = {
  name: string;
  imageUri?: string;
  size?: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

export function Avatar({ name, imageUri, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (imageUri) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={name}
        source={{ uri: imageUri }}
        style={[shape, { backgroundColor: theme.colors.surfaceMuted }]}
      />
    );
  }

  return (
    <View
      accessibilityLabel={name}
      style={[styles.fallback, shape, { backgroundColor: theme.colors.inverse }]}
    >
      <Text
        variant={size >= 56 ? 'title' : 'label'}
        style={{
          color: theme.colors.onInverse,
          fontSize: size >= 56 ? theme.fontSize.lg : theme.fontSize.caption,
          fontFamily: theme.fontFamilyDisplay,
          fontWeight: theme.fontWeight.bold,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
