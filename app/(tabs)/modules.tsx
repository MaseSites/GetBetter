import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { UninstallDialog } from '@/features/modules/UninstallDialog';
import { useTranslate } from '@/i18n';
import { getModule } from '@/mocks/modules';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Divider, EmptyState, Header, Icon, ListItem, Screen, Sheet, Text } from '@/ui';

export default function MyModulesScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { state } = useApp();

  const [sheetModuleId, setSheetModuleId] = useState<string | null>(null);
  const [homescreenHintFor, setHomescreenHintFor] = useState<string | null>(null);
  const [uninstallId, setUninstallId] = useState<string | null>(null);

  const modules = useMemo(
    () => state.installedModuleIds.map(getModule).filter((module) => module !== undefined),
    [state.installedModuleIds],
  );

  const sheetModule = sheetModuleId ? getModule(sheetModuleId) : undefined;

  function closeSheet() {
    setSheetModuleId(null);
    setHomescreenHintFor(null);
  }

  return (
    <Screen
      header={
        <Header
          title={t('modules.title')}
          subtitle={t('modules.count', { count: modules.length })}
        />
      }
    >
      {modules.length === 0 ? (
        <EmptyState
          icon="grid"
          title={t('modules.empty.title')}
          body={t('modules.empty.body')}
          actionLabel={t('modules.empty.action')}
          onAction={() => router.push('/discover')}
        />
      ) : (
        <View style={[styles.grid, { gap: theme.spacing.lg }]}>
          {modules.map((module) => (
            <Pressable
              key={module.id}
              accessibilityRole="button"
              accessibilityLabel={module.name}
              accessibilityHint={t('modules.sheet.uninstall')}
              onPress={() => router.push(`/run/${module.id}`)}
              onLongPress={() => setSheetModuleId(module.id)}
              delayLongPress={350}
              style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View
                style={[
                  styles.tileIcon,
                  {
                    borderRadius: theme.radii.lg,
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Icon name={module.icon} size={26} color={theme.colors.accentStrong} />
              </View>
              <Text variant="caption" align="center" numberOfLines={2}>
                {module.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

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
            <Divider />
            <View style={{ paddingTop: theme.spacing.lg }}>
              <Button
                label={t('modules.sheet.uninstall')}
                variant="danger"
                icon="trash"
                onPress={() => {
                  const id = sheetModule.id;
                  closeSheet();
                  setUninstallId(id);
                }}
              />
            </View>
          </View>
        ) : null}
      </Sheet>

      <UninstallDialog moduleId={uninstallId} onClose={() => setUninstallId(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: 76, alignItems: 'center', gap: 8 },
  tileIcon: {
    width: 64,
    height: 64,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
