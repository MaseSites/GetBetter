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

/**
 * Zwei bis drei Zustaende nebeneinander, einer davon aktiv — wie Tag, Woche,
 * Monat im Kalender: eine vertiefte Spur ueber die ganze Breite, das aktive
 * Feld liegt als weisse Karte darauf.
 */
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
          borderRadius: theme.radii.sm,
          padding: 3,
          gap: 2,
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
              selected ? theme.elevation.card : null,
              {
                borderRadius: theme.radii.sm,
                paddingHorizontal: theme.spacing.sm,
                backgroundColor: selected ? theme.colors.surface : 'transparent',
              },
            ]}
          >
            <Text
              variant="label"
              numberOfLines={1}
              style={{
                color: selected ? theme.colors.text : theme.colors.textMuted,
                fontWeight: theme.fontWeight.semibold,
              }}
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
  track: { flexDirection: 'row', alignSelf: 'stretch' },
  segment: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
});
