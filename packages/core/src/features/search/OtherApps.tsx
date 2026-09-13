import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { APP_IDS, APP_MODULES, APPS, type AppId } from '@/app/identity';
import { useI18n, type Translate } from '@/i18n';
import { BUILT_MODULE_IDS, MODULES } from '@/mocks/modules';
import { moduleName } from '@/mocks/moduleText';
import type { ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import { AppIcon, Icon, PlainList, PlainRow, Text } from '@/ui';
import { HIT_TARGET } from '@/ui/layout';

import { foldText } from './results';

/** So blass stehen Funktionen, die man von hier aus nicht oeffnen kann. */
const DIMMED = 0.45;

type OtherApp = { id: AppId; modules: readonly ModuleDefinition[] };

/** Je andere App ihre gebauten Funktionen, gefiltert nach der Suche. */
function otherAppModules(t: Translate, current: AppId, query: string): readonly OtherApp[] {
  const needle = foldText(query.trim());
  return APP_IDS.filter((id) => id !== current).flatMap((id) => {
    const modules = (APP_MODULES[id] ?? []).flatMap((moduleId) => {
      if (!BUILT_MODULE_IDS.includes(moduleId)) return [];
      const module = MODULES.find((entry) => entry.id === moduleId);
      if (!module) return [];
      const hit = needle.length === 0 || foldText(moduleName(t, module.id)).includes(needle);
      return hit ? [module] : [];
    });
    return modules.length === 0 ? [] : [{ id, modules }];
  });
}

/**
 * „Andere Better-Apps“ ganz unten in der Suche — einmal, zugeklappt. Ein Tipp
 * klappt ihre Funktionen auf; sie bleiben blass und nicht tippbar: es zeigt,
 * wo etwas liegt, ohne so zu tun, als liesse es sich von hier oeffnen.
 */
export function OtherAppsSection({ current, query }: { current: AppId; query: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const apps = otherAppModules(t, current, query);
  if (apps.length === 0) return null;

  const label = t('search.otherApps');

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          styles.toggle,
          { minHeight: HIT_TARGET, gap: theme.spacing.sm, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text variant="overline" tone="muted" numberOfLines={1} style={styles.grow}>
          {label}
        </Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="forward" size={16} color={theme.colors.textFaint} />
        </View>
      </Pressable>

      {open
        ? apps.map((app) => (
            <View key={app.id} style={{ paddingTop: theme.spacing.md, gap: theme.spacing.xs }}>
              <View style={[styles.head, { gap: theme.spacing.sm }]}>
                <AppIcon appId={app.id} size="sm" />
                {/* Ein Name, keine Ueberschrift in Grossbuchstaben: „BETTERFAMILY“ liest sich falsch. */}
                <Text variant="title" numberOfLines={1}>
                  {APPS[app.id].name}
                </Text>
              </View>
              <PlainList style={{ opacity: DIMMED }}>
                {app.modules.map((module) => (
                  <PlainRow
                    key={module.id}
                    title={moduleName(t, module.id)}
                    leading={<Icon name={module.icon} size={18} color={theme.colors.textMuted} />}
                  />
                ))}
              </PlainList>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center' },
});
