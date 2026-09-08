import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Divider, Header, Input, Screen, Text } from '@/ui';

export type CredentialsFormProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  switchLabel: string;
  onSubmit: () => void;
  onSwitch: () => void;
};

/**
 * P-009: Anmelden und Registrieren teilen sich dieselbe Maske.
 * Es wird bewusst nichts geprueft — jeder Knopf fuehrt weiter.
 */
export function CredentialsForm({
  title,
  subtitle,
  submitLabel,
  switchLabel,
  onSubmit,
  onSwitch,
}: CredentialsFormProps) {
  const t = useTranslate();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen
      header={<Header showBack />}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button label={submitLabel} onPress={onSubmit} />
          <Button label={switchLabel} variant="ghost" onPress={onSwitch} />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display">{title}</Text>
        <Text variant="label" tone="muted">
          {subtitle}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Input
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          icon="mail"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          icon="lock"
          secureTextEntry
          autoCapitalize="none"
          onSubmitEditing={onSubmit}
          returnKeyType="done"
        />
      </View>

      <View style={[styles.separator, { gap: theme.spacing.md }]}>
        <View style={styles.line}>
          <Divider />
        </View>
        <Text variant="caption" tone="faint">
          {t('common.or')}
        </Text>
        <View style={styles.line}>
          <Divider />
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={t('auth.appleButton')}
          variant="secondary"
          icon="person"
          onPress={onSubmit}
        />
        <Button
          label={t('auth.googleButton')}
          variant="secondary"
          icon="person"
          onPress={onSubmit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  separator: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1 },
});
