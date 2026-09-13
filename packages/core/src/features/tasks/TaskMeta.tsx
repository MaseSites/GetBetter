import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

import { metaText } from './labels';
import type { MetaPart } from './meta';

/** Symbole statt Woerter fuer das, was nur „ist da“ heisst. */
const META_ICONS: Partial<Record<MetaPart['kind'], IconName>> = {
  repeat: 'repeat',
  reminder: 'bell',
  attachment: 'attach',
  note: 'note',
};

/** Trennzeichen zwischen den Teilen — ein Satzzeichen, kein Wort. */
const SEPARATOR = '·';

/**
 * Die Metazeile: gedaempft, Footnote-Groesse, Ueberfaelliges in Warnfarbe.
 * Fuer die Bedienungshilfe spricht die Zeile selbst (`metaA11y`).
 */
export function TaskMeta({ parts, today }: { parts: readonly MetaPart[]; today: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const size = { fontSize: theme.fontSize.sm, lineHeight: theme.lineHeight.sm };

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, { gap: theme.spacing.xs }]}
    >
      {parts.map((part, index) => {
        const icon = META_ICONS[part.kind];
        const overdue = part.kind === 'date' && part.overdue;
        return (
          <Fragment key={`${part.kind}-${index}`}>
            {index > 0 ? (
              <Text variant="caption" tone="faint" style={size}>
                {SEPARATOR}
              </Text>
            ) : null}
            {icon ? (
              <Icon name={icon} size={theme.fontSize.sm} color={theme.colors.textMuted} />
            ) : (
              <Text
                variant="caption"
                tone={overdue ? 'danger' : 'muted'}
                numberOfLines={1}
                style={size}
              >
                {metaText(t, language, today, part)}
              </Text>
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
