import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { contacts as contactRepo, useLiveQuery, type ContactRow } from '@/db';
import { useI18n } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { EmptyState, HIT_TARGET, Header, Loading, Screen, Text } from '@/ui';

import { BirthdayEditor, type BirthdayDraft } from './BirthdayEditor';
import { upcomingBirthdays, withBirthday, type UpcomingBirthday } from './birthdays';
import { nextLine } from './format';
import { AVATAR, PersonAvatar } from './PersonAvatar';

/**
 * Eine Person als eigener Bildschirm (`/run/birthdays?person=<id>`) — kurz und
 * übersichtlich: wer, wann und, wo das Jahr bekannt ist, wie alt. Datum ändern
 * und den Geburtstag entfernen liegt hinter „Bearbeiten“.
 */
export function PersonScreen({ contactId }: { contactId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const found = useLiveQuery(() => contactRepo.find(contactId), [contactId]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/run/birthdays'));
  const contact = found.data;
  const entry = contact ? upcomingBirthdays(withBirthday([contact]))[0] : undefined;

  if (!contact || !entry) {
    return (
      <Screen header={<Header showBack onBack={back} />} scroll={false}>
        {found.loading ? (
          <Loading />
        ) : (
          <EmptyState
            title={t('birthdays.person.goneTitle')}
            body={t('birthdays.person.goneBody')}
            actionLabel={t('common.back')}
            onAction={back}
          />
        )}
      </Screen>
    );
  }

  return <PersonDetail contact={contact} entry={entry} onBack={back} />;
}

function PersonDetail({
  contact,
  entry,
  onBack,
}: {
  contact: ContactRow;
  entry: UpcomingBirthday;
  onBack: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const account = useAccount();
  const [editing, setEditing] = useState<BirthdayDraft | null>(null);

  return (
    <Screen
      header={
        <Header
          showBack
          onBack={onBack}
          right={
            <HeaderLink label={t('birthdays.editAction')} onPress={() => setEditing({ contact })} />
          }
        />
      }
    >
      <View style={[styles.center, { gap: theme.spacing.sm, paddingTop: theme.spacing.xl }]}>
        <PersonAvatar
          name={contact.name}
          photoUploadId={contact.photoUploadId}
          size={AVATAR.detail}
        />
        <Text
          align="center"
          numberOfLines={2}
          style={{
            marginTop: theme.spacing.sm,
            fontFamily: theme.fontFamilyDisplay,
            fontSize: theme.fontSize.xl,
            lineHeight: theme.lineHeight.xl,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {contact.name}
        </Text>
        {/* „wird 45 am Samstag, 19. September“ — ohne Jahr nur das Datum. */}
        <Text variant="body" tone="muted" align="center">
          {nextLine(t, language, entry)}
        </Text>
        <Countdown days={entry.days} />
      </View>

      <BirthdayEditor draft={editing} accountId={account.id} onClose={() => setEditing(null)} />
    </Screen>
  );
}

/** Die Zahl der Tage, gross und mit gleich breiten Ziffern — am Tag selbst „Heute“. */
function Countdown({ days }: { days: number }) {
  const { t } = useI18n();
  const theme = useTheme();

  if (days <= 1) {
    return (
      <Text variant="hero" align="center" style={{ marginTop: theme.spacing.lg }}>
        {days === 0 ? t('day.today') : t('day.tomorrow')}
      </Text>
    );
  }
  return (
    <View style={[styles.center, { marginTop: theme.spacing.lg }]}>
      <Text variant="hero" align="center">
        {days}
      </Text>
      <Text variant="label" tone="muted">
        {t('birthdays.daysUnit')}
      </Text>
    </View>
  );
}

/** „Bearbeiten“ oben rechts. */
function HeaderLink({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={theme.spacing.sm}
      style={({ pressed }) => [styles.headerLink, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Text variant="body" style={{ fontWeight: theme.fontWeight.semibold }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  headerLink: { minHeight: HIT_TARGET, justifyContent: 'center' },
});
