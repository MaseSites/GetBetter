import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  mail,
  type MailConnectInput,
  type MailError,
  type MailProviderInfo,
  type MailProviderNote,
  type MailResult,
} from '@/db/mail';
import type { MailAccountRow } from '@/db/types';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Badge, Button, Chip, Icon, IconButton, Input, Text } from '@/ui';

import { isEmailAddress, mailErrorKey, parsePort } from './format';

/** So lange nach dem letzten Tippen, bis der Anbieter nachgeschlagen wird. */
const PROVIDER_DELAY_MS = 450;
/** Hoehe eines Eingabefelds — dieselbe wie in `ui/Input`. */
const FIELD_HEIGHT = 48;
/** Die ueblichen Ports, solange der Anbieter noch nicht bekannt ist. */
const DEFAULT_IMAP_PORT = 993;
const DEFAULT_SMTP_PORT = 465;

type FieldError = 'email' | 'password' | 'port';
type FormError = FieldError | MailError;

/** Leer heisst: der Dienst nimmt, was er zum Anbieter weiss. */
type ServerFields = { host: string; port: string; secure: boolean | null };

const EMPTY_SERVER: ServerFields = { host: '', port: '', secure: null };

const NOTE_KEY: Record<MailProviderNote, TranslationKey> = {
  app_password: 'mail.add.note.appPassword',
  enable_imap: 'mail.add.note.enableImap',
  oauth_only: 'mail.add.note.oauthOnly',
};

function isFieldError(error: FormError | null): error is FieldError {
  return error === 'email' || error === 'password' || error === 'port';
}

export type AddAccountFormProps = {
  accountId: string;
  onConnected: (mailbox: MailAccountRow) => void;
  /** Fehlt, wenn es noch kein Postfach gibt — dann gibt es nichts, wohin zurueck. */
  onCancel?: () => void;
};

/**
 * Ein Postfach verbinden: Adresse, Passwort, optional Anzeigename und die
 * Server. Beim Tippen der Adresse schlaegt der Dienst den Anbieter nach und
 * sagt, was er braucht. Das Passwort geht nur an den Dienst und verschwindet
 * nach dem Verbinden aus dem Zustand.
 */
export function AddAccountForm({ accountId, onConnected, onCancel }: AddAccountFormProps) {
  const { t } = useI18n();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [username, setUsername] = useState('');
  const [imap, setImap] = useState<ServerFields>(EMPTY_SERVER);
  const [smtp, setSmtp] = useState<ServerFields>(EMPTY_SERVER);
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
    const imapPort = parsePort(imap.port);
    const smtpPort = parsePort(smtp.port);
    if (imapPort === null || smtpPort === null) {
      setAdvanced(true);
      setError('port');
      return;
    }

    const name = displayName.trim();
    const login = username.trim();
    const imapHost = imap.host.trim();
    const smtpHost = smtp.host.trim();
    const input: MailConnectInput = {
      accountId,
      email: address,
      password,
      ...(name.length > 0 ? { displayName: name } : {}),
      ...(login.length > 0 ? { username: login } : {}),
      ...(imapHost.length > 0 ? { imapHost } : {}),
      ...(imapPort !== undefined ? { imapPort } : {}),
      ...(imap.secure !== null ? { imapSecure: imap.secure } : {}),
      ...(smtpHost.length > 0 ? { smtpHost } : {}),
      ...(smtpPort !== undefined ? { smtpPort } : {}),
      ...(smtp.secure !== null ? { smtpSecure: smtp.secure } : {}),
    };

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
          placeholder={t('mail.add.emailPlaceholder')}
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
                {t(NOTE_KEY[provider.note], { name: provider.label })}
              </Text>
            ) : null}
          </View>
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

      <Input
        label={t('mail.add.displayName')}
        placeholder={t('mail.add.displayNamePlaceholder')}
        hint={t('common.optional')}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        editable={!busy}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mail.add.advanced')}
        accessibilityState={{ expanded: advanced }}
        onPress={() => setAdvanced((open) => !open)}
        style={({ pressed }) => [
          styles.row,
          { gap: theme.spacing.xs, paddingVertical: theme.spacing.xs, opacity: pressed ? 0.5 : 1 },
        ]}
      >
        <Icon name={advanced ? 'down' : 'forward'} size={16} color={theme.colors.textMuted} />
        <Text variant="label" tone="muted">
          {t('mail.add.advanced')}
        </Text>
      </Pressable>

      {advanced ? (
        <View style={{ gap: theme.spacing.lg }}>
          <ServerSection
            title={t('mail.add.imap')}
            fields={imap}
            onChange={(patch) => setImap((previous) => ({ ...previous, ...patch }))}
            hostPlaceholder={provider?.imapHost ?? t('mail.add.imapHostPlaceholder')}
            portPlaceholder={String(provider?.imapPort ?? DEFAULT_IMAP_PORT)}
            secureDefault={provider?.imapSecure ?? true}
            editable={!busy}
          />
          <ServerSection
            title={t('mail.add.smtp')}
            fields={smtp}
            onChange={(patch) => setSmtp((previous) => ({ ...previous, ...patch }))}
            hostPlaceholder={provider?.smtpHost ?? t('mail.add.smtpHostPlaceholder')}
            portPlaceholder={String(provider?.smtpPort ?? DEFAULT_SMTP_PORT)}
            secureDefault={provider?.smtpSecure ?? true}
            editable={!busy}
          />
          {error === 'port' ? (
            <Text variant="caption" tone="danger">
              {t('mail.add.error.port')}
            </Text>
          ) : null}
          <Input
            label={t('mail.add.username')}
            placeholder={t('mail.add.usernamePlaceholder')}
            hint={t('common.optional')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!busy}
          />
        </View>
      ) : null}

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

type ServerSectionProps = {
  title: string;
  fields: ServerFields;
  onChange: (patch: Partial<ServerFields>) => void;
  hostPlaceholder: string;
  portPlaceholder: string;
  secureDefault: boolean;
  editable: boolean;
};

/** Server, Port und SSL fuer den Eingang oder den Ausgang. */
function ServerSection({
  title,
  fields,
  onChange,
  hostPlaceholder,
  portPlaceholder,
  secureDefault,
  editable,
}: ServerSectionProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const secure = fields.secure ?? secureDefault;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="section" tone="muted">
        {title}
      </Text>
      <Input
        label={t('mail.add.host')}
        placeholder={hostPlaceholder}
        value={fields.host}
        onChangeText={(host) => onChange({ host })}
        keyboardType="url"
        autoCapitalize="none"
        editable={editable}
      />
      <View style={[styles.row, styles.bottom, { gap: theme.spacing.md }]}>
        <View style={styles.grow}>
          <Input
            label={t('mail.add.port')}
            placeholder={portPlaceholder}
            value={fields.port}
            onChangeText={(port) => onChange({ port })}
            keyboardType="number-pad"
            autoCapitalize="none"
            editable={editable}
          />
        </View>
        <View style={styles.chipSlot}>
          <Chip
            label={t('mail.add.ssl')}
            selected={secure}
            disabled={!editable}
            onPress={() => onChange({ secure: !secure })}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  bottom: { alignItems: 'flex-end' },
  grow: { flex: 1 },
  chipSlot: { height: FIELD_HEIGHT, justifyContent: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: FIELD_HEIGHT },
  input: {
    flex: 1,
    height: '100%',
    // Der Browser zeichnet sonst einen eigenen Fokusrahmen ueber unseren.
    outlineStyle: 'none' as never,
  },
});
