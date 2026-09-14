import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  mail,
  type MailConnectInput,
  type MailError,
  type MailProviderInfo,
  type MailResult,
} from '@/db/mail';
import type { MailAccountRow } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Badge, Button, Icon, IconButton, Input, Text } from '@/ui';

import { isEmailAddress, mailErrorKey } from './format';
import { MAIL_NOTE_KEYS, PROVIDER_LABEL_KEYS, type MailProviderChoice } from './providers';

/** So lange nach dem letzten Tippen, bis der Anbieter nachgeschlagen wird. */
const PROVIDER_DELAY_MS = 450;
/** Hoehe eines Eingabefelds — dieselbe wie in `ui/Input`. */
const FIELD_HEIGHT = 48;

type FieldError = 'email' | 'password';
type FormError = FieldError | MailError;

function isFieldError(error: FormError | null): error is FieldError {
  return error === 'email' || error === 'password';
}

export type AddAccountFormProps = {
  accountId: string;
  onConnected: (mailbox: MailAccountRow) => void;
  /** Fehlt, wenn es noch kein Postfach gibt — dann gibt es nichts, wohin zurueck. */
  onCancel?: () => void;
  /** Die Adresse steht schon da — etwa beim Neuverbinden nach „Anmeldung abgelehnt“. */
  initialEmail?: string;
  /** Der angetippte Anbieter: Beispieladresse und sein Hinweis, bevor der Dienst antwortet. */
  preset?: MailProviderChoice | null;
};

/**
 * Ein Postfach verbinden: nur Adresse und Passwort. Server, Ports und
 * Benutzername kennt der Dienst zum Anbieter selbst — beim Tippen der Adresse
 * schlaegt er ihn nach und sagt, was er braucht. Das Passwort geht nur an den
 * Dienst und verschwindet nach dem Verbinden aus dem Zustand.
 */
export function AddAccountForm({
  accountId,
  onConnected,
  onCancel,
  initialEmail,
  preset,
}: AddAccountFormProps) {
  const { t } = useI18n();
  const theme = useTheme();

  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [lookup, setLookup] = useState<{
    email: string;
    result: MailResult<MailProviderInfo>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const address = email.trim();
  const looksValid = isEmailAddress(address);

  // Entprellt nachschlagen; der Zustand wird erst in der Antwort gesetzt.
  useEffect(() => {
    if (!looksValid) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void mail.provider(address).then((result) => {
        if (!cancelled) setLookup({ email: address, result });
      });
    }, PROVIDER_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, looksValid]);

  // Nur die Antwort zur aktuellen Adresse zaehlt.
  const current = looksValid && lookup?.email === address ? lookup.result : null;
  const provider = current?.ok ? current.data : null;
  const detecting = looksValid && current === null;
  const oauthOnly = provider?.note === 'oauth_only';
  // Bis der Dienst den Anbieter kennt, sagt der angetippte, was er braucht.
  const presetNote = !provider && preset?.note ? preset.note : null;

  async function submit() {
    if (busy) return;
    if (!looksValid) {
      setError('email');
      return;
    }
    if (password.length === 0) {
      setError('password');
      return;
    }

    const input: MailConnectInput = { accountId, email: address, password };

    setBusy(true);
    setError(null);
    const result = await mail.connect(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Das Passwort liegt jetzt verschluesselt beim Dienst — hier bleibt nichts davon.
    setPassword('');
    onConnected(result.data);
  }

  const providerLabel = provider
    ? provider.provider === 'custom'
      ? t('mail.add.providerCustom', { host: provider.imapHost })
      : t('mail.add.provider', { name: provider.label })
    : null;

  return (
    <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Input
          label={t('mail.add.email')}
          placeholder={
            preset?.domain
              ? t('mailui.add.placeholderAt', { domain: preset.domain })
              : t('mail.add.emailPlaceholder')
          }
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          icon="at"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!busy}
          {...(error === 'email' ? { error: t('mail.add.error.email') } : {})}
        />
        {detecting ? (
          <Text variant="caption" tone="faint">
            {t('mail.add.detecting')}
          </Text>
        ) : null}
        {provider && providerLabel ? (
          <View style={{ gap: theme.spacing.xs }}>
            <Badge
              label={providerLabel}
              tone={oauthOnly ? 'danger' : 'neutral'}
              icon={oauthOnly ? 'warning' : 'check'}
            />
            {provider.note ? (
              <Text variant="caption" tone={oauthOnly ? 'danger' : 'muted'}>
                {t(MAIL_NOTE_KEYS[provider.note], { name: provider.label })}
              </Text>
            ) : null}
          </View>
        ) : null}
        {presetNote && preset ? (
          <Text variant="caption" tone={presetNote === 'oauth_only' ? 'danger' : 'muted'}>
            {t(MAIL_NOTE_KEYS[presetNote], { name: t(PROVIDER_LABEL_KEYS[preset.key]) })}
          </Text>
        ) : null}
        {current && !current.ok ? (
          <Text variant="caption" tone="danger">
            {t(mailErrorKey(current.error))}
          </Text>
        ) : null}
      </View>

      <PasswordField
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError(null);
        }}
        editable={!busy}
        onSubmit={() => void submit()}
        {...(error === 'password' ? { error: t('mail.add.error.password') } : {})}
      />

      {error && !isFieldError(error) ? (
        <Text variant="label" tone="danger">
          {t(mailErrorKey(error))}
        </Text>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={t('mail.add.connect')}
          icon="check"
          onPress={() => void submit()}
          loading={busy}
          disabled={oauthOnly}
        />
        {onCancel ? (
          <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} disabled={busy} />
        ) : null}
      </View>
    </View>
  );
}

type PasswordFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  onSubmit: () => void;
  error?: string;
};

/** Wie `ui/Input`, aber mit Auge zum Zeigen und dem Hinweis fuers Ausfuellen. */
function PasswordField({ value, onChangeText, editable, onSubmit, error }: PasswordFieldProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.text
      : theme.colors.border;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {t('mail.add.password')}
      </Text>
      <View
        style={[
          styles.field,
          {
            borderColor,
            borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
            backgroundColor: editable ? theme.colors.surface : theme.colors.disabledBackground,
          },
        ]}
      >
        <Icon name="key" size={18} color={theme.colors.textFaint} />
        <TextInput
          accessibilityLabel={t('mail.add.password')}
          value={value}
          onChangeText={onChangeText}
          placeholder={t('mail.add.passwordPlaceholder')}
          placeholderTextColor={theme.colors.textFaint}
          secureTextEntry={!visible}
          autoComplete="password"
          textContentType="password"
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              fontFamily: theme.fontFamily,
              fontSize: theme.fontSize.md,
              color: editable ? theme.colors.text : theme.colors.disabledText,
            },
          ]}
        />
        <IconButton
          icon={visible ? 'eyeOff' : 'eye'}
          label={visible ? t('mail.add.hidePassword') : t('mail.add.showPassword')}
          onPress={() => setVisible((shown) => !shown)}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: FIELD_HEIGHT },
  input: {
    flex: 1,
    height: '100%',
    // Der Browser zeichnet sonst einen eigenen Fokusrahmen ueber unseren.
    outlineStyle: 'none' as never,
  },
});
