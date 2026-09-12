import { useState } from 'react';

import type { AuthResult } from '@/auth/accounts';
import { useTranslate } from '@/i18n';
import { Input } from '@/ui';

import { AuthShell } from './AuthShell';
import { ERROR_KEY, isEmailError, isGeneralError, isPasswordError, type FormError } from './errors';

export type SignInFormProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  switchLabel: string;
  onSubmit: (email: string, password: string) => Promise<AuthResult>;
  onSwitch: () => void;
  /** Was der Avatar oben dazu sagt. */
  bubble?: string;
};

/**
 * Anmelden bleibt schlank: E-Mail und Passwort, mehr braucht es nicht. Wer
 * noch kein Konto hat, geht ueber den Weg darunter zum Registrieren.
 */
export function SignInForm({
  title,
  subtitle,
  submitLabel,
  switchLabel,
  onSubmit,
  onSwitch,
  bubble,
}: SignInFormProps) {
  const t = useTranslate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

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

  function change(set: (value: string) => void) {
    return (value: string) => {
      set(value);
      setError(null);
    };
  }

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      submitLabel={submitLabel}
      switchLabel={switchLabel}
      onSubmit={submit}
      onSwitch={onSwitch}
      busy={busy}
      {...(bubble === undefined ? {} : { bubble })}
      {...(isGeneralError(error) && error ? { error: t(ERROR_KEY[error]) } : {})}
    >
      <Input
        label={t('auth.email')}
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChangeText={change(setEmail)}
        icon="mail"
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!busy}
        {...(isEmailError(error) && error ? { error: t(ERROR_KEY[error]) } : {})}
      />
      <Input
        label={t('auth.password')}
        placeholder={t('auth.passwordPlaceholder')}
        value={password}
        onChangeText={change(setPassword)}
        icon="lock"
        secureTextEntry
        autoCapitalize="none"
        editable={!busy}
        onSubmitEditing={submit}
        returnKeyType="done"
        {...(isPasswordError(error) && error
          ? { error: t(ERROR_KEY[error]) }
          : { hint: t('auth.passwordHint') })}
      />
    </AuthShell>
  );
}
