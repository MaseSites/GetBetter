import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { APPS, type AppId } from '@/app/identity';
import { APP_IMAGES } from '@/assets';
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
 * Das Bild einer Better-App — dieselbe fotografische Markenwelt wie im Store.
 * Gibt es noch kein Bild, zeichnet das Bauteil die einfache Form als Fallback.
 */
export function AppIcon({ appId, size = 'md' }: AppIconProps) {
  const theme = useTheme();
  const box = BOX[size];
  const radius = RADIUS[size];
  const source = APP_IMAGES[appId];

  if (source) {
    return (
      <View
        style={[
          styles.wrap,
          {
            width: box,
            height: box,
            borderRadius: radius,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Image
          source={source}
          resizeMode="cover"
          accessibilityLabel={`${APPS[appId].name} App-Icon`}
          accessibilityIgnoresInvertColors
          style={styles.image}
        />
      </View>
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
  image: { width: '100%', height: '100%' },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
