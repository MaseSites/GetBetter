import { Pressable, StyleSheet } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon } from '@/ui';

/** So gross steht der Stern in einer Zeile. */
const STAR_SIZE = 20;

/** Der Stern allein, ohne Knopf — fuer Zeilen, die selbst der Schalter sind. */
export function StarIcon({ active }: { active: boolean }) {
  const theme = useTheme();

  return (
    <Icon
      name={active ? 'starFilled' : 'star'}
      size={STAR_SIZE}
      // Der helle Signalton ist als Symbol auf Papier nicht zu erkennen.
      color={active ? theme.colors.accentStrong : theme.colors.textFaint}
    />
  );
}

/**
 * Der Stern als eigener Knopf rechts in einer Zeile. Er steht neben dem
 * drueckbaren Teil der Zeile, nie darin — ein Knopf im Knopf waere im Browser
 * ungueltig. Die ganze rechte Kante ist Trefferflaeche.
 */
export function StarButton({
  active,
  name,
  onPress,
}: {
  active: boolean;
  /** Wofuer der Stern steht — fuer die Bedienungshilfe. */
  name: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={t(active ? 'quick.star.remove' : 'quick.star.add', { name })}
      onPress={onPress}
      hitSlop={theme.spacing.xs}
      style={({ pressed }) => [
        styles.button,
        { paddingHorizontal: theme.spacing.md, opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <StarIcon active={active} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
