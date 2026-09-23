import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Icon, Segmented, Text } from '@/ui';

import { blockColor, blockIcon, blockName, variantLabel } from './HomeBlockView';
import { GRID_COLUMNS, variantsOf, type BlockVariant, type HomeBlock } from './homeLayout';

/** Die zwei Knoepfe an einem Regler — gross genug fuer den Daumen. */
const STEP = 36;

/**
 * Was mit dem gewaehlten Element geht, an einem Ort: Stil, Groesse,
 * Duplizieren, Entfernen. Die Karte steht gleich unter dem Element, damit man
 * nie sucht — und schliesst mit dem Kreuz.
 *
 * Die Groesse laesst sich hier mit − und + setzen, statt nur an den Ecken zu
 * ziehen: auf dem Handy trifft man einen Knopf sicherer als eine Ecke.
 */
export function HomeInspector({
  block,
  onVariant,
  onResize,
  onDuplicate,
  onRemove,
  onClose,
}: {
  block: HomeBlock;
  onVariant: (variant: BlockVariant) => void;
  /** Um wie viele Felder breiter und hoeher — negativ heisst kleiner. */
  onResize: (dw: number, dh: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const variants = variantsOf(block.kind);

  return (
    <View
      style={[
        theme.elevation.raised,
        styles.card,
        {
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <Icon name={blockIcon(block.kind)} size={16} color={blockColor(theme, block.kind)} />
        <Text
          variant="label"
          numberOfLines={1}
          style={[styles.grow, { fontWeight: theme.fontWeight.semibold }]}
        >
          {blockName(t, block.kind)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          hitSlop={theme.spacing.sm}
          style={({ pressed }) => [
            styles.step,
            {
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surfaceMuted,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Icon name="close" size={18} color={theme.colors.text} />
        </Pressable>
      </View>

      {variants.length > 1 ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="overline" tone="muted">
            {t('home.build.style')}
          </Text>
          <Segmented
            accessibilityLabel={t('home.build.style')}
            value={block.variant}
            onChange={onVariant}
            options={variants.map((variant) => ({
              value: variant as BlockVariant,
              label: variantLabel(t, block.kind, variant),
            }))}
          />
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="overline" tone="muted">
          {t('home.build.size')}
        </Text>
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Stepper
            label={t('home.build.width')}
            value={`${block.w}/${GRID_COLUMNS}`}
            lessLabel={t('home.build.narrower')}
            moreLabel={t('home.build.wider')}
            canLess={block.w > 1}
            canMore={block.x + block.w < GRID_COLUMNS}
            onLess={() => onResize(-1, 0)}
            onMore={() => onResize(1, 0)}
          />
          <Stepper
            label={t('home.build.height')}
            value={String(block.h)}
            lessLabel={t('home.build.shorter')}
            moreLabel={t('home.build.taller')}
            canLess={block.h > 1}
            canMore
            onLess={() => onResize(0, -1)}
            onMore={() => onResize(0, 1)}
          />
        </View>
      </View>

      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <View style={styles.grow}>
          <Button
            label={t('home.build.duplicate')}
            icon="copy"
            variant="secondary"
            size="sm"
            onPress={onDuplicate}
          />
        </View>
        <View style={styles.grow}>
          <Button
            label={t('home.build.remove')}
            icon="trash"
            variant="danger"
            size="sm"
            onPress={onRemove}
          />
        </View>
      </View>
    </View>
  );
}

/** − Wert + auf einer ruhigen Spur, wie ein Regler in den Einstellungen. */
function Stepper({
  label,
  value,
  lessLabel,
  moreLabel,
  canLess,
  canMore,
  onLess,
  onMore,
}: {
  label: string;
  value: string;
  lessLabel: string;
  moreLabel: string;
  canLess: boolean;
  canMore: boolean;
  onLess: () => void;
  onMore: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.grow, { gap: theme.spacing.xs }]}>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      <View
        style={[
          styles.row,
          {
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.surfaceMuted,
            padding: 3,
          },
        ]}
      >
        <StepButton icon="minus" label={lessLabel} enabled={canLess} onPress={onLess} />
        <Text
          variant="label"
          align="center"
          style={[styles.grow, { fontWeight: theme.fontWeight.semibold }]}
        >
          {value}
        </Text>
        <StepButton icon="plus" label={moreLabel} enabled={canMore} onPress={onMore} />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        theme.elevation.card,
        {
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.surface,
          opacity: enabled ? (pressed ? 0.6 : 1) : 0.4,
        },
      ]}
    >
      <Icon name={icon} size={18} color={enabled ? theme.colors.text : theme.colors.disabledText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  step: { width: STEP, height: STEP, alignItems: 'center', justifyContent: 'center' },
});
