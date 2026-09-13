import { useRef, useState, type Ref } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import {
  HIT_TARGET,
  Icon,
  Menu,
  measureAnchor,
  Text,
  usePressScale,
  type IconName,
  type MenuAnchor,
  type MenuEntry,
} from '@/ui';

/** So gross ist ein runder Knopf in der Kopfzeile — wie Zurueck. */
const ROUND_SIZE = 40;

type RoundButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  ref?: Ref<View>;
};

/** Runder Knopf auf Papier, derselbe wie Zurueck in `Header`. */
export function RoundButton({ icon, label, onPress, ref }: RoundButtonProps) {
  const theme = useTheme();
  const press = usePressScale();
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={theme.spacing.xs}
    >
      <Animated.View
        style={[
          styles.round,
          theme.elevation.card,
          {
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surface,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <Icon name={icon} size={18} color={theme.colors.text} />
      </Animated.View>
    </Pressable>
  );
}

/** „…“ oben rechts: ein runder Knopf, der sein Menue unter sich aufmacht. */
export function MenuButton({
  icon,
  label,
  items,
}: {
  icon: IconName;
  label: string;
  items: readonly MenuEntry[];
}) {
  const node = useRef<View>(null);
  const [menu, setMenu] = useState<{ anchor: MenuAnchor; open: boolean } | null>(null);

  async function open() {
    const anchor = await measureAnchor(node.current);
    if (anchor) setMenu({ anchor, open: true });
  }

  return (
    <>
      <RoundButton ref={node} icon={icon} label={label} onPress={() => void open()} />
      <Menu
        visible={menu?.open ?? false}
        anchor={menu?.anchor ?? null}
        items={items}
        align="end"
        accessibilityLabel={label}
        onClose={() => setMenu((current) => (current ? { ...current, open: false } : null))}
      />
    </>
  );
}

/** Ein Wort als Knopf in der Kopfzeile: „Fertig“. */
export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={theme.spacing.sm}
      style={({ pressed }) => [
        styles.text,
        { minHeight: HIT_TARGET, paddingHorizontal: theme.spacing.sm, opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <Text variant="body" tone="accent" style={{ fontWeight: theme.fontWeight.semibold }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  round: { width: ROUND_SIZE, height: ROUND_SIZE, alignItems: 'center', justifyContent: 'center' },
  text: { alignItems: 'center', justifyContent: 'center' },
});
