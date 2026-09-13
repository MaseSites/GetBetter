import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { contacts as contactRepo, useLiveQuery, type ContactGift, type ContactRow } from '@/db';
import { useI18n } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  EmptyState,
  HIT_TARGET,
  Header,
  Icon,
  IconButton,
  Loading,
  PlainList,
  PlainRow,
  Screen,
  SectionHeader,
  Text,
  type IconName,
} from '@/ui';

import { BirthdayEditor, type BirthdayDraft } from './BirthdayEditor';
import {
  giftYearFor,
  remindersOf,
  upcomingBirthdays,
  withBirthday,
  type UpcomingBirthday,
} from './birthdays';
import { DangerAction } from './DangerAction';
import { nextLine, reminderSummary } from './format';
import { GiftSheet, type GiftEditor } from './GiftSheet';
import { givenGifts, openGifts, setGiven } from './gifts';
import { linkHost, openableUrl } from './links';
import { AVATAR, PersonAvatar } from './PersonAvatar';
import { PersonField } from './PersonField';
import { RemindersSheet } from './RemindersSheet';
import { canShare, useBirthdayActions } from './useBirthdayActions';

/** Die runden Knoepfe unter dem Kopf. */
const ROUND_ACTION_SIZE = 56;
/** So breit darf die Beschriftung darunter werden. */
const ROUND_ACTION_WIDTH = 88;

/**
 * Eine Person als eigener Bildschirm (`/run/birthdays?person=<id>`): Countdown,
 * Aktionen, Geschenkideen, Erinnerungen, Notiz und Telefon.
 */
export function PersonScreen({
  contactId,
  startWithGift,
}: {
  contactId: string;
  startWithGift: boolean;
}) {
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

  return (
    <PersonDetail contact={contact} entry={entry} startWithGift={startWithGift} onBack={back} />
  );
}

type RoundActionItem = { id: string; icon: IconName; label: string; onPress: () => void };

function PersonDetail({
  contact,
  entry,
  startWithGift,
  onBack,
}: {
  contact: ContactRow;
  entry: UpcomingBirthday;
  startWithGift: boolean;
  onBack: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const account = useAccount();
  const actions = useBirthdayActions();

  const [editing, setEditing] = useState<BirthdayDraft | null>(null);
  const [gift, setGift] = useState<GiftEditor>(() => (startWithGift ? { mode: 'new' } : null));
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [showGiven, setShowGiven] = useState(false);

  const birthday = entry.person.birthday;
  const phone = contact.phone;
  const open = openGifts(contact.gifts);
  const given = givenGifts(contact.gifts);

  function toggle(item: ContactGift) {
    const year = typeof item.givenYear === 'number' ? null : giftYearFor(birthday);
    void contactRepo.update(contact.id, { gifts: setGiven(contact.gifts, item.id, year) });
  }

  function removeBirthday() {
    onBack();
    void actions.removeBirthday(contact.id);
  }

  const candidates: (RoundActionItem | null)[] = [
    phone
      ? {
          id: 'message',
          icon: 'mail',
          label: t('birthdays.message'),
          onPress: () => actions.message(contact.name, phone),
        }
      : null,
    phone
      ? {
          id: 'call',
          icon: 'phone',
          label: t('birthdays.call'),
          onPress: () => actions.call(phone),
        }
      : null,
    canShare
      ? {
          id: 'share',
          icon: 'sparkles',
          label: t('birthdays.shareWish'),
          onPress: () => actions.shareWish(contact.name),
        }
      : null,
  ];
  const roundActions = candidates.filter((item): item is RoundActionItem => item !== null);

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
      gap={theme.spacing.xl}
    >
      <View style={[styles.center, { gap: theme.spacing.sm }]}>
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
        <Text variant="body" tone="muted" align="center">
          {nextLine(t, language, entry)}
        </Text>
        <Countdown days={entry.days} />
      </View>

      {roundActions.length > 0 ? (
        <View style={[styles.actions, { gap: theme.spacing.lg }]}>
          {roundActions.map((item) => (
            <RoundAction key={item.id} icon={item.icon} label={item.label} onPress={item.onPress} />
          ))}
        </View>
      ) : null}

      <View>
        <SectionHeader label={t('birthdays.gifts')} first />
        <PlainList>
          {open.map((item) => (
            <GiftRow
              key={item.id}
              gift={item}
              onToggle={() => toggle(item)}
              onOpen={() => setGift({ mode: 'edit', gift: item })}
            />
          ))}
          <PlainRow
            key="add"
            leading={<Icon name="plus" size={20} color={theme.colors.accentStrong} />}
            title={t('birthdays.gifts.add')}
            titleTone="accent"
            onPress={() => setGift({ mode: 'new' })}
          />
        </PlainList>
        {given.length > 0 ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showGiven }}
              onPress={() => setShowGiven((current) => !current)}
              style={({ pressed }) => [
                styles.row,
                { minHeight: HIT_TARGET, gap: theme.spacing.xs, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text variant="overline" tone="muted">
                {t('birthdays.gifts.givenCount', { count: given.length })}
              </Text>
              <Icon
                name={showGiven ? 'down' : 'forward'}
                size={14}
                color={theme.colors.textMuted}
              />
            </Pressable>
            {showGiven ? (
              <PlainList>
                {given.map((item) => (
                  <GiftRow
                    key={item.id}
                    gift={item}
                    onToggle={() => toggle(item)}
                    onOpen={() => setGift({ mode: 'edit', gift: item })}
                  />
                ))}
              </PlainList>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <SectionHeader label={t('birthdays.reminders')} first />
        <PlainList>
          <PlainRow
            leading={<Icon name="bell" size={20} color={theme.colors.textMuted} />}
            title={reminderSummary(t, remindersOf(contact))}
            subtitle={contact.close ? t('birthdays.reminders.close') : undefined}
            onPress={() => setRemindersOpen(true)}
          />
        </PlainList>
        <Text variant="caption" tone="faint">
          {t('birthdays.reminders.pending')}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <SectionHeader label={t('birthdays.note')} first />
        <PersonField
          initial={contact.note ?? ''}
          placeholder={t('birthdays.person.notePlaceholder')}
          accessibilityLabel={t('birthdays.note')}
          multiline
          onSave={(note) => void contactRepo.update(contact.id, { note })}
        />
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <SectionHeader label={t('birthdays.phone')} first />
        <PersonField
          initial={contact.phone ?? ''}
          placeholder={t('birthdays.phonePlaceholder')}
          accessibilityLabel={t('birthdays.phone')}
          keyboardType="phone-pad"
          autoCapitalize="none"
          onSave={(value) => void contactRepo.update(contact.id, { phone: value })}
        />
      </View>

      <DangerAction label={t('birthdays.removeBirthday')} onPress={removeBirthday} />

      <BirthdayEditor draft={editing} accountId={account.id} onClose={() => setEditing(null)} />
      <GiftSheet editor={gift} contact={contact} onClose={() => setGift(null)} />
      <RemindersSheet
        visible={remindersOpen}
        contact={contact}
        onClose={() => setRemindersOpen(false)}
      />
    </Screen>
  );
}

/** Die Zahl der Tage, gross und mit gleich breiten Ziffern — am Tag selbst „Heute“. */
function Countdown({ days }: { days: number }) {
  const { t } = useI18n();

  if (days <= 1) {
    return (
      <Text variant="hero" align="center">
        {days === 0 ? t('day.today') : t('day.tomorrow')}
      </Text>
    );
  }
  return (
    <View style={styles.center}>
      <Text variant="hero" align="center">
        {days}
      </Text>
      <Text variant="label" tone="muted">
        {t('birthdays.daysUnit')}
      </Text>
    </View>
  );
}

function RoundAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roundAction,
        { gap: theme.spacing.xs, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View
        style={[
          styles.center,
          theme.elevation.card,
          {
            width: ROUND_ACTION_SIZE,
            height: ROUND_ACTION_SIZE,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Icon name={icon} size={22} />
      </View>
      <Text variant="caption" tone="muted" align="center" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Geschenkidee: Kreis zum Abhaken (heisst verschenkt), Text, Preis und Link. */
function GiftRow({
  gift,
  onToggle,
  onOpen,
}: {
  gift: ContactGift;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const isGiven = typeof gift.givenYear === 'number';
  const url = openableUrl(gift.url);
  const host = url ? linkHost(url) : null;
  const meta =
    gift.price && host
      ? t('birthdays.pair', { first: gift.price, second: host })
      : (gift.price ?? host ?? undefined);

  return (
    <PlainRow
      leading={
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isGiven }}
          accessibilityLabel={
            isGiven
              ? t('birthdays.gifts.markOpen', { text: gift.text })
              : t('birthdays.gifts.markGiven', { text: gift.text })
          }
          onPress={onToggle}
          style={[styles.center, styles.hit]}
        >
          <Icon
            name={isGiven ? 'checkCircle' : 'circle'}
            size={22}
            color={isGiven ? theme.colors.textMuted : theme.colors.textFaint}
          />
        </Pressable>
      }
      title={
        isGiven
          ? t('birthdays.gifts.givenRow', { year: gift.givenYear ?? '', text: gift.text })
          : gift.text
      }
      titleTone={isGiven ? 'muted' : 'default'}
      subtitle={meta}
      trailing={
        url ? (
          <IconButton
            icon="link"
            label={t('birthdays.gifts.openLink')}
            onPress={() => void Linking.openURL(url).catch(() => undefined)}
          />
        ) : undefined
      }
      onPress={onOpen}
    />
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
  row: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center' },
  roundAction: { width: ROUND_ACTION_WIDTH, alignItems: 'center' },
  hit: { width: HIT_TARGET, height: HIT_TARGET },
  headerLink: { minHeight: HIT_TARGET, justifyContent: 'center' },
});
