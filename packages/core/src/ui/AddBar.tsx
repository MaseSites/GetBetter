import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './Icon';
import { usePressScale } from './usePressScale';

export type AddBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  /** Was der runde Knopf tut, fuer die Vorlesefunktion. */
  addLabel: string;
};

/**
 * Schnell etwas eintragen: das Feld als Pille, der Knopf rund darin. So steht
 * die Eingabe im Entwurf — ein Stueck, statt Feld und Knopf nebeneinander.
 * Der Knopf ist Tinte; Signalgruen bleibt fuer *erledigt* reserviert.
 */
export function AddBar({ value, onChangeText, onSubmit, placeholder, addLabel }: AddBarProps) {
  const theme = useTheme();
  const press = usePressScale();
  const canAdd = value.trim().length > 0;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderStrong,
          borderRadius: theme.radii.lg,
          paddingLeft: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textFaint}
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        accessibilityLabel={placeholder}
        style={[
          styles.input,
          { fontFamily: theme.fontFamily, fontSize: theme.fontSize.md, color: theme.colors.text },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        accessibilityState={{ disabled: !canAdd }}
        disabled={!canAdd}
        onPress={onSubmit}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
      >
        <Animated.View
          style={[
            styles.button,
            {
              borderRadius: theme.radii.pill,
              backgroundColor: canAdd ? theme.colors.inverse : theme.colors.surfaceMuted,
              transform: [{ scale: canAdd ? press.scale : 1 }],
            },
          ]}
        >
          <Icon
            name="plus"
            size={20}
            color={canAdd ? theme.colors.onInverse : theme.colors.disabledText}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderWidth: 1,
    paddingVertical: 6,
    paddingRight: 6,
  },
  input: { flex: 1, height: 44, outlineStyle: 'none' as never },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
