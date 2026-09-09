import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { APPS, type AppId } from '@/app/identity';
import { APP_IMAGES, APP_IMAGES_MONO } from '@/assets';
import { hueTint, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import type { ModuleIconSize } from './ModuleIcon';

export type AppIconProps = {
  appId: AppId;
  size?: ModuleIconSize;
};

const BOX: Record<ModuleIconSize, number> = { sm: 28, md: 44, lg: 64, xl: 88 };
const GLYPH: Record<ModuleIconSize, number> = { sm: 15, md: 22, lg: 30, xl: 40 };
const RADIUS: Record<ModuleIconSize, number> = { sm: 8, md: 12, lg: 16, xl: 22 };

/**
 * Das Logo einer Better-App — dasselbe Bild wie im Store, erzeugt von
 * `scripts/icons.js`. Gibt es keins, zeichnet das Bauteil die Form selbst.
 */
export function AppIcon({ appId, size = 'md' }: AppIconProps) {
  const theme = useTheme();
  const box = BOX[size];
  const radius = RADIUS[size];
  const source = (theme.preset === 'mono' ? APP_IMAGES_MONO : APP_IMAGES)[appId];

  if (source) {
    return (
      <Image
        source={source}
        accessibilityIgnoresInvertColors
        style={{ width: box, height: box, borderRadius: radius }}
      />
    );
  }

  const app = APPS[appId];
  const tint = hueTint(theme, app.hue);
  return (
    <View style={[styles.wrap, { width: box, height: box, borderRadius: radius }]}>
      <LinearGradient
        colors={[tint.gradient[0], tint.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Icon name={app.icon as IconName} size={GLYPH[size]} color={tint.foreground} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
