import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { appUrl, isInstalled } from '@/app/bridge';
import { APPS, APP_IDS, APP_MODULES, currentApp, type AppId } from '@/app/identity';
import { useLiveQuery } from '@/db';
import { chores as choreRepo, shopping as shoppingRepo } from '@/db/repositories';
import { useTranslate, type TranslationKey } from '@/i18n';
import { getModule } from '@/mocks/modules';
import { useApp } from '@/state/AppContext';
import { moduleTint, useTheme } from '@/theme';
import { Badge, Card, Icon, Text } from '@/ui';

/**
 * Die anderen Better-Apps auf der Startseite von GetBetter. Sie sind eigene
 * Programme, teilen sich aber die Datenbank — deshalb stehen hier auch die
 * Zahlen aus ihnen, nicht nur ihre Namen.
 */
export function AppFamily() {
  const t = useTranslate();
  const theme = useTheme();
  const me = currentApp().id;
  const { account, household } = useApp();
  const householdId = household?.id ?? null;

  const shoppingOpen = useLiveQuery(
    () => (account ? shoppingRepo.countOpen(account.id, householdId) : Promise.resolve(0)),
    [account?.id, householdId],
  );
  const choresOpen = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])).then((r) => r.length),
    [householdId],
  );
  const others = APP_IDS.filter((id) => id !== me);

  const [installed, setInstalled] = useState<Readonly<Partial<Record<AppId, boolean>>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found: Partial<Record<AppId, boolean>> = {};
      for (const id of others) {
        const yes = await isInstalled(id);
        if (yes !== undefined) found[id] = yes;
      }
      if (!cancelled) setInstalled(found);
    })();
    return () => {
      cancelled = true;
    };
    // Die Liste der Geschwister-Apps steht fest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Was gerade offen ist — dieselbe Datenbank, also echte Zahlen. */
  function figure(id: AppId): string | null {
    if (id !== 'betterfamily') return null;
    const open = shoppingOpen.data ?? 0;
    const jobs = choresOpen.data ?? 0;
    if (open === 0 && jobs === 0) return null;
    return t('family.figures', { items: open, chores: jobs });
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text variant="section" tone="muted">
        {t('family.title')}
      </Text>

      {others.map((id) => {
        const app = APPS[id];
        const first = APP_MODULES[id][0];
        const tint = moduleTint(theme, first ?? '');
        const here = installed[id];

        return (
          <Card
            key={id}
            title={app.name}
            subtitle={t(app.taglineKey as TranslationKey)}
            onPress={() => void Linking.openURL(appUrl(id))}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radii.md,
                  backgroundColor: tint.background,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={app.icon as 'grid'} size={22} color={tint.foreground} />
              </View>
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
                  {APP_MODULES[id].slice(0, 3).map((moduleId) => {
                    const module = getModule(moduleId);
                    return module ? <Badge key={moduleId} label={module.name} /> : null;
                  })}
                </View>
                <Text variant="caption" tone="faint">
                  {figure(id) ??
                    (here === false
                      ? t('family.missing')
                      : Platform.OS === 'web'
                        ? t('family.web')
                        : t('family.installed'))}
                </Text>
              </View>
            </View>
          </Card>
        );
      })}

      <Text variant="caption" tone="faint">
        {t('family.hint')}
      </Text>
    </View>
  );
}
