import { View } from 'react-native';

import { useLiveQuery } from '@/db';
import {
  events as eventRepo,
  notes as noteRepo,
  shopping as shoppingRepo,
  tasks as taskRepo,
} from '@/db/repositories';
import { LANGUAGES, LANGUAGE_LABEL, formatShortDate, useI18n, type Language } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Avatar, Button, Card, Chip, Divider, Header, ListItem, Screen, Text } from '@/ui';

export default function ProfileScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const account = useAccount();
  const { setLanguage, signOut } = useApp();

  const openTasks = useLiveQuery(() => taskRepo.countOpen(account.id), [account.id]);
  const noteCount = useLiveQuery(() => noteRepo.count(account.id), [account.id]);
  const shoppingOpen = useLiveQuery(() => shoppingRepo.countOpen(account.id), [account.id]);
  const upcoming = useLiveQuery(
    () => eventRepo.listUpcoming(account.id, new Date().toISOString()),
    [account.id],
  );

  return (
    <Screen header={<Header title={t('profile.title')} />}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
          <Avatar name={account.firstName || account.email} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{account.firstName || t('profile.noName')}</Text>
            <Text variant="label" tone="muted">
              {account.email}
            </Text>
          </View>
        </View>
      </Card>

      <Card title={t('profile.data')} subtitle={t('profile.data.subtitle')}>
        <View>
          <ListItem
            title={t('today.appointments')}
            right={<Count value={upcoming.data?.length} />}
          />
          <Divider />
          <ListItem title={t('today.tasks')} right={<Count value={openTasks.data} />} />
          <Divider />
          <ListItem title={t('today.shopping')} right={<Count value={shoppingOpen.data} />} />
          <Divider />
          <ListItem title={t('today.notes')} right={<Count value={noteCount.data} />} />
        </View>
        <Text variant="caption" tone="faint">
          {t('profile.since', { date: formatShortDate(language, account.createdAt) })}
        </Text>
      </Card>

      {account.householdName ? (
        <Card title={t('profile.household')} subtitle={account.householdName}>
          <Text variant="label" tone="muted">
            {t('profile.household.soon')}
          </Text>
        </Card>
      ) : null}

      <Card title={t('profile.language')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {LANGUAGES.map((code: Language) => (
            <Chip
              key={code}
              label={LANGUAGE_LABEL[code]}
              selected={language === code}
              onPress={() => {
                void setLanguage(code);
              }}
            />
          ))}
        </View>
      </Card>

      <Card title={t('profile.settings')}>
        <Text variant="label" tone="muted">
          {t('auth.localHint')}
        </Text>
      </Card>

      <Button
        label={t('auth.signOut')}
        variant="secondary"
        icon="logout"
        onPress={() => {
          void signOut();
        }}
      />
    </Screen>
  );
}

function Count({ value }: { value: number | undefined }) {
  return (
    <Text variant="label" tone="muted">
      {value ?? '–'}
    </Text>
  );
}
