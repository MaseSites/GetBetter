import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  mail,
  mailErrorOf,
  type MailError,
  type MailProviderInfo,
  type MailResult,
} from '@/db/mail';
import type { MailAccountRow } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Sheet, Text } from '@/ui';

import { mailErrorKey } from './format';
import { MAIL_NOTE_KEYS } from './providers';
import { mailboxDomain } from './threads';

export type FixSheetProps = {
  mailbox: MailAccountRow | null;
  onClose: () => void;
  /** Getrennt — jetzt mit dieser Adresse neu verbinden. */
  onReconnect: (email: string) => void;
};

/**
 * „gmx.ch: Anmeldung abgelehnt · Beheben“: nennt die Ursache, die der Dienst
 * zum Anbieter kennt, und verbindet neu. Ein Passwort laesst sich beim Dienst
 * nicht tauschen — deshalb erst trennen, mit Rueckfrage.
 */
export function FixSheet({ mailbox, onClose, onReconnect }: FixSheetProps) {
  const { t } = useI18n();
  const error = mailErrorOf(mailbox?.lastError);
  const domain = mailbox ? mailboxDomain(mailbox.email) : '';

  return (
    <Sheet
      visible={mailbox !== null}
      onClose={onClose}
      title={t(error === 'auth_failed' ? 'mailui.fix.authTitle' : 'mailui.fix.syncTitle', {
        domain,
      })}
    >
      {mailbox ? (
        <FixContent mailbox={mailbox} error={error} onClose={onClose} onReconnect={onReconnect} />
      ) : null}
    </Sheet>
  );
}

function FixContent({
  mailbox,
  error,
  onClose,
  onReconnect,
}: {
  mailbox: MailAccountRow;
  error: MailError;
  onClose: () => void;
  onReconnect: (email: string) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MailError | null>(null);
  const [lookup, setLookup] = useState<MailResult<MailProviderInfo> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void mail.provider(mailbox.email).then((result) => {
      if (!cancelled) setLookup(result);
    });
    return () => {
      cancelled = true;
    };
  }, [mailbox.email]);

  const provider = lookup?.ok ? lookup.data : null;
  const cause =
    error === 'auth_failed' && provider?.note
      ? t(MAIL_NOTE_KEYS[provider.note], { name: provider.label })
      : t(mailErrorKey(error));

  async function reconnect() {
    setBusy(true);
    setFailure(null);
    const result = await mail.disconnect(mailbox.id);
    setBusy(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    onReconnect(mailbox.email);
  }

  return (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
      <Text variant="body">{confirming ? t('mailui.fix.confirmBody') : cause}</Text>
      {failure ? (
        <Text variant="label" tone="danger">
          {t(mailErrorKey(failure))}
        </Text>
      ) : null}
      {confirming ? (
        <Button
          label={t('mailui.fix.confirm')}
          variant="danger"
          loading={busy}
          onPress={() => void reconnect()}
        />
      ) : (
        <Button
          label={t('mailui.fix.reconnect')}
          icon="refresh"
          onPress={() => setConfirming(true)}
        />
      )}
      <Button label={t('common.cancel')} variant="ghost" onPress={onClose} disabled={busy} />
    </View>
  );
}
