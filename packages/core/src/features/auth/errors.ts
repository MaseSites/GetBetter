import type { AuthError } from '@/auth/accounts';
import type { TranslationKey } from '@/i18n';

/**
 * Was in einer Maske schiefgehen kann: alles, was der Dienst meldet, plus die
 * zwei ungleichen Passwoerter — die sieht nur das Formular.
 */
export type FormError = AuthError | 'password_mismatch';

/** Jede Meldung ist ein ganzer, ruhiger Satz. Die Texte stehen in `i18n/de-auth.ts`. */
export const ERROR_KEY: Record<FormError, TranslationKey> = {
  email_invalid: 'auth.error.emailInvalid',
  email_taken: 'auth.error.emailTaken',
  username_invalid: 'auth.error.usernameInvalid',
  username_taken: 'auth.error.usernameTaken',
  password_too_short: 'auth.error.passwordTooShort',
  password_mismatch: 'auth.error.passwordMismatch',
  not_found: 'auth.error.notFound',
  wrong_password: 'auth.error.wrongPassword',
  offline: 'auth.error.offline',
};

/** Welches Feld eine Meldung rot faerbt — der Rest bleibt, wie er ist. */
const EMAIL_ERRORS: readonly FormError[] = ['email_invalid', 'email_taken', 'not_found'];
const USERNAME_ERRORS: readonly FormError[] = ['username_invalid', 'username_taken'];
const PASSWORD_ERRORS: readonly FormError[] = ['password_too_short', 'wrong_password'];

function belongsTo(field: readonly FormError[], error: FormError | null): boolean {
  return error !== null && field.includes(error);
}

export const isEmailError = (error: FormError | null) => belongsTo(EMAIL_ERRORS, error);
export const isUsernameError = (error: FormError | null) => belongsTo(USERNAME_ERRORS, error);
export const isPasswordError = (error: FormError | null) => belongsTo(PASSWORD_ERRORS, error);
export const isRepeatError = (error: FormError | null) => error === 'password_mismatch';

/**
 * Was zu keinem Feld gehoert — heute nur: der Dienst antwortet nicht. Solche
 * Meldungen stehen ueber den Knoepfen, damit keine im Stillen verschwindet.
 */
export function isGeneralError(error: FormError | null): boolean {
  if (error === null) return false;
  return (
    !isEmailError(error) &&
    !isUsernameError(error) &&
    !isPasswordError(error) &&
    !isRepeatError(error)
  );
}
