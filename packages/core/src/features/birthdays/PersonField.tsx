import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, type KeyboardTypeOptions } from 'react-native';

import { useTheme } from '@/theme';
import { HIT_TARGET } from '@/ui';

/** So hoch ist ein Notizfeld mindestens. */
const NOTE_MIN_HEIGHT = 88;

/** Was noch nicht gesichert ist — ausserhalb von React, damit es beim Verlassen nicht verloren geht. */
class PendingText {
  private saved: string;
  private latest: string;
  private onSave: (value: string) => void = () => undefined;

  constructor(initial: string) {
    this.saved = initial;
    this.latest = initial;
  }

  setOnSave(onSave: (value: string) => void) {
    this.onSave = onSave;
  }

  change(value: string) {
    this.latest = value;
  }

  flush() {
    if (this.latest === this.saved) return;
    this.saved = this.latest;
    this.onSave(this.latest);
  }
}

export type PersonFieldProps = {
  initial: string;
  placeholder: string;
  accessibilityLabel: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words';
};

/**
 * Ein Feld ohne Knopf: gesichert wird beim Verlassen des Felds und beim
 * Verlassen des Bildschirms — Schliessen sichert.
 */
export function PersonField({
  initial,
  placeholder,
  accessibilityLabel,
  onSave,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: PersonFieldProps) {
  const theme = useTheme();
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const [pending] = useState(() => new PendingText(initial));

  useEffect(() => {
    pending.setOnSave(onSave);
  });

  // Wer zurueckwischt, ohne das Feld zu verlassen, verliert nichts.
  useEffect(() => () => pending.flush(), [pending]);

  return (
    <TextInput
      value={value}
      onChangeText={(next) => {
        setValue(next);
        pending.change(next);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        pending.flush();
      }}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textFaint}
      accessibilityLabel={accessibilityLabel}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[
        styles.input,
        {
          minHeight: multiline ? NOTE_MIN_HEIGHT : HIT_TARGET + theme.spacing.xs,
          borderColor: focused ? theme.colors.text : theme.colors.border,
          borderRadius: theme.radii.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: multiline ? theme.spacing.md : theme.spacing.sm,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          fontFamily: theme.fontFamily,
          fontSize: theme.fontSize.md,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    // Der Browser zeichnet sonst einen eigenen Fokusrahmen ueber unseren.
    outlineStyle: 'none' as never,
  },
});
