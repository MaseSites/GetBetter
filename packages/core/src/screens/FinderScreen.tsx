import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { APP_MODULES, currentApp } from '@/app/identity';
import { useTranslate } from '@/i18n';
import { getModule, modulesOfApp } from '@/mocks/modules';
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
 * Die Funktionen **dieser** App an einer Stelle — in GetBetter also Kalender,
 * Aufgaben, Notizen, Wecker und der Rest. Was andere Better-Apps koennen,
 * gehoert nicht hierher; dafuer stehen sie auf der Startseite.
 *
 * Oben die haeufigsten Handgriffe, darunter alles als Pille mit Logo. Das
 * Suchfeld hilft, sobald es mehr werden.
 */
export function FinderScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const app = currentApp();
  const mine = APP_MODULES[app.id];

  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  /** Nur die Funktionen dieser App. */
  const found = useMemo(
    () =>
      modulesOfApp().filter(
        (module) =>
          needle.length === 0 ||
          module.name.toLowerCase().includes(needle) ||
          module.short.toLowerCase().includes(needle),
      ),
    [needle],
  );

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
          {QUICK.filter((entry) => mine.includes(entry.module)).map((entry) => {
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

      {found.length === 0 ? (
        <Text variant="label" tone="faint">
          {t('finder.nothing', { query })}
        </Text>
      ) : null}

      <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
        {found.map((module) => {
          const tint = moduleTint(theme, module.id);
          return (
            <Pressable
              key={module.id}
              accessibilityRole="button"
              accessibilityLabel={module.name}
              onPress={() => router.push(`/run/${module.id}`)}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  quick: { minWidth: 96, alignItems: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1 },
  dot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
