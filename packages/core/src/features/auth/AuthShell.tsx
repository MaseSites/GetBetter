import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ClubAvatar } from '@/features/intro/ClubAvatar';
import { SpeechBubble } from '@/features/intro/SpeechBubble';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Card, Header, Screen, Text } from '@/ui';

import { PillButton } from './PillButton';

/** Der Avatar steht klein neben seiner Blase — derselbe wie im Intro, schon zusammengesetzt. */
const AVATAR_SIZE = 72;

export type AuthShellProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  switchLabel: string;
  onSubmit: () => void;
  onSwitch: () => void;
  busy: boolean;
  /** Was der Avatar oben dazu sagt. Ohne Angabe steht er nicht da. */
  bubble?: string;
  /** Eine fertige Meldung, die zu keinem Feld gehoert — sie steht ueber den Knoepfen. */
  error?: string;
  /** Die Felder. Sie stehen gestapelt in einer Karte. */
  children: ReactNode;
};

/**
 * Der gemeinsame Rahmen von Anmelden und Registrieren: oben der Avatar mit
 * seiner Blase, darunter der Titel, dann die Felder gestapelt in einer Karte
 * und unten die Pille mit der Haupthandlung.
 */
export function AuthShell({
  title,
  subtitle,
  submitLabel,
  switchLabel,
  onSubmit,
  onSwitch,
  busy,
  bubble,
  error,
  children,
}: AuthShellProps) {
  const t = useTranslate();
  const theme = useTheme();

  return (
    <Screen
      header={<Header showBack />}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
          <PillButton label={submitLabel} onPress={onSubmit} loading={busy} />
          <Button label={switchLabel} variant="ghost" onPress={onSwitch} disabled={busy} />
        </View>
      }
    >
      {bubble ? (
        <View style={[styles.talk, { gap: theme.spacing.md }]}>
          <ClubAvatar size={AVATAR_SIZE} phase="idle" />
          <View style={styles.bubble}>
            <SpeechBubble text={bubble} tail="left" />
          </View>
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display">{title}</Text>
        <Text variant="label" tone="muted">
          {subtitle}
        </Text>
      </View>

      <Card>{children}</Card>

      <Text variant="caption" tone="faint">
        {t('auth.localHint')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  talk: { flexDirection: 'row', alignItems: 'center' },
  bubble: { flex: 1 },
});
