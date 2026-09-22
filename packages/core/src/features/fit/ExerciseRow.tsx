import { Animated, Pressable, View } from 'react-native';

import { useI18n, type Translate } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Chip, Icon, Text, usePressScale } from '@/ui';

import { TRAINING } from './trainingType';

/** Reserve: offen (keine Vorwahl) und 0 bis 4. */
const RIR: readonly (number | null)[] = [null, 0, 1, 2, 3, 4];

export const rirLabel = (t: Translate, value: number | null) =>
  value === null
    ? t('fit6.rir.unknownA11y')
    : value === 0
      ? t('fit6.rir.none')
      : value === 1
        ? t('fit6.rir.one')
        : t('fit6.rir.many', { count: value });

/** Die Reserve als leise Chip-Reihe unter der Tabelle — freiwillig. */
export function RirChips({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.spacing.xs,
      }}
    >
      <Text variant="caption" tone="faint" style={{ marginRight: theme.spacing.xs }}>
        {t('fit6.rir.title')}
      </Text>
      {RIR.map((option) => (
        <Chip
          key={option ?? 'open'}
          label={option === null ? t('fit6.rir.unknown') : String(option)}
          accessibilityLabel={rirLabel(t, option)}
          selected={value === option}
          onPress={() => onChange(option)}
        />
      ))}
    </View>
  );
}

/**
 * Eine zugeklappte Uebung im Training: Name, darunter Vorgabe oder wie weit
 * sie ist, ein Haken wenn alle Saetze stehen. Ein Tipp klappt sie auf.
 */
export function ExerciseRow({
  name,
  meta,
  finished,
  onPress,
}: {
  name: string;
  meta: string;
  finished: boolean;
  onPress?: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const press = usePressScale();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('fit6.v.expand', { name, meta })}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          theme.elevation.card,
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.panel,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="body"
            numberOfLines={1}
            style={{
              fontSize: TRAINING.rowSize,
              lineHeight: TRAINING.rowLine,
              fontWeight: theme.fontWeight.semibold,
              letterSpacing: theme.tracking.none,
            }}
          >
            {name}
          </Text>
          <Text
            variant="label"
            tone="faint"
            numberOfLines={1}
            style={[numeric, { lineHeight: TRAINING.line13, fontWeight: theme.fontWeight.regular }]}
          >
            {meta}
          </Text>
        </View>
        {finished ? (
          <Icon name="checkCircle" size={theme.fontSize.lg} color={theme.colors.accentMark} />
        ) : null}
        <Icon name="forward" size={TRAINING.rowSize} color={theme.colors.text} />
      </Animated.View>
    </Pressable>
  );
}
