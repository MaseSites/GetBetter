import { useState } from 'react';
import { View } from 'react-native';

import { mail, mailErrorOf, type MailError } from '@/db/mail';
import type { MailAccountRow } from '@/db/types';
import { useI18n, type Language, type Translate } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Divider, Sheet, SwipeRow, Text } from '@/ui';

import { AddAccountForm } from './AddAccountForm';
import { ageOf, formatAge, mailErrorKey } from './format';

export type AccountsSheetProps = {
  visible: boolean;
  mailboxes: readonly MailAccountRow[];
  onClose: () => void;
};

/**
 * Die verbundenen Postfaecher mit ihrem Stand; nach links wischen trennt eines.
 * Ohne Postfach steht gleich das Formular zum Verbinden da.
 */
export function AccountsSheet({ visible, mailboxes, onClose }: AccountsSheetProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const account = useAccount();

  const [adding, setAdding] = useState(false);
  // Ein neuer Schluessel baut das Formular neu auf — so bleibt kein Passwort im Zustand.
  const [formKey, setFormKey] = useState(0);
  const [failure, setFailure] = useState<MailError | null>(null);

  const showForm = adding || mailboxes.length === 0;

  function close() {
    setAdding(false);
    setFailure(null);
    setFormKey((key) => key + 1);
    onClose();
  }

  function backToList() {
    setAdding(false);
    setFormKey((key) => key + 1);
  }

  function connected() {
    // Das erste Postfach: gleich in den Posteingang. Sonst zurueck zur Liste.
    if (mailboxes.length === 0) {
      close();
      return;
    }
    backToList();
  }

  async function disconnect(id: string) {
    setFailure(null);
    const result = await mail.disconnect(id);
    if (!result.ok) setFailure(result.error);
  }

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={showForm ? t('mail.add.title') : t('mail.accounts.title')}
    >
      {showForm ? (
        <AddAccountForm
          key={formKey}
          accountId={account.id}
          onConnected={connected}
          {...(mailboxes.length > 0 ? { onCancel: backToList } : {})}
        />
      ) : (
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <Card>
            <View>
              {mailboxes.map((box, index) => (
                <View key={box.id}>
                  {index > 0 ? <Divider /> : null}
                  <SwipeRow
                    onDelete={() => void disconnect(box.id)}
                    deleteLabel={t('mail.accounts.disconnect')}
                  >
                    <MailboxRow mailbox={box} />
                  </SwipeRow>
                </View>
              ))}
            </View>
          </Card>
          {failure ? (
            <Text variant="label" tone="danger">
              {t(mailErrorKey(failure))}
            </Text>
          ) : null}
          <Button
            label={t('mail.accounts.add')}
            icon="plus"
            variant="secondary"
            onPress={() => {
              setFailure(null);
              setAdding(true);
            }}
          />
        </View>
      )}
    </Sheet>
  );
}

/** Wie es um den Abgleich eines Postfachs steht. */
function statusOf(
  box: MailAccountRow,
  t: Translate,
  language: Language,
): { text: string; danger: boolean } {
  if (box.lastError) {
    const error = mailErrorOf(box.lastError);
    return {
      text: error === 'unknown' ? t('mail.accounts.syncError') : t(mailErrorKey(error)),
      danger: true,
    };
  }
  const age = box.lastSyncAt ? ageOf(box.lastSyncAt) : null;
  if (age === null) return { text: t('mail.accounts.neverSynced'), danger: false };
  if (age === 'now') return { text: t('mail.accounts.syncedNow'), danger: false };
  return { text: t('mail.accounts.synced', { when: formatAge(language, age) }), danger: false };
}

/** Adresse, Anzeigename und wie es um den Abgleich steht — ein Fehler rot. */
function MailboxRow({ mailbox }: { mailbox: MailAccountRow }) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const name = mailbox.displayName.trim();
  const status = statusOf(mailbox, t, language);

  return (
    <View
      accessibilityLabel={`${mailbox.email}, ${status.text}`}
      style={{ paddingVertical: theme.spacing.md, gap: theme.spacing.xs }}
    >
      <Text variant="body" numberOfLines={1} style={{ fontWeight: theme.fontWeight.semibold }}>
        {mailbox.email}
      </Text>
      {name.length > 0 && name !== mailbox.email ? (
        <Text variant="label" tone="muted" numberOfLines={1}>
          {name}
        </Text>
      ) : null}
      <Text variant="caption" tone={status.danger ? 'danger' : 'faint'}>
        {status.text}
      </Text>
    </View>
  );
}
