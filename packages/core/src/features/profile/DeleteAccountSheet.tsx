import { useState } from 'react';
import { View } from 'react-native';

import { deleteOwnAccount, type AccountDeletion } from '@/auth/accounts';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Input, Sheet, Text } from '@/ui';

/** Was am Feld steht, wenn es nicht geklappt hat. */
const FAILURE: Readonly<Record<Exclude<AccountDeletion, 'ok'>, TranslationKey>> = {
  wrong_password: 'account.delete.wrongPassword',
  too_many: 'account.delete.tooMany',
  offline: 'account.delete.offline',
};

/**
 * Das eigene Konto loeschen (Apple 5.1.1(v), Datenschutz): ein Satz, was
 * wegfaellt, das Passwort als Bestaetigung, ein roter Knopf. Das geht nicht
 * rueckgaengig — darum die eine Rueckfrage, die es sonst in der App nicht gibt.
 */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTranslate();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('account.delete.title')}>
      {/* Jedes Oeffnen beginnt leer: der Schluessel setzt das Formular neu auf. */}
      <DeleteForm key={visible ? 'open' : 'closed'} />
    </Sheet>
  );
}

function DeleteForm() {
  const t = useTranslate();
  const theme = useTheme();
  const { account, signOut } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy || !account || password.length === 0) return;
    setBusy(true);
    const result = await deleteOwnAccount(account.id, password);
    if (result !== 'ok') {
      setBusy(false);
      setError(FAILURE[result]);
      return;
    }
    // Beim Dienst ist alles weg; hier nur noch abmelden.
    await signOut();
  }

  return (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
      <Text variant="body">{t('account.delete.body')}</Text>
      <Input
        accessibilityLabel={t('account.delete.password')}
        placeholder={t('account.delete.password')}
        value={password}
        onChangeText={(next) => {
          setPassword(next);
          setError(null);
        }}
        secureTextEntry
        autoCapitalize="none"
        error={error ? t(error) : undefined}
        returnKeyType="done"
        onSubmitEditing={() => void remove()}
      />
      <Button
        label={t('account.delete.confirm')}
        icon="trash"
        variant="danger"
        loading={busy}
        disabled={password.length === 0}
        onPress={() => {
          void remove();
        }}
      />
    </View>
  );
}
