import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { households as householdRepo, useLiveQuery, MAX_HOUSEHOLDS } from '@/db';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Badge, Button, Card, EmptyState, Header, Loading, Screen, Text } from '@/ui';

export function HouseholdsScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const { account, household, switchHousehold, refreshHousehold } = useApp();

  const list = useLiveQuery(
    () => (account ? householdRepo.allOf(account.id) : Promise.resolve([])),
    [account?.id, household?.id],
  );
  const inviteList = useLiveQuery(
    () => (account ? householdRepo.invitesFor(account.id) : Promise.resolve([])),
    [account?.id],
  );

  const households = list.data ?? [];
  const invites = inviteList.data ?? [];
  const atLimit = households.length >= MAX_HOUSEHOLDS;

  if (!account) return null;

  return (
    <Screen
      header={
        <Header
          large
          title={t('households.title')}
          subtitle={t('households.count', { count: households.length, max: MAX_HOUSEHOLDS })}
        />
      }
    >
      {invites.map((invite) => (
        <Card
          key={invite.membership.id}
          title={t('householdInvite.incoming.title', {
            name: invite.household?.name ?? t('households.title'),
          })}
          subtitle={t('householdInvite.incoming.body', { name: invite.invitedByName })}
        >
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              label={t('calendars.invites.accept')}
              size="sm"
              icon="check"
              fullWidth={false}
              onPress={async () => {
                await householdRepo.respond(invite.membership.id, true);
                await refreshHousehold();
              }}
            />
            <Button
              label={t('calendars.invites.decline')}
              size="sm"
              variant="ghost"
              fullWidth={false}
              onPress={() => householdRepo.respond(invite.membership.id, false)}
            />
          </View>
        </Card>
      ))}

      {list.loading && households.length === 0 ? <Loading /> : null}

      {!list.loading && households.length === 0 && invites.length === 0 ? (
        <EmptyState title={t('household.none.title')} body={t('household.none.body')} />
      ) : null}

      {households.map((entry) => {
        const active = entry.household.id === household?.id;
        return (
          <Card
            key={entry.household.id}
            title={entry.household.name}
            subtitle={t('households.code', { code: entry.household.inviteCode })}
            onPress={() =>
              active
                ? router.push('/manage-household')
                : switchHousehold(entry.household.id).then(() => undefined)
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              {active ? (
                <Badge label={t('households.active')} tone="accent" icon="check" />
              ) : (
                <Badge label={t('households.switchTo')} />
              )}
              <Badge
                label={
                  entry.role === 'admin' ? t('household.role.admin') : t('household.role.member')
                }
              />
            </View>
          </Card>
        );
      })}

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={t('household.create.title')}
          icon="plus"
          onPress={() => router.push('/new-household')}
          disabled={atLimit}
        />
        <Button
          label={t('household.join.title')}
          icon="people"
          variant="secondary"
          onPress={() => router.push('/join-household')}
          disabled={atLimit}
        />
        {atLimit ? (
          <Text variant="caption" tone="faint">
            {t('households.error.limit', { max: MAX_HOUSEHOLDS })}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
