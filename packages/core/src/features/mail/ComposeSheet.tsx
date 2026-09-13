import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { MailError, MailMessage } from '@/db/mail';
import type { MailAccountRow } from '@/db/types';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, Menu, Sheet, Text, measureAnchor, type MenuAnchor } from '@/ui';

import {
  canSend,
  isDirty,
  suggestAddresses,
  type ComposeState,
  type RecipientField,
} from './compose';
import { mailErrorKey } from './format';
import { TextButton } from './MailChrome';
import { FieldRow, TokenField } from './TokenField';

/** Der Text braucht Platz — ein Antwort-Zitat steht eingeklappt darunter. */
const BODY_MIN_HEIGHT = 220;

export type ComposeError = MailError | 'recipients';

export type ComposeSheetProps = {
  visible: boolean;
  state: ComposeState;
  /** Wie das Blatt geoeffnet wurde — nur Abweichungen fragen beim Abbrechen nach. */
  initial: ComposeState;
  mailboxes: readonly MailAccountRow[];
  messages: readonly MailMessage[];
  contactNames: readonly string[];
  own: ReadonlySet<string>;
  busy: boolean;
  error: ComposeError | null;
  onChange: (patch: Partial<ComposeState>) => void;
  onSend: () => void;
  /** Nach unten gewischt: der Entwurf wird zur Leiste. */
  onMinimize: () => void;
  /** Abbrechen ohne Aenderung. */
  onClose: () => void;
  onSaveAndClose: () => void;
  onDiscard: () => void;
};

type Open = { which: 'cancel' | 'from'; anchor: MenuAnchor; open: boolean };

/**
 * Schreiben als grosses Blatt. Oben Abbrechen, Titel, Senden; darunter Zeilen
 * von 44: An, „Cc/Bcc, Von“ (ein Tipp teilt sie), Betreff — und der Text.
 * Nach unten wischen minimiert; Abbrechen mit Inhalt fragt: sichern oder löschen.
 */
export function ComposeSheet(props: ComposeSheetProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const { state, onChange } = props;

  const cancelNode = useRef<View>(null);
  const fromNode = useRef<View>(null);
  const [menu, setMenu] = useState<Open | null>(null);
  const [showQuote, setShowQuote] = useState(false);

  const from =
    props.mailboxes.find((box) => box.id === state.mailAccountId) ?? props.mailboxes[0] ?? null;
  const sendable = canSend(state) && !props.busy;
  const title = state.subject.trim() || t('mailui.compose.new');

  async function open(which: Open['which']) {
    const anchor = await measureAnchor((which === 'cancel' ? cancelNode : fromNode).current);
    if (anchor) setMenu({ which, anchor, open: true });
  }

  function cancel() {
    if (isDirty(state, props.initial)) void open('cancel');
    else props.onClose();
  }

  function suggestionsFor(field: RecipientField) {
    const input = field === 'to' ? state.toInput : field === 'cc' ? state.ccInput : state.bccInput;
    return suggestAddresses(props.messages, input, {
      exclude: [...state.to, ...state.cc, ...state.bcc],
      own: props.own,
      contactNames: props.contactNames,
    });
  }

  const header = (
    <View style={[styles.row, { minHeight: HIT_TARGET, gap: theme.spacing.sm }]}>
      <TextButton ref={cancelNode} label={t('common.cancel')} onPress={cancel} />
      <Text
        variant="body"
        numberOfLines={1}
        align="center"
        style={[styles.grow, { fontWeight: theme.fontWeight.semibold }]}
      >
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mailui.compose.send')}
        accessibilityState={{ disabled: !sendable, busy: props.busy }}
        disabled={!sendable}
        onPress={props.onSend}
        style={({ pressed }) => [
          styles.center,
          {
            width: HIT_TARGET,
            height: HIT_TARGET,
            borderRadius: theme.radii.pill,
            backgroundColor: sendable ? theme.colors.accent : theme.colors.disabledBackground,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon
          name="send"
          size={22}
          color={sendable ? theme.colors.textOnAccent : theme.colors.disabledText}
        />
      </Pressable>
    </View>
  );

  const menuItems =
    menu?.which === 'cancel'
      ? [
          {
            key: 'save',
            label: t('mailui.compose.saveDraft'),
            icon: 'note' as const,
            onPress: props.onSaveAndClose,
          },
          {
            key: 'discard',
            label: t('mailui.compose.deleteDraft'),
            icon: 'trash' as const,
            destructive: true,
            onPress: props.onDiscard,
          },
        ]
      : props.mailboxes.map((box) => ({
          key: box.id,
          label: box.email,
          selected: box.id === from?.id,
          onPress: () => onChange({ mailAccountId: box.id }),
        }));

  return (
    <Sheet visible={props.visible} onClose={props.onMinimize} detent="large" header={header}>
      <View style={{ paddingBottom: theme.spacing.xl }}>
        <TokenField
          label={t('mailui.compose.to')}
          tokens={state.to}
          input={state.toInput}
          onTokens={(to) => onChange({ to })}
          onInput={(toInput) => onChange({ toInput })}
          suggestions={suggestionsFor('to')}
          autoFocus={state.mode === 'new' || state.mode === 'forward'}
        />

        {state.showCcBcc ? (
          <>
            <TokenField
              label={t('mailui.compose.cc')}
              tokens={state.cc}
              input={state.ccInput}
              onTokens={(cc) => onChange({ cc })}
              onInput={(ccInput) => onChange({ ccInput })}
              suggestions={suggestionsFor('cc')}
            />
            <TokenField
              label={t('mailui.compose.bcc')}
              tokens={state.bcc}
              input={state.bccInput}
              onTokens={(bcc) => onChange({ bcc })}
              onInput={(bccInput) => onChange({ bccInput })}
              suggestions={suggestionsFor('bcc')}
            />
            <FieldRow label={t('mailui.compose.from')}>
              <Pressable
                ref={fromNode}
                accessibilityRole="button"
                accessibilityLabel={t('mailui.compose.fromLabel', { address: from?.email ?? '' })}
                disabled={props.mailboxes.length < 2}
                onPress={() => void open('from')}
                style={[styles.row, styles.grow, { gap: theme.spacing.xs }]}
              >
                <Text variant="body" numberOfLines={1} style={styles.grow}>
                  {from?.email ?? ''}
                </Text>
                {props.mailboxes.length > 1 ? (
                  <Icon name="down" size={16} color={theme.colors.textMuted} />
                ) : null}
              </Pressable>
            </FieldRow>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mailui.compose.ccBccFrom', { address: from?.email ?? '' })}
            onPress={() => onChange({ showCcBcc: true })}
          >
            <FieldRow>
              <Text variant="body" tone="faint" numberOfLines={1} style={styles.grow}>
                {t('mailui.compose.ccBccFrom', { address: from?.email ?? '' })}
              </Text>
            </FieldRow>
          </Pressable>
        )}

        <FieldRow label={t('mailui.compose.subject')}>
          <TextInput
            accessibilityLabel={t('mailui.compose.subject')}
            value={state.subject}
            onChangeText={(subject) => onChange({ subject })}
            autoCapitalize="sentences"
            style={[
              styles.grow,
              styles.input,
              {
                minHeight: HIT_TARGET - theme.spacing.sm,
                fontFamily: theme.fontFamily,
                fontSize: theme.fontSize.md,
                color: theme.colors.text,
              },
            ]}
          />
        </FieldRow>

        {state.forwardOf ? (
          <Text variant="caption" tone="faint" style={{ paddingTop: theme.spacing.sm }}>
            {t('mailui.compose.forwardNote')}
          </Text>
        ) : null}
        {props.error ? (
          <Text variant="label" tone="danger" style={{ paddingTop: theme.spacing.sm }}>
            {props.error === 'recipients'
              ? t('mailui.compose.invalidRecipients')
              : t(mailErrorKey(props.error))}
          </Text>
        ) : null}

        <TextInput
          accessibilityLabel={t('mail.compose.body')}
          value={state.body}
          onChangeText={(body) => onChange({ body })}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
          autoFocus={state.mode === 'reply' || state.mode === 'replyAll'}
          style={[
            styles.input,
            {
              minHeight: BODY_MIN_HEIGHT,
              paddingTop: theme.spacing.md,
              fontFamily: theme.fontFamily,
              fontSize: theme.fontSize.md,
              lineHeight: theme.lineHeight.md,
              color: theme.colors.text,
            },
          ]}
        />

        {state.quote.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showQuote }}
              accessibilityLabel={
                showQuote ? t('mailui.body.hideQuote') : t('mailui.body.showQuote')
              }
              onPress={() => setShowQuote((shown) => !shown)}
              style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}
            >
              <Text variant="label" tone="muted">
                {showQuote ? t('mailui.body.hideQuote') : t('mailui.body.showQuote')}
              </Text>
            </Pressable>
            {showQuote ? (
              <Text variant="body" tone="muted">
                {state.quote}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <Menu
        visible={menu?.open ?? false}
        anchor={menu?.anchor ?? null}
        items={menuItems}
        onClose={() => setMenu((current) => (current ? { ...current, open: false } : null))}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  // Der Browser zeichnet sonst einen eigenen Fokusrahmen.
  input: { outlineStyle: 'none' as never },
});
