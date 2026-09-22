import { useState } from 'react';
import { View } from 'react-native';

import { fit, type FitFood, type NutritionLabel } from '@/db/fit';
import { canPickImage, hasCamera, pickImage } from '@/features/personalize/pickImage';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Input, Text } from '@/ui';

import { canDetectBarcode, detectBarcode } from './barcodeScan';
import { BarcodeScanner, canScanLive } from './BarcodeScanner';
import { parseDecimal } from './setupForm';

const PNG_SAMPLE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

type LabelDraft = {
  name: string;
  brand: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
  sugarG: string;
  saltG: string;
  portion: string;
};

const asText = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

const draftOf = (label: NutritionLabel | null): LabelDraft => ({
  fiberG: asText(label?.per100.fiberG),
  sugarG: asText(label?.per100.sugarG),
  saltG: asText(label?.per100.saltG),
  name: label?.productName ?? '',
  brand: label?.brand ?? '',
  kcal:
    label?.per100.kcal === null || label?.per100.kcal === undefined
      ? ''
      : String(label.per100.kcal),
  proteinG:
    label?.per100.proteinG === null || label?.per100.proteinG === undefined
      ? ''
      : String(label.per100.proteinG),
  carbsG:
    label?.per100.carbsG === null || label?.per100.carbsG === undefined
      ? ''
      : String(label.per100.carbsG),
  fatG:
    label?.per100.fatG === null || label?.per100.fatG === undefined
      ? ''
      : String(label.per100.fatG),
  portion: label?.portionGrams ? String(label.portionGrams) : '',
});

/**
 * Verpackt: erst der Barcode (genauer als jedes Foto), und wenn ihn niemand
 * kennt, die Naehrwerttabelle fotografieren, ablesen lassen, pruefen,
 * bestaetigen. Gespeichert wird erst nach dem Tipp auf „Speichern“.
 */
export function PackagedFlow({
  mock,
  onPicked,
  onCancel,
}: {
  mock: boolean;
  onPicked: (food: FitFood) => void;
  onCancel: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<string | null>(null);
  const [label, setLabel] = useState<LabelDraft | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  // Gibt es das Produkt schon unter diesem Namen: das Vorhandene nehmen oder bewusst neu.
  const [duplicate, setDuplicate] = useState<FitFood | null>(null);
  // Am Telefon geht die Kamera gleich auf — wer „Verpackung scannen“ tippt, will scannen.
  const [live, setLive] = useState(canScanLive && !mock);

  async function lookup(value: string) {
    setBusy(true);
    setMessage(null);
    const result = await fit.lookupBarcode(value.trim());
    setBusy(false);
    if (result.ok) {
      onPicked(result.data.food);
      return;
    }
    if (result.error === 'barcode_unknown') setUnknown(value.trim());
    else
      setMessage(t(result.error === 'barcode_invalid' ? 'fit.barcode.invalid' : 'fit.error.body'));
  }

  async function scanCode() {
    try {
      const image = await pickImage();
      if (!image) return;
      const found = await detectBarcode(image);
      if (found) {
        setCode(found);
        await lookup(found);
      } else setMessage(t('fit.barcode.notDetected'));
    } catch {
      setMessage(t('fit.photo.error.image_type'));
    }
  }

  async function scanLabel() {
    try {
      const image = mock ? PNG_SAMPLE : await pickImage(hasCamera() ? 'camera' : 'library');
      if (!image) return;
      setBusy(true);
      const result = await fit.scanLabel(image, language);
      setBusy(false);
      if (result.ok) {
        setLabel(draftOf(result.data.label));
        setProblems(result.data.label.plausible ? [] : result.data.label.problems);
      } else
        setMessage(
          t(result.error === 'label_unreadable' ? 'fit.label.unreadable' : 'fit.error.body'),
        );
    } catch {
      setBusy(false);
      setMessage(t('fit.photo.error.image_type'));
    }
  }

  async function save(allowDuplicate = false) {
    if (!label) return;
    const per100 = {
      kcal: parseDecimal(label.kcal),
      proteinG: parseDecimal(label.proteinG),
      carbsG: parseDecimal(label.carbsG),
      fatG: parseDecimal(label.fatG),
    };
    if (!label.name.trim() || Object.values(per100).some((value) => value === null)) {
      setMessage(t('fit.custom.missing'));
      return;
    }
    // Ballaststoffe, Zucker, Salz nur, wo sie auf der Verpackung stehen.
    const extras = Object.fromEntries(
      (['fiberG', 'sugarG', 'saltG'] as const)
        .map((key) => [key, parseDecimal(label[key])] as const)
        .filter(([, value]) => value !== null),
    ) as { fiberG?: number; sugarG?: number; saltG?: number };
    setBusy(true);
    setDuplicate(null);
    const result = await fit.saveLabel({
      name: label.name,
      brand: label.brand || null,
      barcode: unknown,
      per100: {
        ...(per100 as { kcal: number; proteinG: number; carbsG: number; fatG: number }),
        ...extras,
      },
      gramsPerPiece: parseDecimal(label.portion),
      allowDuplicate,
    });
    setBusy(false);
    if (result.ok) {
      onPicked(result.data.food);
      return;
    }
    const existing = (result.details as { food?: FitFood } | undefined)?.food ?? null;
    if (result.error === 'duplicate_name' && existing) {
      setDuplicate(existing);
      return;
    }
    setMessage(
      t(
        result.error === 'per100_invalid'
          ? 'fit.custom.implausible'
          : result.error === 'offline'
            ? 'fit.offline.body'
            : 'fit.error.body',
      ),
    );
  }

  const field = (key: keyof LabelDraft, text: string, numeric = true) =>
    label ? (
      <Input
        label={text}
        value={label[key]}
        onChangeText={(value) => {
          setLabel({ ...label, [key]: value });
          setMessage(null);
          if (key === 'name') setDuplicate(null);
        }}
        {...(numeric ? { keyboardType: 'decimal-pad' as const } : {})}
      />
    ) : null;

  return (
    <View style={{ gap: theme.spacing.md }}>
      {label ? (
        <>
          <Text variant="body" tone="muted">
            {t('fit.label.check')}
          </Text>
          {problems.length > 0 ? (
            <Text variant="label" tone="danger">
              {t('fit.label.implausible')}
            </Text>
          ) : null}
          {field('name', t('fit.custom.name'), false)}
          {field('brand', t('fit.label.brand'), false)}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>{field('kcal', t('fit.macro.kcal'))}</View>
            <View style={{ flex: 1 }}>{field('proteinG', t('fit.macro.proteinG'))}</View>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>{field('carbsG', t('fit.macro.carbsG'))}</View>
            <View style={{ flex: 1 }}>{field('fatG', t('fit.macro.fatG'))}</View>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>{field('fiberG', t('fit4.label.fiber'))}</View>
            <View style={{ flex: 1 }}>{field('sugarG', t('fit4.label.sugar'))}</View>
            <View style={{ flex: 1 }}>{field('saltG', t('fit4.label.salt'))}</View>
          </View>
          {field('portion', t('fit.label.portion'))}
          {duplicate ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="label">{t('fit4.label.duplicate', { name: duplicate.name })}</Text>
              <Button
                label={t('fit4.label.useExisting')}
                icon="check"
                onPress={() => onPicked(duplicate)}
              />
              <Button
                label={t('fit4.label.saveNew')}
                variant="secondary"
                onPress={() => void save(true)}
                loading={busy}
                disabled={busy}
              />
            </View>
          ) : (
            <Button
              label={t('fit.custom.save')}
              icon="check"
              onPress={() => void save()}
              loading={busy}
              disabled={busy}
            />
          )}
        </>
      ) : unknown ? (
        <>
          <Text variant="body">{t('fit.barcode.unknown', { code: unknown })}</Text>
          <Button
            label={t('fit.label.scan')}
            icon="image"
            onPress={() => void scanLabel()}
            loading={busy}
            disabled={busy || (!mock && !canPickImage())}
          />
          {/* Ohne Kamera oder wenn die Tabelle nicht lesbar ist: die Werte von Hand, der Code bleibt. */}
          <Button
            label={t('fit4.label.manual')}
            variant="secondary"
            icon="note"
            onPress={() => {
              setLabel(draftOf(null));
              setProblems([]);
              setMessage(null);
            }}
            disabled={busy}
          />
        </>
      ) : (
        <>
          {live ? (
            <BarcodeScanner
              onCode={(found) => {
                setLive(false);
                setCode(found);
                void lookup(found);
              }}
              onCancel={() => setLive(false)}
            />
          ) : canScanLive ? (
            <Button
              label={t('fit.scan.open')}
              icon="card"
              onPress={() => setLive(true)}
              disabled={busy}
            />
          ) : null}
          <Input
            label={t('fit.barcode.code')}
            placeholder="7610000000011"
            value={code}
            onChangeText={(value) => {
              setCode(value);
              setMessage(null);
            }}
            keyboardType="number-pad"
            returnKeyType="search"
            onSubmitEditing={() => void lookup(code)}
          />
          <Button
            label={t('fit.barcode.lookup')}
            icon="search"
            onPress={() => void lookup(code)}
            loading={busy}
            disabled={busy || code.trim().length < 8}
          />
          {canDetectBarcode() ? (
            <Button
              label={t('fit.barcode.fromPhoto')}
              variant="secondary"
              icon="image"
              onPress={() => void scanCode()}
              disabled={busy}
            />
          ) : null}
          <Text variant="caption" tone="muted">
            {t(mock ? 'fit.barcode.mockHint' : 'fit.barcode.hint')}
          </Text>
        </>
      )}
      {message ? (
        <Text variant="label" tone="danger">
          {message}
        </Text>
      ) : null}
      <Button label={t('common.back')} variant="ghost" onPress={onCancel} />
    </View>
  );
}
