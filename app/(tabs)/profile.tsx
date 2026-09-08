import { View } from 'react-native';

import {
  LANGUAGES,
  LANGUAGE_LABEL,
  formatShortDate,
  useI18n,
  type Language,
  type TranslationKey,
} from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Avatar, Badge, Button, Card, Chip, Divider, Header, ListItem, Screen, Text } from '@/ui';

export default function ProfileScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { state, setLanguage, signOut } = useApp();

  const { person, household } = state;

  return (
    <Screen header={<Header title={t('profile.title')} />}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
          <Avatar name={person.firstName} imageUri={person.imageUri} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{person.firstName}</Text>
            <Text variant="label" tone="muted">
              {person.email}
            </Text>
          </View>
        </View>
      </Card>

      <Card title={t('profile.household')} subtitle={household?.name}>
        {household ? (
          <View>
            {household.members.map((member, index) => (
              <View key={member.id}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={member.name}
                  right={<Badge label={t(`role.${member.role}` as TranslationKey)} />}
                />
              </View>
            ))}
            <View style={{ paddingTop: theme.spacing.sm }}>
              <Text variant="caption" tone="faint">
                {t('profile.household.members', { count: household.members.length })}
              </Text>
            </View>
          </View>
        ) : (
          <Text variant="label" tone="muted">
            {t('profile.household.none')}
          </Text>
        )}
      </Card>

      <Card title={t('profile.subscription')} subtitle={person.subscriptionPlan}>
        <Text variant="label" tone="muted">
          {t('profile.subscription.renews', {
            date: formatShortDate(language, person.subscriptionRenewsAt),
          })}
        </Text>
        <Button
          label={t('profile.subscription.manage')}
          variant="secondary"
          size="sm"
          fullWidth={false}
          onPress={() => undefined}
          disabled
        />
      </Card>

      <Card title={t('profile.language')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {LANGUAGES.map((code: Language) => (
            <Chip
              key={code}
              label={LANGUAGE_LABEL[code]}
              selected={language === code}
              onPress={() => setLanguage(code)}
            />
          ))}
        </View>
      </Card>

      <Card title={t('profile.settings')}>
        <View>
          <ListItem title={t('profile.settings.notifications')} icon="bell" showChevron disabled />
          <Divider />
          <ListItem title={t('profile.settings.privacy')} icon="shield" showChevron disabled />
          <Divider />
          <ListItem title={t('profile.settings.about')} icon="info" showChevron disabled />
        </View>
        <Text variant="caption" tone="faint">
          {t('profile.prototypeHint')}
        </Text>
      </Card>

      <Button label={t('auth.signOut')} variant="secondary" icon="logout" onPress={signOut} />
    </Screen>
  );
}
