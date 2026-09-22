import { useState } from 'react';
import { View } from 'react-native';

import { fit, type FitGym } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, Skeleton, Text, type IconName } from '@/ui';

import { ChoiceTile } from './ChoiceTile';
import { useFit } from './useFit';

const KIND_ICON: Record<FitGym['kind'], IconName> = {
  gym: 'fitness',
  home: 'home',
  outdoor: 'sun',
};

/** Name eines Studios: echte Namen kommen vom Dienst, „Zuhause“ und Co. aus der Sprache der App. */
export function gymName(
  t: (key: TranslationKey) => string,
  gym: Pick<FitGym, 'id' | 'name'>,
): string {
  return gym.name ?? t(`fit.gym.${gym.id}` as TranslationKey);
}

/**
 * Wo trainierst du? Studios mit Namen, dann Zuhause und Draussen. Nach der
 * Wahl die typische Ausstattung als Chips — ehrlich als Vorauswahl markiert,
 * denn welche Geraete eine Filiale wirklich hat, weiss nur, wer dort trainiert.
 */
export function GymPicker({
  gym,
  equipment,
  onChange,
}: {
  gym: string | null;
  equipment: string[];
  onChange: (next: { gym: string; equipment: string[] }) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const data = useFit(() => fit.gyms(), []);
  const gyms = data.data?.gyms ?? [];
  const tags = data.data?.equipment ?? [];
  const chosen = gyms.find((entry) => entry.id === gym) ?? null;
  // Nach der Wahl steht nur noch das eine Studio da, damit die Geraete gleich darunter sichtbar sind.
  const [browsing, setBrowsing] = useState(gym === null);
  const shown = browsing || !chosen ? gyms : [chosen];

  if (data.loading) {
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <Skeleton height={64} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </View>
    );
  }

  const toggle = (tag: string) => {
    if (!chosen) return;
    const next = equipment.includes(tag)
      ? equipment.filter((entry) => entry !== tag)
      : [...equipment, tag];
    // Ohne jedes Geraet bleibt der eigene Koerper — leer waere kein Plan.
    onChange({ gym: chosen.id, equipment: next.length > 0 ? next : ['none'] });
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.sm }}>
        {shown.map((entry) => (
          <ChoiceTile
            key={entry.id}
            icon={KIND_ICON[entry.kind]}
            title={gymName(t, entry)}
            hint={
              entry.kind === 'gym' && entry.name
                ? t('fit.gym.chainHint')
                : t(`fit.gym.${entry.id}.hint` as TranslationKey)
            }
            selected={entry.id === gym}
            onPress={() => {
              if (!browsing && entry.id === gym) {
                setBrowsing(true);
                return;
              }
              setBrowsing(false);
              onChange({
                gym: entry.id,
                equipment: entry.id === gym ? equipment : entry.equipment,
              });
            }}
          />
        ))}
        {!browsing && chosen ? (
          <Chip label={t('fit.gym.change')} onPress={() => setBrowsing(true)} />
        ) : null}
      </View>
      {chosen && !browsing ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label">{t('fit.gym.equipmentTitle', { gym: gymName(t, chosen) })}</Text>
          <Text variant="caption" tone="muted">
            {t('fit.gym.equipmentHint')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={t(`fit.gear.${tag}` as TranslationKey)}
                selected={equipment.includes(tag)}
                onPress={() => toggle(tag)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
