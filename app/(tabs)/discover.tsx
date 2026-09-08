import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useTranslate, type TranslationKey } from '@/i18n';
import { searchModules } from '@/mocks/modules';
import { AREAS, type Area } from '@/mocks/types';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Badge, Card, Chip, EmptyState, Header, Icon, Input, Screen, Text } from '@/ui';

type Filter = Area | 'all';

export default function DiscoverScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { state } = useApp();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const results = useMemo(() => searchModules(query, filter), [query, filter]);
  const searching = query.trim().length > 0;

  return (
    <Screen
      header={
        <Header
          title={t('discover.title')}
          subtitle={t('discover.results', { count: results.length })}
        >
          <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t('discover.searchPlaceholder')}
              icon="search"
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel={t('discover.searchPlaceholder')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.lg }}
            >
              <Chip
                label={t('discover.all')}
                selected={filter === 'all'}
                onPress={() => setFilter('all')}
              />
              {AREAS.map((area) => (
                <Chip
                  key={area}
                  label={t(`area.${area}` as TranslationKey)}
                  selected={filter === area}
                  onPress={() => setFilter(area)}
                />
              ))}
            </ScrollView>
          </View>
        </Header>
      }
    >
      {results.length === 0 ? (
        searching ? (
          <EmptyState
            icon="search"
            title={t('discover.empty.title')}
            body={t('discover.empty.body', { query: query.trim() })}
            actionLabel={t('discover.empty.action')}
            onAction={() => {
              setQuery('');
              setFilter('all');
            }}
          />
        ) : (
          <EmptyState
            icon="compass"
            title={t('discover.areaEmpty.title')}
            body={t('discover.areaEmpty.body')}
            actionLabel={t('discover.all')}
            onAction={() => setFilter('all')}
          />
        )
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {results.map((module) => {
            const installed = state.installedModuleIds.includes(module.id);
            return (
              <Card
                key={module.id}
                onPress={() => router.push(`/module/${module.id}`)}
                accessibilityLabel={module.name}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: theme.radii.md,
                      backgroundColor: theme.colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={module.icon} size={22} color={theme.colors.accentStrong} />
                  </View>
                  <View style={{ flex: 1, gap: theme.spacing.xs }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <Text variant="title">{module.name}</Text>
                      {installed ? (
                        <Badge label={t('discover.installed')} tone="accent" icon="check" />
                      ) : null}
                    </View>
                    <Text variant="label" tone="muted">
                      {module.short}
                    </Text>
                    <Text variant="caption" tone="faint">
                      {t(`area.${module.area}` as TranslationKey)}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
