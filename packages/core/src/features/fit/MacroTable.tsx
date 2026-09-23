import { StyleSheet, View } from 'react-native';

import type { Macros } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Text } from '@/ui';

type Row = { key: keyof Macros; target: number | null; eaten?: number };

/** Die Hoehe des Balkens unter der Energie — die eine Zeile, die zaehlt. */
const BAR_HEIGHT = 6;

/**
 * Der Tag als Naehrwerttabelle, wie sie auf jeder Verpackung steht: Energie,
 * Eiweiss, Kohlenhydrate, Fett — mit gegessen, Ziel und was uebrig ist. Kein
 * Ring, kein Donut: Zahlen in fester Breite, Haarlinien dazwischen.
 *
 * **Ueber dem Ziel wird nichts rot** — dasselbe wie in `TodayHead`. Rot
 * gehoert der Gesundheit (Ablauf, vergessene Einnahme, Allergie); eine
 * ueberschrittene Tagesmenge ist keine Gefahr, sondern eine Zahl. Der Balken
 * wird dann Tinte statt Akzent, und das Wort „drueber“ sagt es. Scham-Rot
 * bringt Leute zum Aufhoeren, nicht zum Weitermachen.
 */
export function MacroTable({ rows, caption }: { rows: readonly Row[]; caption?: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const withEaten = rows.some((row) => row.eaten !== undefined);
  const amount = (key: keyof Macros, value: number) =>
    t(key === 'kcal' ? 'fit4.unit.kcal' : 'fit4.unit.g', { value: whole.format(value) });

  const energy = rows.find((row) => row.key === 'kcal');
  const share =
    energy && energy.target && energy.eaten !== undefined ? energy.eaten / energy.target : null;

  const cell = { flex: 1, textAlign: 'right' as const, ...numeric };

  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth * 3,
        borderBottomWidth: StyleSheet.hairlineWidth * 3,
        borderColor: theme.colors.text,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <View style={[styles.row, { paddingVertical: theme.spacing.xs }]}>
        <Text variant="caption" tone="muted" style={{ flex: 1.6 }}>
          {caption ?? t('fit.table.caption')}
        </Text>
        {withEaten ? (
          <Text variant="caption" tone="muted" style={cell}>
            {t('fit.table.eaten')}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted" style={cell}>
          {t('fit.table.target')}
        </Text>
        {withEaten ? (
          <Text variant="caption" tone="muted" style={cell}>
            {t('fit.table.left')}
          </Text>
        ) : null}
      </View>
      {rows.map((row, index) => {
        const left = row.target !== null && row.eaten !== undefined ? row.target - row.eaten : null;
        const over = left !== null && left < 0;
        const isEnergy = row.key === 'kcal';
        return (
          <View
            key={row.key}
            style={{
              borderTopWidth: index === 0 ? StyleSheet.hairlineWidth * 2 : StyleSheet.hairlineWidth,
              borderColor: index === 0 ? theme.colors.text : theme.colors.border,
              paddingVertical: theme.spacing.sm,
            }}
          >
            <View style={styles.row}>
              <Text
                variant={isEnergy ? 'label' : 'body'}
                style={{ flex: 1.6, fontWeight: isEnergy ? theme.fontWeight.semibold : undefined }}
              >
                {t(`fit.macro.${row.key}` as TranslationKey)}
              </Text>
              {withEaten ? (
                <Text variant="body" style={cell}>
                  {row.eaten === undefined ? '—' : amount(row.key, row.eaten)}
                </Text>
              ) : null}
              <Text variant="body" tone={withEaten ? 'muted' : 'default'} style={cell}>
                {row.target === null ? '—' : amount(row.key, row.target)}
              </Text>
              {withEaten ? (
                <Text
                  variant="body"
                  tone="default"
                  style={[cell, { fontWeight: theme.fontWeight.semibold }]}
                >
                  {left === null
                    ? '—'
                    : over
                      ? t('fit.table.over', { value: whole.format(-left) })
                      : whole.format(left)}
                </Text>
              ) : null}
            </View>
            {isEnergy && share !== null ? (
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(share, 1) * 100) }}
                style={{
                  height: BAR_HEIGHT,
                  marginTop: theme.spacing.sm,
                  borderRadius: theme.radii.pill,
                  overflow: 'hidden',
                  backgroundColor: theme.colors.surfaceMuted,
                }}
              >
                <View
                  style={{
                    width: `${Math.min(1, share) * 100}%`,
                    height: '100%',
                    borderRadius: theme.radii.pill,
                    backgroundColor: share > 1 ? theme.colors.text : theme.colors.accentMark,
                  }}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
});
