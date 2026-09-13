import { createElement, useState } from 'react';
import { Text as NativeText, Platform, Pressable, StyleSheet, View } from 'react-native';

import type { MailMessage } from '@/db/mail';
import { useI18n } from '@/i18n';
import { createTheme, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { splitQuote } from './conversation';
import { estimateBodyHeight, mailDocument } from './htmlDocument';
import type { MailBodyState } from './useMailBody';

/** Nur Links duerfen hinaus — keine Skripte, keine eigene Herkunft. */
const FRAME_SANDBOX = 'allow-popups allow-popups-to-escape-sandbox';

export type MessageBodyProps = {
  message: MailMessage;
  state: MailBodyState;
  images: boolean;
  onLoadImages: () => void;
};

/**
 * Der Text einer Nachricht. Im Browser steht gesaeubertes HTML in einem
 * abgeschotteten Rahmen; auf dem Geraet (ohne WebView) der Text, das Zitat
 * eingeklappt. Bis der Dienst antwortet — oder wenn er es nicht kann —, steht
 * der gekuerzte Text aus dem Abgleich da.
 */
export function MessageBody({ message, state, images, onLoadImages }: MessageBodyProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const { body } = state;
  const html = Platform.OS === 'web' ? (body?.html ?? null) : null;
  const text = body?.text || message.text;
  const blocked = body && !images ? body.remoteImages : 0;

  return (
    <View
      style={{ gap: theme.spacing.sm }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {blocked > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mailui.body.imagesBlocked', { count: blocked })}
          onPress={onLoadImages}
          style={({ pressed }) => [
            styles.row,
            {
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radii.sm,
              backgroundColor: theme.colors.surfaceMuted,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Icon name="image" size={16} color={theme.colors.textMuted} />
          <Text variant="label" tone="muted" style={styles.grow}>
            {t('mailui.body.imagesBlocked', { count: blocked })}
          </Text>
          <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t('mailui.body.loadImages')}
          </Text>
        </Pressable>
      ) : null}

      {html !== null && width > 0 ? (
        <HtmlFrame html={html} text={text} width={width} title={message.subject} />
      ) : text.trim().length > 0 ? (
        <TextBody text={text} />
      ) : state.loading ? null : (
        <Text variant="body" tone="faint">
          {t('mail.message.empty')}
        </Text>
      )}

      {state.error && state.error !== 'unknown_route' && !body ? (
        <Text variant="caption" tone="faint">
          {t('mailui.body.partial')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Der Rahmen hat weder Skripte noch dieselbe Herkunft wie die App — er kann
 * seine Hoehe also nicht melden, und die App kann sie nicht messen. Die Hoehe
 * wird deshalb aus Text und Bildern geschaetzt (`estimateBodyHeight`); reicht
 * sie nicht, rollt der Rahmen selbst. Die Mail steht immer auf hellem Grund —
 * die meisten HTML-Mails setzen ihre Farben fuer Weiss.
 */
function HtmlFrame({
  html,
  text,
  width,
  title,
}: {
  html: string;
  text: string;
  width: number;
  title: string;
}) {
  const theme = useTheme();
  const paper = createTheme('light', theme.accent, theme.preset).colors;
  const inner = Math.max(1, width - theme.spacing.md * 2);

  const page = mailDocument(html, {
    text: paper.text,
    muted: paper.textMuted,
    link: paper.accentStrong,
    background: paper.surface,
    border: paper.border,
    fontFamily: theme.fontFamily ?? 'system-ui',
    fontSize: theme.fontSize.md,
    lineHeight: theme.lineHeight.md,
    indent: theme.spacing.sm,
  });
  const height = estimateBodyHeight({
    text,
    html,
    width: inner,
    fontSize: theme.fontSize.md,
    lineHeight: theme.lineHeight.md,
  });

  return (
    <View
      style={{
        padding: theme.spacing.md,
        borderRadius: theme.radii.sm,
        backgroundColor: paper.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
      }}
    >
      {createElement('iframe', {
        title,
        srcDoc: page,
        sandbox: FRAME_SANDBOX,
        referrerPolicy: 'no-referrer',
        style: { border: 0, width: '100%', height, display: 'block' },
      })}
    </View>
  );
}

/** Text zum Markieren; ein Zitat am Ende steht eingeklappt darunter. */
function TextBody({ text }: { text: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [showQuote, setShowQuote] = useState(false);
  const { body, quote } = splitQuote(text);

  const style = {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.md,
    lineHeight: theme.lineHeight.md,
    color: theme.colors.text,
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <NativeText selectable style={style}>
        {body}
      </NativeText>
      {quote.length > 0 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showQuote }}
            accessibilityLabel={showQuote ? t('mailui.body.hideQuote') : t('mailui.body.showQuote')}
            onPress={() => setShowQuote((shown) => !shown)}
            style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}
          >
            <Text variant="label" tone="muted">
              {showQuote ? t('mailui.body.hideQuote') : t('mailui.body.showQuote')}
            </Text>
          </Pressable>
          {showQuote ? (
            <NativeText selectable style={[style, { color: theme.colors.textMuted }]}>
              {quote}
            </NativeText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
});
