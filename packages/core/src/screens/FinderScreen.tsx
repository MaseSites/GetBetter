import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { appUrl } from '@/app/bridge';
import { APPS, APP_IDS, APP_MODULES, currentApp, type AppId } from '@/app/identity';
import { useTranslate } from '@/i18n';
import { getModule } from '@/mocks/modules';
import type { ModuleDefinition } from '@/mocks/types';
import { moduleTint, useTheme } from '@/theme';
import { Header, Icon, Input, Screen, Text } from '@/ui';

/** Was man am haeufigsten will, ohne erst zu suchen. */
const QUICK: readonly {
  module: string;
  labelKey: 'finder.newEvent' | 'finder.newTask' | 'finder.newNote' | 'finder.newAlarm';
}[] = [
  { module: 'calendar', labelKey: 'finder.newEvent' },
  { module: 'tasks', labelKey: 'finder.newTask' },
  { module: 'notes', labelKey: 'finder.newNote' },
  { module: 'alarm', labelKey: 'finder.newAlarm' },
];

/**
 * Alles finden — quer ueber alle Better-Apps, vom Wecker bis zum Kalender.
 *
 * Kein Kachelbrett und keine Liste zum Durchscrollen: oben tippt man drauflos,
 * darunter stehen die haeufigsten Handgriffe, und der Rest ist nach App
 * geordnet. Was einer anderen App gehoert, oeffnet sie.
 */
export function FinderScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const me = currentApp().id;

  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  /** Alle Funktionen aller Apps, nach App geordnet. */
  const groups = useMemo(() => {
    return APP_IDS.map((id) => ({
      app: id,
      modules: APP_MODULES[id]
        .map((moduleId) => getModule(moduleId))
        .filter((module): module is ModuleDefinition => module !== undefined)
        .filter(
          (module) =>
            needle.length === 0 ||
            module.name.toLowerCase().includes(needle) ||
            module.short.toLowerCase().includes(needle),
        ),
    })).filter((group) => group.modules.length > 0);
  }, [needle]);

  function open(app: AppId, moduleId: string) {
    if (app === me) {
      router.push(`/run/${moduleId}`);
      return;
    }
    // Fremde Funktion: die App aufmachen, die sie fuehrt.
    void Linking.openURL(appUrl(app));
  }

  return (
    <Screen header={<Header large title={t('finder.title')} subtitle={t('finder.subtitle')} />}>
      <Input
        placeholder={t('finder.placeholder')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        accessibilityLabel={t('finder.placeholder')}
      />

      {needle.length === 0 ? (
        <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
          {QUICK.filter((entry) => APP_MODULES[me].includes(entry.module)).map((entry) => {
            const module = getModule(entry.module);
            const tint = moduleTint(theme, entry.module);
            if (!module) return null;
            return (
              <Pressable
                key={entry.module}
                accessibilityRole="button"
                accessibilityLabel={t(entry.labelKey)}
                onPress={() => router.push(`/run/${entry.module}`)}
                style={({ pressed }) => [
                  styles.quick,
                  {
                    borderRadius: theme.radii.lg,
                    backgroundColor: tint.background,
                    padding: theme.spacing.md,
                    gap: theme.spacing.xs,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Icon name={module.icon} size={20} color={tint.foreground} />
                <Text variant="caption" style={{ color: tint.foreground }}>
                  {t(entry.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {groups.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('finder.nothing', { query })}
        </Text>
      ) : null}

      {groups.map((group) => (
        <View key={group.app} style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {APPS[group.app].name}
            {group.app === me ? '' : ` · ${t('finder.otherApp')}`}
          </Text>
          <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
            {group.modules.map((module) => {
              const tint = moduleTint(theme, module.id);
              return (
                <Pressable
                  key={module.id}
                  accessibilityRole="button"
                  accessibilityLabel={module.name}
                  onPress={() => open(group.app, module.id)}
                  style={({ pressed }) => [
                    styles.pill,
                    {
                      borderRadius: theme.radii.pill,
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      paddingHorizontal: theme.spacing.md,
                      gap: theme.spacing.sm,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: tint.background, borderRadius: theme.radii.sm },
                    ]}
                  >
                    <Icon name={module.icon} size={14} color={tint.foreground} />
                  </View>
                  <Text variant="label">{module.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  quick: { minWidth: 96, alignItems: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1 },
  dot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
