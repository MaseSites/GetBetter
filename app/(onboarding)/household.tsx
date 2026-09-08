import { useState } from 'react';
import { View } from 'react-native';

import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { StepHeader } from '@/features/onboarding/StepHeader';
import { useTranslate } from '@/i18n';
import { useApp, type HouseholdChoice } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Icon, Screen, Text } from '@/ui';
import type { IconName } from '@/ui/Icon';

type Option = {
  choice: HouseholdChoice;
  icon: IconName;
  titleKey:
    'onboarding.household.create' | 'onboarding.household.join' | 'onboarding.household.solo';
  hintKey:
    | 'onboarding.household.createHint'
    | 'onboarding.household.joinHint'
    | 'onboarding.household.soloHint';
};

const OPTIONS: readonly Option[] = [
  {
    choice: 'created',
    icon: 'home',
    titleKey: 'onboarding.household.create',
    hintKey: 'onboarding.household.createHint',
  },
  {
    choice: 'joined',
    icon: 'people',
    titleKey: 'onboarding.household.join',
    hintKey: 'onboarding.household.joinHint',
  },
  {
    choice: 'solo',
    icon: 'person',
    titleKey: 'onboarding.household.solo',
    hintKey: 'onboarding.household.soloHint',
  },
];

export default function HouseholdStep() {
  const t = useTranslate();
  const theme = useTheme();
  const { firstName, areas, selectedModuleIds } = useOnboarding();
  const { completeOnboarding } = useApp();
  const [choice, setChoice] = useState<HouseholdChoice>('created');

  function finish() {
    // Der RouteGuard schickt danach selbst in die Tabs.
    completeOnboarding({
      firstName,
      areas,
      moduleIds: selectedModuleIds,
      householdChoice: choice,
    });
  }

  return (
    <Screen
      header={<StepHeader step="household" />}
      footer={<Button label={t('onboarding.household.finish')} onPress={finish} />}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display">{t('onboarding.household.title')}</Text>
        <Text variant="body" tone="muted">
          {t('onboarding.household.subtitle')}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {OPTIONS.map((option) => {
          const selected = choice === option.choice;
          return (
            <Card
              key={option.choice}
              onPress={() => setChoice(option.choice)}
              accessibilityLabel={t(option.titleKey)}
              style={{
                borderColor: selected ? theme.colors.accent : theme.colors.border,
                backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Icon
                  name={option.icon}
                  size={22}
                  color={selected ? theme.colors.accentStrong : theme.colors.textMuted}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body">{t(option.titleKey)}</Text>
                  <Text variant="caption" tone="muted">
                    {t(option.hintKey)}
                  </Text>
                </View>
                {selected ? <Icon name="check" size={20} color={theme.colors.accent} /> : null}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
