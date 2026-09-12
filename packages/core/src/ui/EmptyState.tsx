import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export type EmptyStateProps = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

/**
 * Kein Bildschirm bleibt weiss. Wo nichts ist, steht hier, warum.
 *
 * Kein Symbol, kein trauriges Maskottchen und kein «Ups»: ein Satz, der sagt,
 * was jetzt geht, und genau ein Knopf. Leer ist kein Fehler.
 *
 * Ohne `compact` nimmt der Zustand den freien Platz des Bildschirms ein und
 * steht darin mittig — nicht oben unter dem Titel. Hat der Bildschirm unten
 * schon einen Hauptknopf, bekommt der Zustand keinen zweiten.
 */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        compact ? null : styles.fill,
        {
          paddingVertical: compact ? theme.spacing.lg : theme.spacing.xxl,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="body" tone="muted" align="center" style={styles.body}>
        {body}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button label={actionLabel} onPress={onAction} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  // flexGrow statt flex: 1 — sonst wird im Browser flex-basis 0% daraus.
  fill: { flexGrow: 1 },
  // Ein Satz liest sich schlecht ueber die ganze Breite.
  body: { maxWidth: 280 },
});
