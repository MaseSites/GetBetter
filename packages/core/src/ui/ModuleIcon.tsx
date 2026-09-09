import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { MODULE_IMAGES, MODULE_IMAGES_MONO } from '@/assets';
import { moduleTint, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type ModuleIconSize = 'sm' | 'md' | 'lg' | 'xl';

export type ModuleIconProps = {
  /** Bestimmt Bild und Farbe. */
  moduleId: string;
  /** Fallback, falls es zu dieser Id kein Bild gibt. */
  icon: IconName;
  size?: ModuleIconSize;
};

const BOX: Record<ModuleIconSize, number> = { sm: 28, md: 44, lg: 64, xl: 88 };
const GLYPH: Record<ModuleIconSize, number> = { sm: 15, md: 22, lg: 30, xl: 40 };
const RADIUS: Record<ModuleIconSize, number> = { sm: 8, md: 12, lg: 16, xl: 22 };

/**
 * Das Logo einer Funktion — ein echtes Bild, erzeugt von `scripts/icons.js`:
 * abgerundetes Quadrat mit Farbverlauf, Lichtbogen, weisses Symbol. In
 * Schwarzweiss die graue Fassung.
 *
 * Gibt es zu einer Id kein Bild, zeichnet das Bauteil dieselbe Form selbst,
 * damit nie ein Loch entsteht.
 */
export function ModuleIcon({ moduleId, icon, size = 'md' }: ModuleIconProps) {
  const theme = useTheme();
  const box = BOX[size];
  const radius = RADIUS[size];
  const source = (theme.preset === 'mono' ? MODULE_IMAGES_MONO : MODULE_IMAGES)[moduleId];

  if (source) {
    return (
      <Image
        source={source}
        accessibilityIgnoresInvertColors
        style={{ width: box, height: box, borderRadius: radius }}
      />
    );
  }

  const tint = moduleTint(theme, moduleId);
  return (
    <View style={[styles.wrap, { width: box, height: box, borderRadius: radius }]}>
      <LinearGradient
        colors={[tint.gradient[0], tint.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Icon name={icon} size={GLYPH[size]} color={tint.foreground} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
