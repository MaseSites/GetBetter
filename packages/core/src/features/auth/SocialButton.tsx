import { Animated, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';
import { Text, usePressScale } from '@/ui';

/** So gross wie ein Knopf hoch ist, nur eben rund. */
const SIZE = 52;

export type SocialButtonProps = {
  /** Der Name des Anbieters — sein erster Buchstabe steht im Kreis. */
  name: string;
  /** Was der Knopf tut. Die Vorlesefunktion hat sonst nur einen Buchstaben. */
  label: string;
  onPress: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Ein Anbieter als runder Knopf, wie im Entwurf. Die Marke selbst duerfen wir
 * nicht zeichnen — der Kreis traegt darum den Anfangsbuchstaben, den ganzen
 * Namen sagt die Vorlesefunktion.
 */
export function SocialButton({ name, label, onPress }: SocialButtonProps) {
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
          width: SIZE,
          height: SIZE,
          borderRadius: theme.radii.pill,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          transform: [{ scale: press.scale }],
        },
      ]}
    >
      <Text
        variant="label"
        style={{
          fontFamily: theme.fontFamilyDisplay,
          fontSize: theme.fontSize.lg,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        {name.slice(0, 1)}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
