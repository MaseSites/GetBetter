import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslate, type TranslationKey } from '@/i18n';
import { getModule, groupedModules } from '@/mocks/modules';
import type { Area } from '@/mocks/types';
import { useApp } from '@/state/AppContext';
import { moduleTint, useTheme } from '@/theme';
import { Divider, EmptyState, Header, Icon, ListItem, Screen, Segmented, Sheet, Text } from '@/ui';

type ModuleView = 'all' | 'favourites';

export default function MyModulesScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { account, toggleFavourite, isFavourite } = useApp();

  // Beim Oeffnen stehen die Favoriten da, nicht die ganze Liste.
  const [view, setView] = useState<ModuleView>('favourites');
  const [sheetModuleId, setSheetModuleId] = useState<string | null>(null);
  const [homescreenHintFor, setHomescreenHintFor] = useState<string | null>(null);

  // Die im Onboarding gewaehlten Bereiche stehen oben.
  const groups = useMemo(() => {
    const all = groupedModules((account?.selectedAreas ?? []) as Area[]);
    if (view === 'all') return all;
    return all
      .map((group) => ({
        ...group,
        modules: group.modules.filter((module) =>
          (account?.favouriteModuleIds ?? []).includes(module.id),
        ),
      }))
      .filter((group) => group.modules.length > 0);
  }, [view, account?.selectedAreas, account?.favouriteModuleIds]);

  const sheetModule = sheetModuleId ? getModule(sheetModuleId) : undefined;

  function closeSheet() {
    setSheetModuleId(null);
    setHomescreenHintFor(null);
  }

  return (
    <Screen
      header={
        <Header
          large
          title={t('modules.title')}
          subtitle={
            view === 'all'
              ? t('modules.subtitle')
              : t('modules.favouriteCount', { count: account?.favouriteModuleIds.length ?? 0 })
          }
          right={
            <Segmented
              accessibilityLabel={t('modules.view')}
              value={view}
              onChange={setView}
              options={[
                { value: 'all', label: t('modules.view.all') },
                { value: 'favourites', label: t('modules.view.favourites') },
              ]}
            />
          }
        />
      }
      gap={theme.spacing.xl}
    >
      {groups.length === 0 ? (
        <EmptyState
          icon="star"
          title={t('modules.noFavourites.title')}
          body={t('modules.noFavourites.body')}
          actionLabel={t('modules.view.all')}
          onAction={() => setView('all')}
        />
      ) : null}

      {groups.map((group) => (
        <View key={group.area} style={{ gap: theme.spacing.md }}>
          <Text variant="section" tone="muted">
            {t(`area.${group.area}` as TranslationKey)}
          </Text>
          <View style={[styles.row, { rowGap: theme.spacing.lg }]}>
            {group.modules.map((module) => {
              const favourite = isFavourite(module.id);
              const tint = moduleTint(theme, module.id);
              return (
                <Pressable
                  key={module.id}
                  accessibilityRole="button"
                  accessibilityLabel={module.name}
                  accessibilityHint={t('modules.tileHint')}
                  onPress={() => router.push(`/run/${module.id}`)}
                  onLongPress={() => setSheetModuleId(module.id)}
                  delayLongPress={350}
                  style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View>
                    <View
                      style={[
                        styles.tileIcon,
                        { borderRadius: theme.radii.lg, backgroundColor: tint.background },
                      ]}
                    >
                      <Icon name={module.icon} size={26} color={tint.foreground} />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: favourite }}
                      accessibilityLabel={
                        favourite
                          ? t('modules.sheet.removeFavourite')
                          : t('modules.sheet.addFavourite')
                      }
                      hitSlop={8}
                      onPress={() => void toggleFavourite(module.id)}
                      style={({ pressed }) => [
                        styles.star,
                        {
                          borderRadius: theme.radii.pill,
                          backgroundColor: favourite
                            ? theme.colors.accent
                            : theme.colors.surfaceMuted,
                          borderColor: theme.colors.background,
                          opacity: pressed ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Icon
                        name={favourite ? 'starFilled' : 'star'}
                        size={12}
                        color={favourite ? theme.colors.textOnAccent : theme.colors.textMuted}
                      />
                    </Pressable>
                  </View>
                  <Text variant="caption" align="center" numberOfLines={2}>
                    {module.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Sheet
        visible={sheetModule !== undefined}
        onClose={closeSheet}
        title={sheetModule?.name}
        subtitle={sheetModule?.short}
      >
        {sheetModule ? (
          <View>
            <ListItem
              title={t('modules.sheet.open')}
              icon="forward"
              onPress={() => {
                const id = sheetModule.id;
                closeSheet();
                router.push(`/run/${id}`);
              }}
            />
            <Divider />
            <ListItem
              title={
                isFavourite(sheetModule.id)
                  ? t('modules.sheet.removeFavourite')
                  : t('modules.sheet.addFavourite')
              }
              icon="star"
              onPress={() => {
                void toggleFavourite(sheetModule.id);
                closeSheet();
              }}
            />
            <Divider />
            <ListItem
              title={t('modules.sheet.addToHomescreen')}
              icon="home"
              subtitle={
                homescreenHintFor === sheetModule.id
                  ? t('modules.sheet.addToHomescreenHint')
                  : undefined
              }
              onPress={() => setHomescreenHintFor(sheetModule.id)}
            />
            <Divider />
            <ListItem
              title={t('modules.sheet.details')}
              icon="info"
              onPress={() => {
                const id = sheetModule.id;
                closeSheet();
                router.push(`/module/${id}`);
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  // Ein Viertel pro Kachel: vier nebeneinander, unabhaengig von der Breite.
  tile: { width: '25%', alignItems: 'center', gap: 8 },
  tileIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
