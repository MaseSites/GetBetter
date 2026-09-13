import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { MailAddress } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, Text } from '@/ui';

import { addRecipients, removeRecipient, splitTyped } from './compose';
import { isEmailAddress } from './format';

/** Eine Zeile des Schreib-Blatts, 44 hoch, Beschriftung links, feine Linie darunter. */
export function FieldRow({ label, children }: { label?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          minHeight: HIT_TARGET,
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      {label ? (
        <Text variant="body" tone="faint">
          {label}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export type TokenFieldProps = {
  label: string;
  tokens: readonly string[];
  input: string;
  onTokens: (tokens: string[]) => void;
  onInput: (value: string) => void;
  suggestions: readonly MailAddress[];
  autoFocus?: boolean;
};

/**
 * Ein Adressfeld: Komma, Strichpunkt oder Leerzeichen machen aus dem Getippten
 * ein Token; ein Tipp auf ein Token entfernt es. Darunter stehen Vorschlaege.
 */
export function TokenField({
  label,
  tokens,
  input,
  onTokens,
  onInput,
  suggestions,
  autoFocus = false,
}: TokenFieldProps) {
  const { t } = useI18n();
  const theme = useTheme();

  function change(value: string) {
    const { complete, rest } = splitTyped(value);
    if (complete.length > 0) onTokens(addRecipients(tokens, complete));
    onInput(rest);
  }

  function commit() {
    const typed = input.trim();
    if (typed.length === 0) return;
    onTokens(addRecipients(tokens, [typed]));
    onInput('');
  }

  return (
    <View>
      <FieldRow label={label}>
        <View style={[styles.tokens, { gap: theme.spacing.xs }]}>
          {tokens.map((token) => {
            const valid = isEmailAddress(token);
            return (
              <Pressable
                key={token}
                accessibilityRole="button"
                accessibilityLabel={t('mailui.compose.removeRecipient', { address: token })}
                onPress={() => onTokens(removeRecipient(tokens, token))}
                style={({ pressed }) => [
                  styles.row,
                  {
                    gap: theme.spacing.xs,
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.xs,
                    borderRadius: theme.radii.pill,
                    backgroundColor: valid ? theme.colors.surfaceMuted : theme.colors.dangerSoft,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text variant="label" tone={valid ? 'default' : 'danger'} numberOfLines={1}>
                  {token}
                </Text>
                <Icon
                  name="close"
                  size={12}
                  color={valid ? theme.colors.textMuted : theme.colors.danger}
                />
              </Pressable>
            );
          })}
          <TextInput
            accessibilityLabel={label}
            value={input}
            onChangeText={change}
            onSubmitEditing={commit}
            submitBehavior="submit"
            onKeyPress={(event) => {
              if (
                event.nativeEvent.key === 'Backspace' &&
                input.length === 0 &&
                tokens.length > 0
              ) {
                onTokens(tokens.slice(0, -1));
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            autoFocus={autoFocus}
            style={[
              styles.input,
              {
                minHeight: HIT_TARGET - theme.spacing.sm,
                fontFamily: theme.fontFamily,
                fontSize: theme.fontSize.md,
                color: theme.colors.text,
              },
            ]}
          />
        </View>
      </FieldRow>

      {suggestions.length > 0 ? (
        <View style={{ paddingVertical: theme.spacing.xs }}>
          {suggestions.map((entry) => (
            <Pressable
              key={entry.address}
              accessibilityRole="button"
              accessibilityLabel={entry.name ? `${entry.name}, ${entry.address}` : entry.address}
              onPress={() => {
                onTokens(addRecipients(tokens, [entry.address]));
                onInput('');
              }}
              style={({ pressed }) => [
                styles.suggestion,
                {
                  minHeight: HIT_TARGET,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radii.sm,
                  backgroundColor: pressed ? theme.colors.surfaceMuted : undefined,
                },
              ]}
            >
              <Text variant="body" numberOfLines={1}>
                {entry.name || entry.address}
              </Text>
              {entry.name ? (
                <Text variant="caption" tone="faint" numberOfLines={1}>
                  {entry.address}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tokens: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  input: {
    flexGrow: 1,
    minWidth: 120,
    // Der Browser zeichnet sonst einen eigenen Fokusrahmen.
    outlineStyle: 'none' as never,
  },
  suggestion: { justifyContent: 'center' },
});
