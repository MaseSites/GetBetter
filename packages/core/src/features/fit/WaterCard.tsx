import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { drinks as drinkRepo, useLiveQuery } from '@/db';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';
import { useI18n } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { GLASS_COUNT, Icon, Text, usePressScale, useUndo, type IconName } from '@/ui';

import { Block, FIT_LINE } from './FitBlock';

/** Die zwei Knoepfe beim Trinken, in Deziliter — wie in „Trinken“. */
const GLASSES = [2.5, 5];
/** Die Glaeser des Entwurfs: 34 hoch, Ecken 7, 5 dazwischen, Rand 1.5. */
const GLASS_HEIGHT = 34;
const GLASS_RADIUS = 7;
const GLASS_GAP = 5;
const GLASS_BORDER = 1.5;
const ACTION_HEIGHT = 44;
const ACTION_PADDING = 18;
const ICON = 18;
/** Gegen Rundungsfehler: 3.3 dl von 33 dl sind genau ein Glas, nicht 0.9999. */
const EPSILON = 1e-9;

/**
 * Der Block „Getrunken“ gegen das persoenliche Ziel: zehn Glaeser, zwei
 * Knoepfe in Tinte und „Zurück“ fuer das letzte. Heute und vergangene Tage
 * lassen sich nachtragen (morgen noch nicht), jedes Glas zusaetzlich mit
 * Rueckgaengig in der Leiste.
 */
export function WaterCard({
  day,
  today,
  targetMl,
}: {
  day: string;
  today: string;
  targetMl: number;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const undo = useUndo();
  const celebrate = useCelebrate();
  const account = useAccount();
  const drunkDl = useLiveQuery(() => drinkRepo.ofDay(account.id, day), [account.id, day]).data ?? 0;
  const litres = new Intl.NumberFormat(`${language}-CH`, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const decilitres = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 });
  const canAdd = day <= today;
  const share = targetMl > 0 ? (drunkDl * 100) / targetMl : 0;
  const filled = Math.max(0, Math.min(GLASS_COUNT, Math.floor(share * GLASS_COUNT + EPSILON)));

  async function add(dl: number) {
    await drinkRepo.add(account.id, day, dl);
    celebrate('water');
    undo.show({
      message: t('fit4.water.added', { dl: decilitres.format(dl) }),
      onUndo: () => void drinkRepo.undoLast(account.id, day),
    });
  }

  return (
    <Block
      label={t('health.drunk')}
      more={t('health.drinkOf', {
        amount: litres.format(drunkDl / 10),
        target: litres.format(targetMl / 1000),
      })}
    >
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('fit.water.progress', {
          drunk: litres.format(drunkDl / 10),
          target: litres.format(targetMl / 1000),
        })}
        accessibilityValue={{ min: 0, max: GLASS_COUNT, now: filled }}
        style={[styles.row, { gap: GLASS_GAP, marginTop: theme.spacing.md }]}
      >
        {Array.from({ length: GLASS_COUNT }, (_, index) => (
          <View
            key={`glass-${index}`}
            style={[
              styles.glass,
              {
                borderColor: index < filled ? theme.colors.accentStrong : theme.colors.textFaint,
                backgroundColor: index < filled ? theme.colors.accent : theme.colors.surface,
              },
            ]}
          />
        ))}
      </View>
      {canAdd ? (
        <View style={[styles.row, { gap: theme.spacing.sm, marginTop: theme.spacing.md }]}>
          {GLASSES.map((dl) => (
            <Pill
              key={dl}
              icon="plus"
              primary
              label={t('water.add', { amount: decilitres.format(dl) })}
              accessibilityLabel={t('fit.water.add', { dl: decilitres.format(dl) })}
              onPress={() => void add(dl)}
            />
          ))}
          <Pill
            label={t('health.undo')}
            disabled={drunkDl === 0}
            onPress={() => void drinkRepo.undoLast(account.id, day)}
          />
        </View>
      ) : null}
    </Block>
  );
}

/** Ein Knopf wie im Entwurf: 44 hoch, Tinte waechst mit, die Senke bleibt so breit wie ihr Wort. */
function Pill({
  label,
  icon,
  primary = false,
  disabled = false,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  icon?: IconName;
  primary?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const color = primary ? theme.colors.onInverse : theme.colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={primary ? styles.grow : null}
    >
      <Animated.View
        style={[
          styles.action,
          {
            gap: theme.spacing.sm,
            paddingHorizontal: ACTION_PADDING,
            borderRadius: theme.radii.pill,
            backgroundColor: primary ? theme.colors.inverse : theme.colors.surfaceMuted,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        {icon ? <Icon name={icon} size={ICON} color={color} /> : null}
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            color,
            fontSize: theme.fontSize.md,
            lineHeight: FIT_LINE.md,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flexGrow: 1 },
  glass: { flex: 1, height: GLASS_HEIGHT, borderRadius: GLASS_RADIUS, borderWidth: GLASS_BORDER },
  action: {
    height: ACTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
