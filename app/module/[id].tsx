import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { UninstallDialog } from '@/features/modules/UninstallDialog';
import { useI18n, type TranslationKey } from '@/i18n';
import { permissionSentences } from '@/lib/permissions';
import { getModule } from '@/mocks/modules';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Badge, Button, Card, EmptyState, Header, Icon, Screen, Text } from '@/ui';

export default function ModuleDetailScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { state, installModule } = useApp();
  const [uninstallId, setUninstallId] = useState<string | null>(null);

  const params = useLocalSearchParams<{ id?: string }>();
  const module = params.id ? getModule(params.id) : undefined;

  if (!module) {
    return (
      <Screen header={<Header showBack />} scroll={false}>
        <EmptyState
          icon="warning"
          title={t('detail.notFound.title')}
          body={t('detail.notFound.body')}
          actionLabel={t('detail.notFound.action')}
          onAction={() => router.replace('/discover')}
        />
      </Screen>
    );
  }

  const installed = state.installedModuleIds.includes(module.id);
  const sentences = permissionSentences(module.permissions, t, language);

  return (
    <Screen
      header={<Header showBack />}
      footer={
        installed ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label={t('detail.open')}
              icon="forward"
              onPress={() => router.push(`/run/${module.id}`)}
            />
            <Button
              label={t('detail.uninstall')}
              variant="danger"
              icon="trash"
              onPress={() => setUninstallId(module.id)}
            />
          </View>
        ) : (
          <Button
            label={t('detail.install')}
            icon="plus"
            onPress={() => installModule(module.id)}
          />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={module.icon} size={30} color={theme.colors.accentStrong} />
        </View>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text variant="display">{module.name}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <Badge label={t(`area.${module.area}` as TranslationKey)} />
            {module.includedInPlan ? (
              <Badge label={t('detail.includedInPlan')} tone="accent" icon="star" />
            ) : null}
            {installed ? <Badge label={t('detail.installed')} tone="accent" icon="check" /> : null}
          </View>
        </View>
      </View>

      <Card title={t('detail.about')}>
        <Text variant="body" tone="muted">
          {module.description}
        </Text>
      </Card>

      {module.includedInPlan ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon name="star" size={18} color={theme.colors.accentStrong} />
            <View style={{ flex: 1 }}>
              <Text variant="label" tone="muted">
                {t('detail.includedInPlan.body')}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card title={t('detail.access')}>
        {sentences.length === 0 ? (
          <Text variant="body" tone="muted">
            {t('detail.access.none')}
          </Text>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {sentences.map((sentence, index) => (
              <View
                key={sentence}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}
              >
                <Icon
                  name={index === 0 ? 'search' : 'note'}
                  size={16}
                  color={theme.colors.textFaint}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="label">{sentence}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      <UninstallDialog moduleId={uninstallId} onClose={() => setUninstallId(null)} />
    </Screen>
  );
}
