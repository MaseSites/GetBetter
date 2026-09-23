import { Animated, Image, type ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Icon, Text, usePressScale } from '@/ui';

/** So hoch wie die anderen Knoepfe am Start. */
const HEIGHT = 48;
/** Das Zeichen, etwas groesser als die Schrift — wie in den Vorgaben. */
const MARK = 20;

// Von scripts/brands.js erzeugt: das vierfarbige „G“.
const GOOGLE_MARK: ImageSourcePropType = require('../../assets/brands/google.png');

export type Provider = 'apple' | 'google';

export type SocialButtonProps = {
  provider: Provider;
  /** Der Name im Knopf, kurz: „Apple“, „Google“. */
  name: string;
  /** „Mit Apple anmelden“ — fuer die Vorlesefunktion. */
  label: string;
  onPress: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Apple und Google als Paar nebeneinander, mit dem echten Zeichen: dunkle
 * Karte mit feinem Rand, der Apfel in Schrift-Farbe, das „G“ bunt — so wie
 * beide ihre Knoepfe auf dunklem Grund vorsehen. Better daran sind die
 * Pillenform, die Schrift und das Nachgeben beim Druecken. Gedacht fuer die
 * dunkle Flaeche des Startbildschirms (`darkTheme`).
 */
export function SocialButton({ provider, name, label, onPress }: SocialButtonProps) {
  const theme = useTheme();
  const press = usePressScale();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.base,
        {
          height: HEIGHT,
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderStrong,
          transform: [{ scale: press.scale }],
        },
      ]}
    >
      <View style={styles.mark}>
        {provider === 'apple' ? (
          <Icon name="apple" size={MARK + 2} color={theme.colors.text} />
        ) : (
          <Image source={GOOGLE_MARK} style={styles.image} accessibilityIgnoresInvertColors />
        )}
      </View>
      <Text
        variant="label"
        numberOfLines={1}
        style={{ fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semibold }}
      >
        {name}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  mark: { width: MARK + 2, height: MARK + 2, alignItems: 'center', justifyContent: 'center' },
  image: { width: MARK, height: MARK },
});
