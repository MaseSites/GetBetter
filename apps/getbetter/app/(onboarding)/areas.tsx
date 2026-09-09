import { useState } from 'react';
import { View } from 'react-native';

import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { StepHeader } from '@/features/onboarding/StepHeader';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { AREAS, type Area } from '@/mocks/types';
import { useTheme } from '@/theme';
import { Button, Card, Icon, Screen, Text } from '@/ui';
import type { IconName } from '@/ui/Icon';

const AREA_ICON: Record<Area, IconName> = {
  health: 'heart',
  organisation: 'calendar',
  money: 'wallet',
  household: 'home',
};

export default function AreasStep() {
  const t = useTranslate();
  const theme = useTheme();
  const { firstName, areas, toggleArea } = useOnboarding();
  const { completeOnboarding } = useApp();
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (busy) return;
    setBusy(true);
    // Der RouteGuard schickt danach selbst in die Tabs.
    await completeOnboarding({ firstName, areas });
  }

  return (
    <Screen
      header={<StepHeader step="areas" />}
      footer={
        <Button
          label={t('onboarding.finish')}
          onPress={finish}
          loading={busy}
          disabled={areas.length === 0}
        />
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display">{t('onboarding.areas.title')}</Text>
        <Text variant="body" tone="muted">
          {t('onboarding.areas.subtitle')}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {AREAS.map((area) => {
          const selected = areas.includes(area);
          return (
            <Card
              key={area}
              onPress={() => toggleArea(area)}
              accessibilityLabel={t(`area.${area}` as TranslationKey)}
              style={{
                borderColor: selected ? theme.colors.accent : theme.colors.border,
                backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Icon
                  name={AREA_ICON[area]}
                  size={22}
                  color={selected ? theme.colors.accentStrong : theme.colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{t(`area.${area}` as TranslationKey)}</Text>
                </View>
                {selected ? (
                  <Icon name="checkCircle" size={22} color={theme.colors.accent} />
                ) : (
                  <Icon name="circle" size={22} color={theme.colors.borderStrong} />
                )}
              </View>
            </Card>
          );
        })}
      </View>

      <Text variant="caption" tone="faint">
        {t('onboarding.areas.selected', { count: areas.length })}
      </Text>
    </Screen>
  );
}
