import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { StepHeader } from '@/features/onboarding/StepHeader';
import { useTranslate, type TranslationKey } from '@/i18n';
import { getModule } from '@/mocks/modules';
import { useTheme } from '@/theme';
import { Button, Card, EmptyState, Icon, Screen, Text } from '@/ui';

export default function ModulesStep() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { suggestedIds, selectedModuleIds, toggleModule } = useOnboarding();

  return (
    <Screen
      header={<StepHeader step="modules" />}
      footer={<Button label={t('common.continue')} onPress={() => router.push('/household')} />}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="display">{t('onboarding.modules.title')}</Text>
        <Text variant="body" tone="muted">
          {t('onboarding.modules.subtitle')}
        </Text>
      </View>

      {suggestedIds.length === 0 ? (
        <EmptyState
          icon="compass"
          title={t('onboarding.modules.title')}
          body={t('onboarding.modules.empty')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
        />
      ) : (
        <>
          <Text variant="caption" tone="faint">
            {t('onboarding.modules.selected', {
              count: selectedModuleIds.length,
              total: suggestedIds.length,
            })}
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            {suggestedIds.map((id) => {
              const module = getModule(id);
              if (!module) return null;
              const selected = selectedModuleIds.includes(id);

              return (
                <Card
                  key={id}
                  onPress={() => toggleModule(id)}
                  accessibilityLabel={module.name}
                  style={{
                    borderColor: selected ? theme.colors.accent : theme.colors.border,
                    padding: theme.spacing.md,
                  }}
                >
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
                  >
                    <Icon name={module.icon} size={20} color={theme.colors.textMuted} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="body">{module.name}</Text>
                      <Text variant="caption" tone="muted">
                        {t(`area.${module.area}` as TranslationKey)} · {module.short}
                      </Text>
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
        </>
      )}
    </Screen>
  );
}
