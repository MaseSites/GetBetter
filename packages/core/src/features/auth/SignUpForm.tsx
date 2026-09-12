import { useEffect, useState } from 'react';

import {
  MIN_PASSWORD_LENGTH,
  isEmailShaped,
  isUsernameShaped,
  normaliseUsername,
  type AuthResult,
} from '@/auth/accounts';
import { fetchByUsername } from '@/db/service';
import { useTranslate } from '@/i18n';
import { Input } from '@/ui';

import { AuthShell } from './AuthShell';
import {
  ERROR_KEY,
  isEmailError,
  isGeneralError,
  isPasswordError,
  isRepeatError,
  isUsernameError,
  type FormError,
} from './errors';

/**
 * Wie lange nach dem letzten Tastendruck gewartet wird, bevor der Dienst
 * gefragt wird. Lang genug, dass beim Tippen keine Anfrage je Zeichen entsteht.
 */
const CHECK_DELAY = 600;

/** Die letzte Antwort des Dienstes: zu welchem Namen, und ob ihn schon jemand hat. */
type NameAnswer = { name: string; taken: boolean };

export type SignUpFormProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  switchLabel: string;
  onSubmit: (email: string, password: string, username: string) => Promise<AuthResult>;
  onSwitch: () => void;
  /** Was der Avatar oben dazu sagt. */
  bubble?: string;
};

/**
 * Die volle Maske: E-Mail, Benutzername, Passwort, Passwort wiederholen.
 *
 * Der Benutzername gehoert schon hierher — unter ihm findet man sich spaeter
 * fuer Kalender und Haushalte. Wie der Assistent einen nennen soll, kommt
 * erst nach dem Registrieren; das ist nur ein Spitzname.
 *
 * Ob ein Name noch frei ist, weiss nur der Dienst. Deshalb fragt die Maske
 * entprellt nach — und verlaesst sich am Ende trotzdem auf seine Antwort.
 */
export function SignUpForm({
  title,
  subtitle,
  submitLabel,
  switchLabel,
  onSubmit,
  onSwitch,
  bubble,
}: SignUpFormProps) {
  const t = useTranslate();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [answer, setAnswer] = useState<NameAnswer | null>(null);

  const wantedName = normaliseUsername(username);
  const shaped = isUsernameShaped(wantedName);
  // Eine Antwort zaehlt nur, solange der Name noch derselbe ist.
  const known = answer !== null && answer.name === wantedName ? answer : null;
  const nameTaken = known !== null && known.taken;
  const nameFree = known !== null && !known.taken;
  const checking = shaped && known === null;

  useEffect(() => {
    const name = normaliseUsername(username);
    if (!isUsernameShaped(name)) return;

    // Eine spaetere Eingabe macht die laufende Antwort wertlos.
    let current = true;
    const timer = setTimeout(() => {
      void fetchByUsername(name).then((result) => {
        if (current) setAnswer({ name, taken: result.ok });
      });
    }, CHECK_DELAY);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [username]);

  /** Was die Maske selbst schon sieht — den Rest sagt der Dienst. */
  function firstProblem(): FormError | null {
    if (!isEmailShaped(email)) return 'email_invalid';
    if (!shaped) return 'username_invalid';
    if (nameTaken) return 'username_taken';
    if (password.length < MIN_PASSWORD_LENGTH) return 'password_too_short';
    if (password !== repeat) return 'password_mismatch';
    return null;
  }

  async function submit() {
    if (busy) return;
    const problem = firstProblem();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit(email, password, wantedName);
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

  function nameHint(): string {
    if (checking) return t('auth.usernameChecking');
    if (nameFree) return t('auth.usernameFree');
    return t('auth.usernameHint');
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
        label={t('auth.username')}
        value={username}
        onChangeText={change(setUsername)}
        icon="at"
        autoCapitalize="none"
        editable={!busy}
        {...(isUsernameError(error) && error
          ? { error: t(ERROR_KEY[error]) }
          : nameTaken
            ? { error: t('auth.error.usernameTaken') }
            : { hint: nameHint() })}
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
        {...(isPasswordError(error) && error
          ? { error: t(ERROR_KEY[error]) }
          : { hint: t('auth.passwordHint') })}
      />
      <Input
        label={t('auth.passwordRepeat')}
        placeholder={t('auth.passwordRepeatPlaceholder')}
        value={repeat}
        onChangeText={change(setRepeat)}
        icon="lock"
        secureTextEntry
        autoCapitalize="none"
        editable={!busy}
        onSubmitEditing={submit}
        returnKeyType="done"
        {...(isRepeatError(error) && error ? { error: t(ERROR_KEY[error]) } : {})}
      />
    </AuthShell>
  );
}
