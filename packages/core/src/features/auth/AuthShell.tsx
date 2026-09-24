import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DEFAULT_AVATAR } from '@/features/avatar/style';
import { ClubAvatar } from '@/features/intro/ClubAvatar';
import { useNarration } from '@/features/intro/narration';
import { SpeechBubble } from '@/features/intro/SpeechBubble';
import { StagePanel } from '@/features/intro/StagePanel';
import { useTheme } from '@/theme';
import { Button, Header, Screen, Text } from '@/ui';

import { PillButton } from './PillButton';

/** Der Avatar steht klein neben seiner Blase — derselbe wie im Intro, schon zusammengesetzt. */
const AVATAR_SIZE = 72;
export type AuthShellProps = {
  title: string;
  submitLabel: string;
  switchLabel: string;
  onSubmit: () => void;
  onSwitch: () => void;
  busy: boolean;
  /** Was der Avatar oben dazu sagt. Ohne Angabe steht er nicht da. */
  bubble?: string;
  /** Eine fertige Meldung, die zu keinem Feld gehoert — sie steht ueber den Knoepfen. */
  error?: string;
  /** Die Felder, untereinander im dunklen Feld. */
  children: ReactNode;
};

/**
 * Der gemeinsame Rahmen von Anmelden und Registrieren, im Stil des
 * Startbildschirms: oben auf hellem Grund der Avatar mit seiner Blase, darunter
 * das dunkle Feld (`StagePanel`) —
 * Titel, Felder, die eine Haupthandlung im Signalgruen und darunter leise der
 * Weg zur anderen Maske. Kein erklaerender Text: was zu sagen ist, sagt die
 * Blase.
 */
export function AuthShell({
  title,
  submitLabel,
  switchLabel,
  onSubmit,
  onSwitch,
  busy,
  bubble,
  error,
  children,
}: AuthShellProps) {
  const theme = useTheme();
  // Er sagt laut, was in seiner Blase steht — schon bevor es ein Konto gibt.
  useNarration(`auth:${bubble ?? ''}`, bubble ?? '');

  return (
    <Screen header={<Header showBack />} padded={false} gap={0}>
      {bubble ? (
        <View
          style={[
            styles.talk,
            {
              gap: theme.spacing.md,
              paddingHorizontal: theme.spacing.edge,
              paddingTop: theme.spacing.sm,
              paddingBottom: theme.spacing.xl,
            },
          ]}
        >
          {/* Vor dem Anmelden gibt es noch keinen eigenen Avatar — der Club-Roboter begruesst. */}
          <ClubAvatar size={AVATAR_SIZE} phase="idle" style={DEFAULT_AVATAR} />
          <View style={styles.fill}>
            <SpeechBubble text={bubble} tail="left" />
          </View>
        </View>
      ) : null}
      <StagePanel
        footer={
          <>
            {error ? (
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            ) : null}
            <PillButton label={submitLabel} variant="signal" onPress={onSubmit} loading={busy} />
            <Button label={switchLabel} variant="ghost" onPress={onSwitch} disabled={busy} pill />
          </>
        }
      >
        <Text variant="display">{title}</Text>
        <View style={{ gap: theme.spacing.md }}>{children}</View>
      </StagePanel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  talk: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
});
