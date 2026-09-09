import * as Linking from 'expo-linking';
import { View } from 'react-native';

import { appUrl } from '@/app/bridge';
import { APPS, APP_IDS, APP_MODULES, currentApp, type AppId } from '@/app/identity';
import { appAccess, useLiveQuery } from '@/db';
import {
  chores as choreRepo,
  events as eventRepo,
  shopping as shoppingRepo,
} from '@/db/repositories';
import { useCalendarAccess } from '@/features/calendar/useCalendarAccess';
import { formatTime, useI18n, type TranslationKey } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { moduleTint, useTheme } from '@/theme';
import { Card, Icon, Text } from '@/ui';

/**
 * Die anderen Better-Apps auf der Startseite von GetBetter.
 *
 * Wo man sich noch nie angemeldet hat, steht die App blass da und sagt in
 * einem Satz, wofuer sie gut ist. Wo man drin war, steht kein Werbetext mehr,
 * sondern was gerade ansteht — moeglich, weil alle dieselbe Datenbank teilen.
 */
export function AppFamily() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { account, household } = useApp();
  const { access } = useCalendarAccess();
  const me = currentApp().id;
  const others = APP_IDS.filter((id) => id !== me);
  const householdId = household?.id ?? null;

  const unlockedList = useLiveQuery(
    () => (account ? appAccess.appsOf(account.id) : Promise.resolve([])),
    [account?.id],
  );
  const unlocked = unlockedList.data ?? [];

  const shoppingOpen = useLiveQuery(
    () => (account ? shoppingRepo.countOpen(account.id, householdId) : Promise.resolve(0)),
    [account?.id, householdId],
  );
  const choreList = useLiveQuery(
    () => (householdId ? choreRepo.list(householdId) : Promise.resolve([])),
    [householdId],
  );
  const familyNext = useLiveQuery(
    () =>
      access.householdIds.length > 0
        ? eventRepo.listBetween(
            access,
            new Date().toISOString(),
            new Date(Date.now() + 14 * 86_400_000).toISOString(),
            access.householdIds.map((id) => `house:${id}` as const),
          )
        : Promise.resolve([]),
    [access.accountId, access.householdIds],
  );

  /** Was in einer freigeschalteten App gerade ansteht. */
  function figures(id: AppId): string[] {
    if (id !== 'betterfamily') return [];
    const lines: string[] = [];
    const next = familyNext.data?.[0];
    if (next) {
      lines.push(
        t('family.next', { title: next.title, time: formatTime(language, next.startsAt) }),
      );
    }
    const open = shoppingOpen.data ?? 0;
    if (open > 0) lines.push(t('family.shopping', { count: open }));
    const jobs = choreList.data?.length ?? 0;
    if (jobs > 0) lines.push(t('family.chores', { count: jobs }));
    return lines;
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text variant="section" tone="muted">
        {t('family.title')}
      </Text>

      {others.map((id) => {
        const app = APPS[id];
        const open = unlocked.includes(id);
        const first = APP_MODULES[id][0];
        const tint = moduleTint(theme, first ?? '');
        const lines = open ? figures(id) : [];

        return (
          <Card
            key={id}
            title={app.name}
            // Wer die App noch nicht kennt, bekommt den Satz dazu.
            {...(open ? {} : { subtitle: t(app.taglineKey as TranslationKey) })}
            onPress={() => void Linking.openURL(appUrl(id))}
            style={open ? undefined : { opacity: 0.55 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radii.md,
                  backgroundColor: open ? tint.background : theme.colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  name={app.icon as 'grid'}
                  size={22}
                  color={open ? tint.foreground : theme.colors.textFaint}
                />
              </View>

              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                {open ? (
                  lines.length > 0 ? (
                    lines.map((line) => (
                      <Text key={line} variant="label">
                        {line}
                      </Text>
                    ))
                  ) : (
                    <Text variant="caption" tone="faint">
                      {t('family.quiet')}
                    </Text>
                  )
                ) : (
                  <Text variant="caption" tone="faint">
                    {t('family.locked')}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}
