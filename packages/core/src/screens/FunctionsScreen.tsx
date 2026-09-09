import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { currentApp } from '@/app/identity';
import { useTranslate } from '@/i18n';
import { BUILT_MODULE_IDS, modulesOfApp } from '@/mocks/modules';
import type { ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import { Header, ModuleIcon, Screen, Text } from '@/ui';

/**
 * Alle Funktionen dieser App als Logos — was gebaut ist oben, was noch kommt
 * darunter und blass. Mehr braucht die Seite nicht: kein Suchfeld fuer acht
 * Eintraege, keine zweite Startseite.
 */
export function FunctionsScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const app = currentApp();

  const mine = modulesOfApp();
  const ready = mine.filter((module) => BUILT_MODULE_IDS.includes(module.id));
  const soon = mine.filter((module) => !BUILT_MODULE_IDS.includes(module.id));

  return (
    <Screen
      header={<Header large title={t('functions.title')} subtitle={app.name} />}
      gap={theme.spacing.xl}
    >
      <Grid modules={ready} onOpen={(id) => router.push(`/run/${id}`)} />

      {soon.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="section" tone="muted">
            {t('functions.soon')}
          </Text>
          <Grid modules={soon} dim onOpen={(id) => router.push(`/module/${id}`)} />
        </View>
      ) : null}
    </Screen>
  );
}

function Grid({
  modules,
  onOpen,
  dim = false,
}: {
  modules: readonly ModuleDefinition[];
  onOpen: (id: string) => void;
  dim?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.grid, { rowGap: theme.spacing.lg }]}>
      {modules.map((module) => (
        <Pressable
          key={module.id}
          accessibilityRole="button"
          accessibilityLabel={module.name}
          onPress={() => onOpen(module.id)}
          style={({ pressed }) => [
            styles.tile,
            { gap: theme.spacing.sm, opacity: pressed ? 0.6 : dim ? 0.5 : 1 },
          ]}
        >
          <ModuleIcon moduleId={module.id} icon={module.icon} size="lg" />
          <Text variant="caption" align="center" numberOfLines={2}>
            {module.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Drei nebeneinander: die Logos duerfen gross sein.
  tile: { width: '33.3333%', alignItems: 'center' },
});
