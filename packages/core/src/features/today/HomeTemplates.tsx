import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

import { blockColor } from './HomeBlockView';
import { canvasRows, TEMPLATES, templateLayout, type TemplateKey } from './homeLayout';

/** Die drei Vorlagen heissen wie die drei festen Ansichten. */
export const TEMPLATE_LABELS = {
  list: 'today.view.list',
  grid: 'today.view.grid',
  focus: 'today.view.focus',
} as const;

/** So hoch ist die kleine Vorschau. */
const SKETCH_HEIGHT = 132;

/**
 * Eine Vorlage waehlen — **als Bild, nicht als Liste**: drei Karten
 * nebeneinander, jede mit einer kleinen Zeichnung ihrer Elemente in deren
 * Farben und dem Namen darunter. So sieht man vorher, was man bekommt.
 */
export function HomeTemplates({ onPick }: { onPick: (template: TemplateKey) => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
      <Text variant="label" tone="muted">
        {t('home.build.templateBody')}
      </Text>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        {TEMPLATES.map((template) => (
          <Pressable
            key={template}
            accessibilityRole="button"
            accessibilityLabel={t(TEMPLATE_LABELS[template])}
            onPress={() => onPick(template)}
            style={({ pressed }) => [
              styles.card,
              { gap: theme.spacing.sm, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <TemplateSketch template={template} />
            <Text variant="label" align="center" numberOfLines={1}>
              {t(TEMPLATE_LABELS[template])}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Die Elemente der Vorlage als kleine Felder — dasselbe Raster, nur winzig. */
function TemplateSketch({ template }: { template: TemplateKey }) {
  const theme = useTheme();
  const layout = templateLayout(template);
  const rows = Math.max(1, canvasRows(layout));

  return (
    <View
      style={[
        styles.sketch,
        {
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {layout.map((block) => (
        <View
          key={block.id}
          style={{
            position: 'absolute',
            left: `${(block.x / 4) * 100}%`,
            top: `${(block.y / rows) * 100}%`,
            width: `${(block.w / 4) * 100}%`,
            height: `${(block.h / rows) * 100}%`,
            padding: 2,
          }}
        >
          <View
            style={[
              styles.piece,
              { backgroundColor: blockColor(theme, block.kind), borderRadius: 3 },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  card: { flex: 1, minWidth: 0 },
  sketch: {
    height: SKETCH_HEIGHT,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  piece: { flex: 1, opacity: 0.7 },
});
