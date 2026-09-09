import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { moduleTint, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type ModuleIconSize = 'sm' | 'md' | 'lg';

export type ModuleIconProps = {
  /** Bestimmt die Farbe. */
  moduleId: string;
  icon: IconName;
  size?: ModuleIconSize;
};

const BOX: Record<ModuleIconSize, number> = { sm: 28, md: 44, lg: 64 };
const GLYPH: Record<ModuleIconSize, number> = { sm: 15, md: 22, lg: 30 };
const RADIUS: Record<ModuleIconSize, number> = { sm: 9, md: 14, lg: 20 };

/**
 * Das Logo einer Funktion: ein abgerundetes Quadrat mit Farbverlauf, darauf
 * ein heller Bogen als Licht und in der Mitte das Symbol.
 *
 * Ein flacher Farbfleck sah nach Platzhalter aus; drei Schichten reichen, damit
 * es nach einem Logo aussieht — ohne eine einzige Bilddatei.
 */
export function ModuleIcon({ moduleId, icon, size = 'md' }: ModuleIconProps) {
  const theme = useTheme();
  const tint = moduleTint(theme, moduleId);
  const box = BOX[size];

  return (
    <View style={[styles.wrap, { width: box, height: box, borderRadius: RADIUS[size] }]}>
      <LinearGradient
        colors={[tint.gradient[0], tint.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ein Lichtbogen oben links, wie ihn ein Logo haette. */}
      <View
        style={[
          styles.shine,
          {
            width: box * 1.2,
            height: box * 1.2,
            borderRadius: box,
            top: -box * 0.7,
            left: -box * 0.25,
            backgroundColor: theme.scheme === 'light' ? '#FFFFFF' : '#000000',
            opacity: theme.preset === 'colorful' ? 0.16 : 0.08,
          },
        ]}
      />
      <Icon name={icon} size={GLYPH[size]} color={tint.foreground} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shine: { position: 'absolute' },
});
