import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  MOCK_FIXTURES,
  fit,
  idempotencyKey,
  type AnalysisLevel,
  type MealAnalysis,
  type MealSlot,
} from '@/db/fit';
import {
  ImagePermissionError,
  canPickImage,
  hasCamera,
  pickImage,
  type ImageSource,
} from '@/features/personalize/pickImage';
import { useI18n, type TranslationKey } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Button, Checkbox, Chip, Icon, Sheet, Text, type IconName } from '@/ui';

import { photoPreview } from './mealMath';
import { PhotoItems, asPhotoRow, rowsOf, type EditRow, type Searching } from './PhotoItems';
import { useFit } from './useFit';
import { useMealToast } from './useMealToast';
import { portionText } from './portionText';

/** Ein 1×1-PNG: im Mock-Modus reicht es, damit der Ablauf ohne echtes Foto laeuft. */
const SAMPLE_IMAGE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Fehler mit eigenem Satz; alles andere heisst „hat nicht geklappt“. */
const KNOWN_ERRORS = [
  'no_food',
  'daily_limit',
  'budget_exhausted',
  'ai_disabled',
  'image_type',
  'image_too_large',
  'offline',
  'too_many_images',
];

const LEVEL_ICON: Record<AnalysisLevel, IconName> = {
  green: 'checkCircle',
  orange: 'info',
  red: 'warning',
};

/**
 * Eine Mahlzeit per Foto: die KI erkennt Lebensmittel und Mengen, der Dienst
 * rechnet. Hier sieht man, wie sicher das ist, beantwortet hoechstens zwei
 * Fragen, korrigiert Gramm — und traegt erst dann ein.
 */
export function PhotoAnalysisSheet({
  visible,
  slot,
  day,
  onClose,
  initialAnalysis = null,
}: {
  visible: boolean;
  slot: MealSlot;
  day: string;
  onClose: () => void;
  /** Schon analysiert — das Plus hat direkt fotografiert, hier geht es mit dem Ergebnis weiter. */
  initialAnalysis?: MealAnalysis | null;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const status = useFit(() => fit.status(), []);
  const toast = useMealToast();
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(initialAnalysis);
  const [rows, setRows] = useState<EditRow[]>(() => rowsOf(initialAnalysis));
  const [searching, setSearching] = useState<Searching>(null);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [expired, setExpired] = useState(false);
  const [fixture, setFixture] = useState<string>('rice_chicken_veg');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [key] = useState(() => idempotencyKey('photo'));
  const [recipeKey] = useState(() => idempotencyKey('photo-recipe'));
  const [recipePortions, setRecipePortions] = useState(1);
  const saved = useFit(() => fit.recipes(), []);
  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const mock = status.data?.mode === 'mock';

  const errorText = (code: string) => {
    if (code === 'analysis_expired') return t('fit4.photo.expired');
    if (code === 'in_progress') return t('fit4.inProgress');
    return t(`fit.photo.error.${KNOWN_ERRORS.includes(code) ? code : 'generic'}` as TranslationKey);
  };

  /** Ein Fehler des Dienstes; ist das Foto abgelaufen, geht es nur mit einem neuen weiter. */
  function fail(code: string) {
    setError(errorText(code));
    if (code === 'analysis_expired') setExpired(true);
  }

  function show(next: MealAnalysis) {
    setAnalysis(next);
    setRows(rowsOf(next));
    setSearching(null);
    setChecked(false);
    setConfirmLarge(false);
    setExpired(false);
  }

  async function start(image: string | null) {
    if (!image) return;
    setBusy(true);
    setError(null);
    const result = await fit.startAnalysis({
      image,
      day,
      slot,
      language,
      ...(mock ? { mockFixture: fixture } : {}),
    });
    setBusy(false);
    if (result.ok) show(result.data.analysis);
    else fail(result.error);
  }

  /** Abgelaufen: alles verwerfen und von vorn — das naechste Foto startet neu. */
  function restart() {
    setAnalysis(null);
    setRows([]);
    setError(null);
    setExpired(false);
  }

  async function choose(sample: boolean, source: ImageSource = 'camera') {
    try {
      await start(sample ? SAMPLE_IMAGE : await pickImage(source));
    } catch (failure) {
      setError(
        failure instanceof ImagePermissionError
          ? t('fit.photo.permission')
          : errorText('image_type'),
      );
    }
  }

  async function secondImage() {
    if (!analysis) return;
    try {
      const image = mock ? SAMPLE_IMAGE : await pickImage('camera');
      if (!image) return;
      setBusy(true);
      const result = await fit.addAnalysisImage(analysis.id, image);
      setBusy(false);
      if (result.ok) show(result.data.analysis);
      else fail(result.error);
    } catch (failure) {
      setBusy(false);
      setError(
        failure instanceof ImagePermissionError
          ? t('fit.photo.permission')
          : errorText('image_type'),
      );
    }
  }

  /** Eigenes Rezept statt Schaetzung: Portion eintragen, die Analyse verwerfen. */
  async function logAsRecipe(recipeId: string) {
    if (!analysis) return;
    setBusy(true);
    const result = await fit.logRecipe(
      recipeId,
      { portions: recipePortions, slot, day },
      recipeKey,
    );
    setBusy(false);
    if (result.ok) {
      toast.logged(result.data.meal);
      close(true);
    } else fail(result.error);
  }

  async function answer(questionId: string, optionId: string) {
    if (!analysis || busy) return;
    setBusy(true);
    const result = await fit.answerAnalysis(analysis.id, questionId, optionId);
    setBusy(false);
    if (result.ok) show(result.data.analysis);
    else fail(result.error);
  }

  const edited = rows.map(asPhotoRow);
  const preview = photoPreview(edited);
  const usable = edited.filter((row) => row.food && row.grams !== null && row.grams > 0);
  const canConfirm =
    analysis !== null &&
    !expired &&
    searching === null &&
    usable.length > 0 &&
    edited.every((row) => !row.food || (row.grams !== null && row.grams > 0)) &&
    (!analysis.reviewRequired || checked);

  async function confirm() {
    if (!analysis || busy) return;
    setBusy(true);
    setError(null);
    const items = usable.map((row) => ({ foodId: row.food?.id ?? '', grams: row.grams ?? 0 }));
    const result = await fit.confirmAnalysis(
      analysis.id,
      { items, slot, day, ...(confirmLarge ? { confirmLarge: true } : {}) },
      key,
    );
    setBusy(false);
    if (result.ok) {
      toast.logged(result.data.meal);
      close(false);
      return;
    }
    // Grosse Portion: nachfragen statt Sackgasse — derselbe Knopf traegt dann trotzdem ein.
    if (result.error === 'confirm_large_portion') {
      setConfirmLarge(true);
      setError(t('fit.add.confirmLarge'));
      return;
    }
    fail(result.error);
  }

  function close(cancel = true) {
    if (cancel && analysis && analysis.status === 'open') void fit.cancelAnalysis(analysis.id);
    setAnalysis(null);
    setRows([]);
    setError(null);
    onClose();
  }

  return (
    <Sheet
      visible={visible}
      onClose={() => close()}
      title={t('fit.photo.title')}
      subtitle={t(`meals.slot.${slot}` as TranslationKey)}
    >
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        {!analysis ? (
          <>
            <Text variant="body" tone="muted">
              {t('fit.photo.intro')}
            </Text>
            {mock ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="label">{t('fit.photo.mockPick')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {MOCK_FIXTURES.map((name) => (
                    <Chip
                      key={name}
                      label={t(`fit.photo.fixture.${name}` as TranslationKey)}
                      selected={fixture === name}
                      onPress={() => setFixture(name)}
                    />
                  ))}
                </View>
                <Button
                  label={t('fit.photo.useSample')}
                  icon="image"
                  onPress={() => void choose(true)}
                  loading={busy}
                  disabled={busy}
                />
              </View>
            ) : null}
            {canPickImage() ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Button
                  label={t(hasCamera() ? 'fit.photo.camera' : 'fit.photo.pick')}
                  variant={mock ? 'secondary' : 'primary'}
                  icon="image"
                  onPress={() => void choose(false, hasCamera() ? 'camera' : 'library')}
                  loading={busy && !mock}
                  disabled={busy}
                />
                {hasCamera() ? (
                  <Button
                    label={t('fit.photo.library')}
                    variant="ghost"
                    icon="upload"
                    onPress={() => void choose(false, 'library')}
                    disabled={busy}
                  />
                ) : null}
              </View>
            ) : (
              <Text variant="label" tone="muted">
                {t('fit.photo.deviceSoon')}
              </Text>
            )}
            <Text variant="caption" tone="muted">
              {t(status.data?.storeOriginalImages ? 'fit.photo.privacyKeep' : 'fit.photo.privacy')}
            </Text>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Icon
                name={LEVEL_ICON[analysis.level]}
                size={theme.fontSize.lede}
                color={analysis.level === 'red' ? theme.colors.danger : theme.colors.text}
              />
              <Text
                variant="label"
                tone={analysis.level === 'red' ? 'danger' : 'default'}
                style={{ flex: 1 }}
              >
                {t(`fit.photo.level.${analysis.level}` as TranslationKey)}
              </Text>
            </View>
            <View>
              <Text variant="title">{analysis.mealName}</Text>
              <Text variant="body" style={numeric}>
                {preview.max > preview.min
                  ? t('fit.photo.range', {
                      kcal: whole.format(preview.kcal),
                      min: whole.format(preview.min),
                      max: whole.format(preview.max),
                    })
                  : t('fit.add.preview', { kcal: whole.format(preview.kcal) })}
              </Text>
            </View>
            {analysis.warnings.map((warning) => (
              <Text key={warning} variant="caption" tone="muted">
                {warning}
              </Text>
            ))}

            {analysis.questions.map((question) => (
              <View key={question.id} style={{ gap: theme.spacing.sm }}>
                <Text variant="label">
                  {t(`fit.photo.question.${question.kind}` as TranslationKey, {
                    subject: question.subject,
                  })}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {question.options.map((option) => (
                    <Chip
                      key={option}
                      label={t(`fit.photo.option.${question.kind}.${option}` as TranslationKey)}
                      disabled={busy}
                      onPress={() => void answer(question.id, option)}
                    />
                  ))}
                </View>
              </View>
            ))}

            <PhotoItems
              rows={rows}
              searching={searching}
              onRows={(next) => {
                setRows(next);
                setConfirmLarge(false);
                setError(null);
              }}
              onSearch={setSearching}
            />

            {(saved.data?.recipes ?? []).length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="label">{t('fit.photo.ownRecipe')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {[0.5, 1, 1.5, 2].map((value) => (
                    <Chip
                      key={value}
                      label={portionText(t, value, (count) => String(count))}
                      selected={recipePortions === value}
                      onPress={() => setRecipePortions(value)}
                    />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {(saved.data?.recipes ?? []).slice(0, 6).map((recipe) => (
                    <Chip
                      key={recipe.id}
                      label={recipe.title}
                      onPress={() => void logAsRecipe(recipe.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {analysis.secondImageRecommended &&
            analysis.images < (status.data?.maxImagesPerAnalysis ?? 2) ? (
              <Button
                label={t('fit.photo.second')}
                variant="secondary"
                icon="image"
                onPress={() => void secondImage()}
                disabled={busy}
              />
            ) : null}

            {analysis.reviewRequired ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                aria-checked={checked}
                accessibilityLabel={t('fit.photo.reviewed')}
                onPress={() => setChecked((value) => !value)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
              >
                <Checkbox checked={checked} />
                <Text variant="body" style={{ flex: 1 }}>
                  {t('fit.photo.reviewed')}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        {error ? (
          <Text variant="label" tone="danger">
            {error}
          </Text>
        ) : null}

        {analysis && expired ? (
          <Button label={t('fit4.photo.again')} icon="image" onPress={restart} />
        ) : analysis && searching === null ? (
          <Button
            label={confirmLarge ? t('fit.add.logAnyway') : t('fit.add.log')}
            icon="check"
            onPress={() => void confirm()}
            loading={busy}
            disabled={busy || !canConfirm}
          />
        ) : null}
      </View>
    </Sheet>
  );
}
