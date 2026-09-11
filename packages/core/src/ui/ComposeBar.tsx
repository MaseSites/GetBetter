import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

const COMPOSE_HEIGHT = 56;
const COMPOSE_INSET = 6;
const SEND = 44;
const CHIP_HEIGHT = 36;

export type ComposeBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  sendLabel: string;
  /** Solange eine Antwort laeuft, nimmt das Feld nichts an. */
  busy?: boolean | undefined;
};

/**
 * Das Feld eines Gespraechs — im Assistenten und in BetterAi: eine Pille,
 * rechts der runde Senden-Knopf, der erst im Signal steht, wenn etwas drin ist.
 */
export function ComposeBar({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  sendLabel,
  busy = false,
}: ComposeBarProps) {
  const theme = useTheme();
  const press = usePressScale();
  const canSend = value.trim().length > 0 && !busy;

  return (
    <View
      style={[
        styles.compose,
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
        onSubmitEditing={() => {
          if (canSend) onSubmit();
        }}
        returnKeyType="send"
        editable={!busy}
        accessibilityLabel={placeholder}
        style={[
          styles.input,
          { fontFamily: theme.fontFamily, fontSize: theme.fontSize.md, color: theme.colors.text },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sendLabel}
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={onSubmit}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
      >
        <Animated.View
          style={[
            styles.send,
            {
              borderRadius: theme.radii.pill,
              backgroundColor: canSend ? theme.colors.accent : theme.colors.surfaceMuted,
              transform: [{ scale: canSend ? press.scale : 1 }],
            },
          ]}
        >
          <Icon
            name="send"
            size={18}
            color={canSend ? theme.colors.textOnAccent : theme.colors.disabledText}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** Ein Vorschlag als Pille ueber dem Feld — ein Tipp schickt ihn ab. */
export function SuggestionChip({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean | undefined;
}) {
  const theme = useTheme();
  const press = usePressScale();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.pill,
            paddingHorizontal: theme.spacing.md,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <Text variant="label" tone="muted" numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compose: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: COMPOSE_HEIGHT,
    borderWidth: 1,
    paddingVertical: COMPOSE_INSET,
    paddingRight: COMPOSE_INSET,
  },
  input: { flex: 1, height: SEND, outlineStyle: 'none' as never },
  send: { width: SEND, height: SEND, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: CHIP_HEIGHT, borderWidth: 1, justifyContent: 'center' },
});
