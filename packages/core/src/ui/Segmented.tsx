import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/** Zwei bis drei Zustaende nebeneinander, einer davon aktiv. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radii.pill,
          borderColor: theme.colors.border,
          padding: 2,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                borderRadius: theme.radii.pill,
                paddingHorizontal: theme.spacing.md,
                backgroundColor: selected ? theme.colors.surface : 'transparent',
              },
            ]}
          >
            <Text
              variant="caption"
              tone={selected ? 'default' : 'muted'}
              style={{ fontWeight: selected ? theme.fontWeight.semibold : theme.fontWeight.medium }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderWidth: 1, alignSelf: 'flex-start' },
  segment: { height: 28, alignItems: 'center', justifyContent: 'center' },
});
