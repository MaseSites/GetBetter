import { useState } from 'react';
import { View } from 'react-native';

import { fit, type FitFood } from '@/db/fit';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Input, Text } from '@/ui';

import { parseDecimal } from './setupForm';

/** Wenn nichts passt: eigene Werte je 100 g, vom Dienst geprueft. */
export function CustomFoodForm({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string;
  onCreated: (food: FitFood) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [name, setName] = useState(initialName);
  const [values, setValues] = useState({ kcal: '', proteinG: '', carbsG: '', fatG: '' });
  const [piece, setPiece] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const per100 = {
      kcal: parseDecimal(values.kcal),
      proteinG: parseDecimal(values.proteinG),
      carbsG: parseDecimal(values.carbsG),
      fatG: parseDecimal(values.fatG),
    };
    if (name.trim().length === 0 || Object.values(per100).some((value) => value === null)) {
      setError(t('fit.custom.missing'));
      return;
    }
    setSaving(true);
    const gramsPerPiece = parseDecimal(piece);
    const result = await fit.addCustomFood({
      name,
      per100: per100 as { kcal: number; proteinG: number; carbsG: number; fatG: number },
      ...(gramsPerPiece ? { gramsPerPiece } : {}),
    });
    setSaving(false);
    if (result.ok) onCreated(result.data.food);
    else
      setError(
        result.error === 'per100_invalid' ? t('fit.custom.implausible') : t('fit.error.body'),
      );
  }

  const field = (key: keyof typeof values, label: string) => (
    <View style={{ flex: 1 }}>
      <Input
        label={label}
        value={values[key]}
        onChangeText={(value) => {
          setValues((current) => ({ ...current, [key]: value }));
          setError(null);
        }}
        keyboardType="decimal-pad"
      />
    </View>
  );

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text variant="body" tone="muted">
        {t('fit.custom.intro')}
      </Text>
      <Input label={t('fit.custom.name')} value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {field('kcal', t('fit.macro.kcal'))}
        {field('proteinG', t('fit.macro.proteinG'))}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {field('carbsG', t('fit.macro.carbsG'))}
        {field('fatG', t('fit.macro.fatG'))}
      </View>
      <Input
        label={t('fit.custom.piece')}
        value={piece}
        onChangeText={setPiece}
        keyboardType="decimal-pad"
      />
      {error ? (
        <Text variant="label" tone="danger">
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t('fit.custom.save')}
            onPress={() => void create()}
            loading={saving}
            disabled={saving}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}
