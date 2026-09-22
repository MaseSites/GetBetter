import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Text } from '@/ui';

import { groupPlates, platesFor } from './plates';
import type { TrainingFormats } from './trainingText';
import { TRAINING } from './trainingType';

/** Drei Groessen wie im Entwurf: schwer 10 × 34, mittel 8 × 22, leicht 6 × 14. */
const plateHeight = (kg: number) => (kg >= 15 ? 34 : kg >= 5 ? 22 : 14);
const plateWidth = (kg: number) => (kg >= 15 ? 10 : kg >= 5 ? 8 : 6);
const PLATE_RADIUS = 3;
/** Alles in der Zeile steht 6 auseinander. */
const PLATE_GAP = 6;

/**
 * Welche Scheiben auf eine Seite der Langhantel gehoeren, von innen nach
 * aussen: „Je Seite“, die Scheiben gezeichnet (schwere in Tinte, leichte
 * heller), dann die Zahlen. Die Zeichnung ist nur Hilfe — vorgelesen wird die Liste.
 */
export function PlateRow({ kg, formats }: { kg: number; formats: TrainingFormats }) {
  const { t } = useI18n();
  const theme = useTheme();
  const load = platesFor(kg);
  if (load.belowBar) return null;

  const text =
    load.perSide.length === 0
      ? t('fit6.plates.bar')
      : groupPlates(load.perSide)
          .map((group) =>
            group.count > 1
              ? `${group.count} × ${formats.kg.format(group.kg)}`
              : formats.kg.format(group.kg),
          )
          .join(' · ');
  // Die Zeichnung ist nur Zierde (vorgelesen wird die Liste): leicht darf zart sein.
  const tone = (plate: number) =>
    plate >= 15
      ? theme.colors.text
      : plate >= 5
        ? theme.colors.textMuted
        : theme.colors.borderStrong;
  const small = {
    fontSize: theme.fontSize.caption,
    lineHeight: TRAINING.line12,
    fontWeight: theme.fontWeight.regular,
  };

  return (
    <View
      accessible
      accessibilityLabel={
        load.perSide.length === 0
          ? text
          : t('fit6.plates.a11y', { list: `${text} ${t('fit6.unit.kg')}` })
      }
      style={{ gap: theme.spacing.xs }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: PLATE_GAP }}>
        <Text variant="caption" tone="faint" style={small}>
          {t('fit6.plates.title')}
        </Text>
        {load.perSide.map((plate, index) => (
          <View
            key={`${plate}-${index}`}
            style={{
              width: plateWidth(plate),
              height: plateHeight(plate),
              borderRadius: PLATE_RADIUS,
              backgroundColor: tone(plate),
            }}
          />
        ))}
        <Text
          variant="caption"
          tone="muted"
          style={[numeric, small, { flex: 1, fontWeight: theme.fontWeight.semibold }]}
          numberOfLines={1}
        >
          {load.perSide.length === 0 ? text : `${text} ${t('fit6.unit.kg')}`}
        </Text>
      </View>
      {load.restKg !== 0 ? (
        <Text variant="caption" tone="faint" style={numeric}>
          {t('fit6.plates.rest', { kg: formats.kg.format(load.totalKg) })}
        </Text>
      ) : null}
    </View>
  );
}
