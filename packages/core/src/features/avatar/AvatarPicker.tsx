import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import {
  AvatarAccessoryChooser,
  AvatarColorChooser,
  AvatarEyesChooser,
  AvatarKindChooser,
  type AvatarChooserProps,
} from './AvatarChoosers';

export type AvatarPickerProps = AvatarChooserProps & {
  /** Nur Figur und Farbe — fuer das Einrichten, wo es schnell gehen soll. */
  compact?: boolean;
};

/**
 * Alles, was man am Avatar waehlen kann, untereinander. Jede Wahl geht sofort
 * an `onChange`; wer speichert und die Vorschau zeigt, entscheidet der Aufrufer.
 */
export function AvatarPicker({ value, onChange, compact = false }: AvatarPickerProps) {
  const t = useTranslate();
  const theme = useTheme();
  const mono = theme.preset === 'mono';

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Section title={t('avatar.kind')}>
        <AvatarKindChooser value={value} onChange={onChange} />
      </Section>
      <Section title={t('avatar.color')} hint={mono && !compact ? t('avatar.color.mono') : undefined}>
        <AvatarColorChooser value={value} onChange={onChange} />
      </Section>
      {compact ? null : (
        <>
          <Section title={t('avatar.eyes')}>
            <AvatarEyesChooser value={value} onChange={onChange} />
          </Section>
          <Section title={t('avatar.accessory')}>
            <AvatarAccessoryChooser value={value} onChange={onChange} />
          </Section>
        </>
      )}
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="section" tone="muted">
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" tone="faint">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
