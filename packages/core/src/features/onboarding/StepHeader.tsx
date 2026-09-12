import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Header } from '@/ui';

export type StepHeaderProps = {
  /** Der wievielte Schritt, ab 1. */
  current: number;
  total: number;
  onBack: () => void;
  /** Das Gespraech mit dem Avatar — bleibt beim Rollen oben stehen. */
  children?: ReactNode;
};

/** Zurueck, dezent der Fortschritt als duenne Striche, darunter das Gespraech. */
export function StepHeader({ current, total, onBack, children }: StepHeaderProps) {
  const theme = useTheme();
  const t = useTranslate();

  return (
    <Header showBack onBack={onBack}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('common.step', { current, total })}
        style={[styles.track, { gap: theme.spacing.xs }]}
      >
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              {
                borderRadius: theme.radii.pill,
                backgroundColor: index < current ? theme.colors.text : theme.colors.border,
              },
            ]}
          />
        ))}
      </View>
      {children}
    </Header>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row' },
  segment: { flex: 1, height: 3 },
});
