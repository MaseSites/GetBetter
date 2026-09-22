import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { fit, type FitAction, type FitFood, type ParsedPantryLine } from '@/db/fit';
import type { PantryChange } from '@/db/fitKitchen';
import { useVoice } from '@/features/assistant/useVoice';
import { useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { EmptyState, Input, Text } from '@/ui';

import { ActionCard } from './ActionCard';
import { ExpiryPicker } from './ExpiryPicker';
import { FitState } from './FitGate';
import { kitchenError } from './kitchenErrors';
import { PackagedFlow } from './PackagedFlow';
import { Block, Hairline, Pill, RoundIcon, Sec } from './KitchenKit';
import { RoundCheck } from './KitchenMedia';
import { PantryList } from './PantryList';
import { RecipeRows } from './RecipeCards';
import { RecipeSheet } from './RecipeSheet';
import { useFit } from './useFit';

type Line = ParsedPantryLine & { keep: boolean };

/**
 * Der Vorrat. Erfassen per Text oder Sprache („Ich habe Bananen, Mehl und
 * Eier“), per Barcode oder von Hand — jedes Mal erst ein Vorschlag mit
 * Haekchen je Zeile; gespeichert wird nach „Bestaetigen“.
 */
export function PantryPanel({ mock, day }: { mock: boolean; day: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const pantry = useFit(() => fit.pantry(), [], ['kitchen']);
  // Was sich aus dem Vorrat kochen laesst — laedt nach jeder Aenderung am Vorrat neu.
  const suggestions = useFit(() => fit.suggest(), [], ['kitchen']);
  const [recipe, setRecipe] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [parsed, setParsed] = useState(false);
  const [bestBefore, setBestBefore] = useState<string | null>(null);
  const [action, setAction] = useState<FitAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [source, setSource] = useState<'text' | 'voice'>('text');
  const voice = useVoice({
    onDictate: (heard) => {
      setText(heard);
      setSource('voice');
    },
    onTurn: async () => null,
  });
  const number = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 1 });

  const failure = (error: string) => kitchenError(t, error);

  async function parse() {
    if (text.trim().length < 2) return;
    setBusy(true);
    setProblem(null);
    const result = await fit.parsePantry(text);
    setBusy(false);
    if (!result.ok) {
      setProblem(failure(result.error));
      return;
    }
    setLines(result.data.lines.map((line) => ({ ...line, keep: line.certain })));
    setUnknown(result.data.unknown);
    setParsed(true);
  }

  async function propose(
    chosen: {
      foodId: string;
      amount: number | null;
      unit: string | null;
      bestBefore?: string | null;
    }[],
    from: string,
  ) {
    if (chosen.length === 0) return;
    setBusy(true);
    setProblem(null);
    const result = await fit.proposePantry(chosen, from);
    setBusy(false);
    if (!result.ok) {
      setProblem(failure(result.error));
      return;
    }
    setAction(result.data.action);
    setLines([]);
    setUnknown([]);
    setParsed(false);
    setText('');
    setBestBefore(null);
  }

  /** Aus der Liste: Menge, Datum oder Entfernen — als Vorschlag. Gibt einen Fehlertext oder null. */
  async function change(next: PantryChange): Promise<string | null> {
    setBusy(true);
    const result = await fit.proposePantryChanges([next]);
    setBusy(false);
    if (!result.ok) return failure(result.error);
    setAction(result.data.action);
    return null;
  }

  const items = pantry.data?.items ?? [];
  const cookNow = (suggestions.data?.suggestions ?? []).slice(0, 3);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {action ? (
        <ActionCard key={action.id} action={action} onDone={() => pantry.reload()} />
      ) : null}

      {scanning ? (
        <PackagedFlow
          mock={mock}
          onPicked={(food: FitFood) => {
            setScanning(false);
            void propose(
              [
                {
                  foodId: food.id,
                  amount: food.gramsPerPiece ? 1 : null,
                  unit: food.gramsPerPiece ? 'piece' : null,
                },
              ],
              'barcode',
            );
          }}
          onCancel={() => setScanning(false)}
        />
      ) : (
        <Block style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                label={t('fit.pantry.say')}
                placeholder={t('fit.pantry.placeholder')}
                value={voice.phase === 'listening' ? voice.heard : text}
                onChangeText={(value) => {
                  setText(value);
                  setSource('text');
                  setParsed(false);
                }}
                returnKeyType="done"
                onSubmitEditing={() => void parse()}
              />
            </View>
            {voice.available ? (
              <RoundIcon
                icon="wave"
                label={t('fit.pantry.dictate')}
                onPress={voice.dictate}
                tone={voice.phase === 'listening' ? 'ink' : 'soft'}
                active={voice.phase === 'listening'}
              />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Pill
              label={t('fit.pantry.recognise')}
              onPress={() => void parse()}
              loading={busy && lines.length === 0}
              disabled={busy || text.trim().length < 2}
            />
            <Pill
              label={t('fit.barcode.open')}
              tone="soft"
              icon="card"
              onPress={() => setScanning(true)}
            />
          </View>
          {unknown.length > 0 ? (
            <Text variant="label" tone="muted">
              {t('fit.pantry.unknown', { words: unknown.join(', ') })}
            </Text>
          ) : null}
          {parsed && lines.length === 0 ? (
            <Text variant="label" tone="muted">
              {t('fit.pantry.nothingFound')}
            </Text>
          ) : null}
        </Block>
      )}

      {problem ? (
        <Text variant="label" tone="danger">
          {problem}
        </Text>
      ) : null}

      {lines.length > 0 ? (
        <Block style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
          <Text variant="overline" tone="faint">
            {t('fit.pantry.review')}
          </Text>
          <View>
            {lines.map((line, index) => (
              <View key={`${line.foodId}-${index}`}>
                {index > 0 ? <Hairline /> : null}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: line.keep }}
                  aria-checked={line.keep}
                  accessibilityLabel={line.name}
                  onPress={() =>
                    setLines((current) =>
                      current.map((entry, position) =>
                        position === index ? { ...entry, keep: !entry.keep } : entry,
                      ),
                    )
                  }
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <RoundCheck checked={line.keep} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={{ fontWeight: theme.fontWeight.semibold }}>
                      {line.name}
                      {line.amount !== null ? (
                        <Text variant="body" tone="muted" style={numeric}>
                          {` · ${number.format(line.amount)} ${t(`fit.unit.${line.unit ?? 'g'}` as TranslationKey)}`}
                        </Text>
                      ) : null}
                    </Text>
                    <Text variant="label" tone={line.certain ? 'muted' : 'danger'}>
                      {line.certain
                        ? t('fit.pantry.heard', { said: line.said })
                        : t('fit.pantry.unsure', { said: line.said })}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
          <ExpiryPicker value={bestBefore} onChange={setBestBefore} today={day} />
          <Pill
            label={t('fit.pantry.propose')}
            icon="check"
            fullWidth
            onPress={() =>
              void propose(
                lines
                  .filter((line) => line.keep)
                  .map(({ foodId, amount, unit }) => ({ foodId, amount, unit, bestBefore })),
                source,
              )
            }
            loading={busy}
            disabled={busy || !lines.some((line) => line.keep)}
          />
        </Block>
      ) : null}

      {items.length > 0 && cookNow.length > 0 ? (
        <View>
          <Sec title={t('fit.pantry.cookNow')} />
          <Block flush>
            <RecipeRows
              entries={cookNow.map((entry) => ({ recipe: entry.recipe, suggestion: entry }))}
              onOpen={setRecipe}
            />
          </Block>
        </View>
      ) : null}

      <FitState loading={pantry.loading} error={pantry.error} onRetry={pantry.reload}>
        {items.length === 0 ? (
          <EmptyState compact title={t('fit.pantry.emptyTitle')} body={t('fit.pantry.emptyBody')} />
        ) : (
          <PantryList items={items} today={day} busy={busy} onPropose={change} />
        )}
      </FitState>
      {recipe ? <RecipeSheet recipeId={recipe} day={day} onClose={() => setRecipe(null)} /> : null}
    </View>
  );
}
