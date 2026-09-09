import { useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type InputProps = {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  icon?: IconName;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  editable?: boolean;
  multiline?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next' | 'send' | 'search';
  accessibilityLabel?: string;
};

export function Input({
  value,
  onChangeText,
  label,
  placeholder,
  hint,
  error,
  icon,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  editable = true,
  multiline = false,
  onSubmitEditing,
  returnKeyType,
  accessibilityLabel,
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.accent
      : theme.colors.border;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor,
            borderRadius: theme.radii.md,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
            minHeight: multiline ? 88 : 48,
            alignItems: multiline ? 'flex-start' : 'center',
            paddingVertical: multiline ? theme.spacing.md : 0,
            backgroundColor: editable ? theme.colors.surface : theme.colors.disabledBackground,
          },
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={theme.colors.textFaint} /> : null}
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          multiline={multiline}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              height: multiline ? undefined : '100%',
              fontFamily: theme.fontFamily,
              fontSize: theme.fontSize.md,
              color: editable ? theme.colors.text : theme.colors.disabledText,
            },
          ]}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', borderWidth: 1 },
  input: {
    flex: 1,
    // Der Browser zeichnet sonst einen eigenen Fokusrahmen ueber unseren.
    outlineStyle: 'none' as never,
  },
});
