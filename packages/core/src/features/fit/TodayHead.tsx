import { StyleSheet, View } from 'react-native';

import type { FitDay } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Text } from '@/ui';

import { DayBand } from './DayBand';
import { Block, FIT_LINE, Quiet } from './FitBlock';

const TRACK_HEIGHT = 4;
const TRACK_GAP = 6;
/** Zahl direkt unter ihrem Namen, wie im Entwurf. */
const VALUE_GAP = 1;
/** Die grosse Zahl steht 9 unter der Marke. */
const FIGURE_GAP = 9;
/** Abstand der Naehrstoffe zum Band und zur Haarlinie. */
const TRIO_TOP = 14;

/**
 * Der Block „Heute noch“: die eine grosse Zahl — was heute noch Platz hat —,
 * darunter das Band mit einer Legende je Mahlzeit, durch eine Haarlinie
 * getrennt die drei Naehrstoffe: gegessen fett, das Ziel leise daneben. Der
 * Aufschlag fuers Training steht rechts im Kopf. Ueber dem Ziel wird nichts
 * rot: dann steht ein ruhiger Satz da.
 */
export function TodayHead({ data }: { data: FitDay }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const target = data.target;
  if (!target) return null;
  const left = Math.round(target.kcal - data.total.kcal);
  const bonus = data.kind === 'training' ? data.trainingBonusKcal : 0;
  const macros = [
    { key: 'proteinG', eaten: data.total.proteinG, target: target.proteinG },
    { key: 'carbsG', eaten: data.total.carbsG, target: target.carbsG },
    { key: 'fatG', eaten: data.total.fatG, target: target.fatG },
  ] as const;

  return (
    <Block
      label={left >= 0 ? t('fit.head.left') : t('fit.head.over')}
      more={bonus > 0 ? t('fit.band.bonus', { kcal: whole.format(bonus) }) : undefined}
    >
      <View style={[styles.figure, { gap: theme.spacing.sm, marginTop: FIGURE_GAP }]}>
        <Text variant="hero" style={numeric}>
          {whole.format(Math.abs(left))}
        </Text>
        <Text
          variant="label"
          tone="faint"
          style={{
            fontSize: theme.fontSize.lede,
            // Wie im Entwurf erbt die Einheit die Zeilenhoehe der Zahl — so sitzt sie auf ihrer Grundlinie.
            lineHeight: theme.lineHeight.hero,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {t('health.ofKcal', { target: whole.format(target.kcal) })}
        </Text>
      </View>
      {left < 0 ? (
        <Text variant="body" tone="muted" style={[numeric, { marginTop: theme.spacing.xs }]}>
          {t('fit4.head.overNote', { kcal: whole.format(-left) })}
        </Text>
      ) : null}
      <DayBand meals={data.meals} targetKcal={target.kcal} />

      <View
        style={[
          styles.trio,
          {
            gap: theme.spacing.md,
            marginTop: TRIO_TOP,
            paddingTop: theme.spacing.md,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        {macros.map((macro) => {
          const share = macro.target > 0 ? Math.min(1, macro.eaten / macro.target) : 0;
          return (
            <View
              key={macro.key}
              accessible
              accessibilityLabel={`${t(`fit.macro.${macro.key}` as TranslationKey)}: ${t(
                'fit.head.macro',
                { eaten: whole.format(macro.eaten), target: whole.format(macro.target) },
              )}`}
              style={styles.cell}
            >
              <Quiet>{t(`fit.macro.${macro.key}` as TranslationKey)}</Quiet>
              <Text
                variant="label"
                numberOfLines={1}
                style={[
                  numeric,
                  {
                    fontSize: theme.fontSize.md,
                    lineHeight: FIT_LINE.md,
                    fontWeight: theme.fontWeight.semibold,
                    marginTop: VALUE_GAP,
                  },
                ]}
              >
                {whole.format(macro.eaten)}{' '}
                <Text
                  variant="caption"
                  tone="faint"
                  style={{
                    fontSize: theme.fontSize.caption,
                    lineHeight: FIT_LINE.caption,
                    fontWeight: theme.fontWeight.medium,
                  }}
                >
                  {t('fit4.macro.of', { target: whole.format(macro.target) })}
                </Text>
              </Text>
              <View
                style={{
                  height: TRACK_HEIGHT,
                  marginTop: TRACK_GAP,
                  overflow: 'hidden',
                  borderRadius: theme.radii.pill,
                  backgroundColor: theme.colors.border,
                }}
              >
                <View
                  style={{
                    width: `${share * 100}%`,
                    height: '100%',
                    borderRadius: theme.radii.pill,
                    backgroundColor: theme.colors.text,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </Block>
  );
}

const styles = StyleSheet.create({
  figure: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  trio: { flexDirection: 'row', borderTopWidth: 1 },
  cell: { flex: 1, minWidth: 0 },
});
