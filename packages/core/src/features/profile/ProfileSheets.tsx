import type { UsernameSave } from '@/auth/accounts';
import { AccountFieldSheet } from '@/features/personalize/AccountFieldSheet';
import { checkUsername, type UsernameCheck } from '@/features/personalize/username';
import { formatDayMonth, useI18n, type TranslationKey } from '@/i18n';
import { useApp } from '@/state/AppContext';

import { PhotoSheet } from './PhotoSheet';
import { usernameFreeAt } from './usernameCooldown';

/** Was man an sich selbst aendert — im Profil wie in den Einstellungen. */
export type ProfileSheet = 'nickname' | 'username' | 'photo';

/** Was eine besetzte, unmoegliche oder zu fruehe Wahl am Feld sagt. */
const USERNAME_MESSAGE: Readonly<
  Record<Exclude<UsernameCheck, 'ok'> | Exclude<UsernameSave, 'ok'>, TranslationKey>
> = {
  empty: 'settings.username.empty',
  invalid: 'settings.username.invalid',
  taken: 'settings.username.taken',
  cooldown: 'settings.username.cooldown',
  offline: 'settings.username.offline',
};

/**
 * Die Blaetter fuer Spitzname, Benutzername und Profilbild — einmal gebaut,
 * vom Profil und von den Einstellungen geoeffnet, damit beide dasselbe tun.
 *
 * Der Spitzname geht immer. Den Benutzernamen gibt es einmal im Monat neu:
 * das Feld sagt vorher, ab wann (`usernameFreeAt`), und der Dienst hat das
 * letzte Wort (`username_cooldown`).
 */
export function ProfileSheets({
  open,
  onClose,
}: {
  open: ProfileSheet | null;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const { account, setFirstName, setUsername } = useApp();
  if (!account) return null;
  const accountId = account.id;

  const freeAt = usernameFreeAt(account.usernameChangedAt);
  const usernameHint = freeAt
    ? t('settings.username.locked', { date: formatDayMonth(language, freeAt) })
    : t('settings.username.hint');

  async function saveUsername(wanted: string): Promise<TranslationKey | null> {
    const free = await checkUsername(wanted, accountId);
    if (free !== 'ok') return USERNAME_MESSAGE[free];
    // Zwischen Frage und Antwort kann ihn jemand belegen — der Dienst entscheidet.
    const saved = await setUsername(wanted);
    return saved === 'ok' ? null : USERNAME_MESSAGE[saved];
  }

  return (
    <>
      <AccountFieldSheet
        visible={open === 'nickname'}
        title={t('settings.nickname')}
        label={t('settings.nickname')}
        hint={t('settings.nickname.hint')}
        value={account.firstName}
        autoCapitalize="words"
        onClose={onClose}
        onSave={async (next) => {
          await setFirstName(next);
          return null;
        }}
      />
      <AccountFieldSheet
        visible={open === 'username'}
        title={t('settings.username')}
        label={t('settings.username')}
        hint={usernameHint}
        value={account.username}
        autoCapitalize="none"
        onClose={onClose}
        onSave={saveUsername}
      />
      <PhotoSheet visible={open === 'photo'} onClose={onClose} />
    </>
  );
}
