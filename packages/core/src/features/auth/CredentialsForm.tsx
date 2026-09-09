import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AuthError, AuthResult } from '@/auth/accounts';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Header, Input, Screen, Text } from '@/ui';

export type CredentialsFormProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  switchLabel: string;
  onSubmit: (email: string, password: string) => Promise<AuthResult>;
  onSwitch: () => void;
  /** Zusaetzlicher Weg unter den Knoepfen, z. B. das Konto aus einer anderen App. */
  extra?: ReactNode;
};

const ERROR_KEY: Record<AuthError, TranslationKey> = {
  email_invalid: 'auth.error.emailInvalid',
  email_taken: 'auth.error.emailTaken',
  password_too_short: 'auth.error.passwordTooShort',
  not_found: 'auth.error.notFound',
  wrong_password: 'auth.error.wrongPassword',
  offline: 'auth.error.offline',
};

/**
 * Anmelden und Registrieren teilen sich dieselbe Maske. Geprueft wird jetzt
 * wirklich — die Fehler kommen aus der Kontenpruefung, nicht aus der Anzeige.
 */
export function CredentialsForm({
  title,
  subtitle,
  submitLabel,
  switchLabel,
  onSubmit,
  onSwitch,
  extra,
}: CredentialsFormProps) {
  const t = useTranslate();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit(email, password);
      // Bei Erfolg schickt der RouteGuard weiter, dieser Bildschirm verschwindet.
      if (!result.ok) setError(result.error);
    } finally {
      setBusy(false);
    }
  }

  const emailError = error === 'email_invalid' || error === 'email_taken' || error === 'not_found';
  const passwordError = error === 'password_too_short' || error === 'wrong_password';

  return (
    <Screen
      header={<Header showBack />}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button label={submitLabel} onPress={submit} loading={busy} />
          <Button label={switchLabel} variant="ghost" onPress={onSwitch} disabled={busy} />
          {extra}
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
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          icon="mail"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!busy}
          {...(emailError && error ? { error: t(ERROR_KEY[error]) } : {})}
        />
        <Input
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError(null);
          }}
          icon="lock"
          secureTextEntry
          autoCapitalize="none"
          editable={!busy}
          onSubmitEditing={submit}
          returnKeyType="done"
          {...(passwordError && error
            ? { error: t(ERROR_KEY[error]) }
            : { hint: t('auth.passwordHint') })}
        />
      </View>

      <View style={[styles.note, { gap: theme.spacing.sm }]}>
        <Text variant="caption" tone="faint">
          {t('auth.localHint')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'flex-start' },
});
