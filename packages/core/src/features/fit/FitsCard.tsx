import { useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, View } from 'react-native';

import { fit, type FitSuggestion, type MealSlot, type RecipeSuggestion } from '@/db/fit';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, Text, usePressScale } from '@/ui';

import { Block, FIT_LINE, Quiet } from './FitBlock';
import { IntentKeys } from './intentKeys';
import { recipeImageFor } from './recipeImages';
import { zurichDay } from './slots';
import { useFit } from './useFit';
import { useMealToast } from './useMealToast';

/** Erst ab so viel Rest lohnt sich die Karte — darunter ist es ein Snack, kein Vorschlag. */
export const FITS_FROM_KCAL = 250;
/** Das Bild eines Rezepts in der Zeile, wie im Entwurf. */
const THUMB = 52;
/** Zwei Vorschlaege, wie im Entwurf — mehr waere eine Liste. */
const MAX_FITS = 2;
const NOT_TODAY = { ok: false, error: 'not_today' } as const;
/** Abstand zwischen den Zeilen. */
const ROW_GAP = 10;

/**
 * „Was passt noch“: zwei Rezepte, deren Portion in den Rest des Tages passt —
 * mit Bild, kcal, Eiweiss und ob im Vorrat alles da ist. Das runde Plus
 * traegt eine Portion ein.
 */
export function FitsCard({
  day,
  slot,
  leftKcal,
}: {
  day: string;
  slot: MealSlot;
  leftKcal: number;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useMealToast();
  const [keys] = useState(() => new IntentKeys());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Der Rest (auf 50 kcal) gehoert zu den deps: nach jedem Eintrag passt anderes.
  const fits = useFit(() => fit.fits(day, slot), [day, slot, Math.round(leftKcal / 50)], ['diary']);
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  // Was im Vorrat fehlt, weiss die Kueche (nur fuer heute): dieselben Rezepte, mit Abdeckung.
  const today = day === zurichDay();
  const kitchen = useFit(
    () => (today ? fit.suggest(slot) : Promise.resolve(NOT_TODAY)),
    [today, slot, Math.round(leftKcal / 50)],
    ['diary', 'kitchen'],
  );
  const list = (fits.data?.fits ?? []).slice(0, MAX_FITS);
  if (list.length === 0) return null;
  const coverage = kitchen.data && kitchen.data.pantryCount > 0 ? kitchen.data.suggestions : [];
  const protein = Math.max(0, fits.data?.remaining?.proteinG ?? 0);

  async function eat(entry: FitSuggestion) {
    if (busy) return;
    setBusy(entry.id);
    setError(null);
    const result = await fit.logMeal(
      { day, slot, name: entry.title, source: 'recipe', items: entry.items },
      keys.of(`fits-${entry.id}-${day}-${slot}`),
    );
    setBusy(null);
    if (result.ok) toast.logged(result.data.meal, entry.title);
    else setError(t(result.error === 'offline' ? 'fit.offline.body' : 'fit4.logFailed'));
  }

  return (
    <Block
      label={t('fit4.fits.title')}
      more={
        protein > 0 ? t('fit4.fits.proteinLeft', { protein: whole.format(protein) }) : undefined
      }
    >
      <View style={{ gap: ROW_GAP, marginTop: theme.spacing.md }}>
        {list.map((entry) => {
          const image = recipeImageFor({ id: entry.id });
          return (
            <View key={entry.id} style={[styles.row, { gap: theme.spacing.md }]}>
              {image ? (
                <Image
                  source={image}
                  accessibilityIgnoresInvertColors
                  style={[styles.thumb, { borderRadius: theme.radii.sm }]}
                />
              ) : (
                <View
                  style={[
                    styles.thumb,
                    styles.center,
                    { borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceMuted },
                  ]}
                >
                  <Icon name="meal" size={theme.fontSize.lg} color={theme.colors.textFaint} />
                </View>
              )}
              <View style={styles.grow}>
                <Text
                  variant="label"
                  numberOfLines={2}
                  style={{
                    fontSize: theme.fontSize.md,
                    lineHeight: FIT_LINE.md,
                    fontWeight: theme.fontWeight.semibold,
                  }}
                >
                  {entry.title}
                </Text>
                <Quiet size="sm">
                  {[
                    t('fit4.fits.portion', {
                      kcal: whole.format(entry.perServing.kcal),
                      protein: whole.format(entry.perServing.proteinG),
                    }),
                    ...pantryNote(coverage, entry.id, t),
                  ].join(' · ')}
                </Quiet>
              </View>
              <RoundAdd
                label={t('fit4.fits.log', { title: entry.title })}
                busy={busy === entry.id}
                disabled={busy !== null}
                onPress={() => void eat(entry)}
              />
            </View>
          );
        })}
      </View>
      {error ? (
        <Text variant="label" tone="danger" style={{ marginTop: theme.spacing.md }}>
          {error}
        </Text>
      ) : null}
    </Block>
  );
}

/** „alles da“ oder „fehlt: Feta“ — nur, wenn die Kueche das Rezept kennt und es einen Vorrat gibt. */
function pantryNote(
  coverage: readonly RecipeSuggestion[],
  id: string,
  t: ReturnType<typeof useI18n>['t'],
): string[] {
  const found = coverage.find((entry) => entry.recipe.id === id);
  if (!found) return [];
  const lacking = [...found.missing, ...found.short].filter(
    (line) => !line.optional && !line.basic,
  );
  if (lacking.length === 0) return [t('fit4.fits.allThere')];
  return [t('fit4.fits.lacking', { names: lacking.map((line) => line.name).join(', ') })];
}

/** Das runde, weiche Plus rechts in einer Zeile: eine Portion eintragen. */
export function RoundAdd({
  label,
  busy = false,
  disabled = false,
  onPress,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.round,
          styles.center,
          {
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surfaceMuted,
            opacity: disabled && !busy ? 0.5 : 1,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={theme.colors.textMuted} />
        ) : (
          <Icon name="plus" size={18} color={theme.colors.text} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB },
  round: { width: HIT_TARGET, height: HIT_TARGET },
});
