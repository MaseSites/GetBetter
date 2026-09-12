import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { mail, type MailError } from '@/db/mail';
import type { MailAccountRow } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Chip, Input, Sheet, Text } from '@/ui';

import { isEmailAddress, mailErrorKey, parseAddressList, type ComposeDraft } from './format';

/** Die Nachricht braucht Platz — ein Zitat beim Antworten ist schnell laenger. */
const BODY_MIN_HEIGHT = 200;

type FieldError = 'from' | 'to' | 'cc';
type ComposeError = FieldError | MailError;

function isFieldError(error: ComposeError | null): error is FieldError {
  return error === 'from' || error === 'to' || error === 'cc';
}

export type ComposeSheetProps = {
  visible: boolean;
  draft: ComposeDraft;
  /** Wechselt bei jedem Oeffnen — dann beginnt das Formular mit dem neuen Entwurf. */
  draftKey: number;
  mailboxes: readonly MailAccountRow[];
  onClose: () => void;
  onSent: () => void;
};

/** Eine neue E-Mail oder eine Antwort schreiben und ueber eines der Postfaecher senden. */
export function ComposeSheet({
  visible,
  draft,
  draftKey,
  mailboxes,
  onClose,
  onSent,
}: ComposeSheetProps) {
  const { t } = useI18n();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={draft.inReplyTo ? t('mail.compose.replyTitle') : t('mail.compose.title')}
      fullScreen
    >
      <ComposeForm key={draftKey} draft={draft} mailboxes={mailboxes} onSent={onSent} />
    </Sheet>
  );
}

function ComposeForm({
  draft,
  mailboxes,
  onSent,
}: {
  draft: ComposeDraft;
  mailboxes: readonly MailAccountRow[];
  onSent: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const [from, setFrom] = useState<string | null>(draft.mailAccountId);
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [showCc, setShowCc] = useState(draft.cc.length > 0);
  const [subject, setSubject] = useState(draft.subject);
  const [text, setText] = useState(draft.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ComposeError | null>(null);

  // Ein getrenntes Postfach faellt auf das erste zurueck.
  const fromId =
    from && mailboxes.some((box) => box.id === from) ? from : (mailboxes[0]?.id ?? null);

  async function send() {
    if (busy) return;
    if (!fromId) {
      setError('from');
      return;
    }
    const toList = parseAddressList(to);
    if (toList.length === 0 || !toList.every(isEmailAddress)) {
      setError('to');
      return;
    }
    const ccList = showCc ? parseAddressList(cc) : [];
    if (!ccList.every(isEmailAddress)) {
      setError('cc');
      return;
    }

    setBusy(true);
    setError(null);
    const result = await mail.send({
      mailAccountId: fromId,
      to: toList,
      ...(ccList.length > 0 ? { cc: ccList } : {}),
      subject: subject.trim(),
      text,
      ...(draft.inReplyTo ? { inReplyTo: draft.inReplyTo } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSent();
  }

  function edit(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setError(null);
    };
  }

  return (
    <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" tone="muted">
          {t('mail.compose.from')}
        </Text>
        <View style={[styles.wrap, { gap: theme.spacing.sm }]}>
          {mailboxes.map((box) => (
            <Chip
              key={box.id}
              label={box.email}
              selected={box.id === fromId}
              disabled={busy}
              onPress={() => {
                setFrom(box.id);
                setError(null);
              }}
            />
          ))}
        </View>
        {error === 'from' ? (
          <Text variant="caption" tone="danger">
            {t('mail.compose.error.from')}
          </Text>
        ) : null}
      </View>

      <Input
        label={t('mail.compose.to')}
        placeholder={t('mail.compose.addressPlaceholder')}
        value={to}
        onChangeText={edit(setTo)}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!busy}
        {...(error === 'to'
          ? { error: t('mail.compose.error.to') }
          : { hint: t('mail.compose.addressHint') })}
      />

      {showCc ? (
        <Input
          label={t('mail.compose.cc')}
          placeholder={t('mail.compose.addressPlaceholder')}
          value={cc}
          onChangeText={edit(setCc)}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!busy}
          {...(error === 'cc' ? { error: t('mail.compose.error.cc') } : {})}
        />
      ) : (
        <Button
          label={t('mail.compose.addCc')}
          icon="plus"
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={() => setShowCc(true)}
          disabled={busy}
        />
      )}

      <Input
        label={t('mail.compose.subject')}
        placeholder={t('mail.compose.subjectPlaceholder')}
        value={subject}
        onChangeText={edit(setSubject)}
        editable={!busy}
      />

      <BodyField value={text} onChangeText={edit(setText)} editable={!busy} />

      {error && !isFieldError(error) ? (
        <Text variant="label" tone="danger">
          {t(mailErrorKey(error))}
        </Text>
      ) : null}

      <Button
        label={t('mail.compose.send')}
        icon="send"
        onPress={() => void send()}
        loading={busy}
        disabled={mailboxes.length === 0}
      />
    </View>
  );
}

/** Das mehrzeilige Feld fuer die Nachricht — hoeher als `ui/Input`, oben ausgerichtet. */
function BodyField({
  value,
  onChangeText,
  editable,
}: {
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {t('mail.compose.body')}
      </Text>
      <TextInput
        accessibilityLabel={t('mail.compose.body')}
        value={value}
        onChangeText={onChangeText}
        placeholder={t('mail.compose.bodyPlaceholder')}
        placeholderTextColor={theme.colors.textFaint}
        multiline
        textAlignVertical="top"
        autoCapitalize="sentences"
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.body,
          {
            borderColor: focused ? theme.colors.text : theme.colors.border,
            borderRadius: theme.radii.sm,
            padding: theme.spacing.md,
            backgroundColor: editable ? theme.colors.surface : theme.colors.disabledBackground,
            fontFamily: theme.fontFamily,
            fontSize: theme.fontSize.md,
            lineHeight: theme.lineHeight.md,
            color: editable ? theme.colors.text : theme.colors.disabledText,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  body: {
    minHeight: BODY_MIN_HEIGHT,
    borderWidth: 1,
    // Der Browser zeichnet sonst einen eigenen Fokusrahmen ueber unseren.
    outlineStyle: 'none' as never,
  },
});
