import { StyleSheet, View } from 'react-native';

import type { ContactRow } from '@/db';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import {
  ContextMenu,
  HIT_TARGET,
  SwipeRow,
  Text,
  type MenuEntry,
  type MenuItem,
  type SwipeAction,
} from '@/ui';

import type { UpcomingBirthday } from './birthdays';
import { compactLine, weekLine } from './format';
import { AVATAR, PersonAvatar } from './PersonAvatar';
import { canMessage, useBirthdayActions } from './useBirthdayActions';

/** Je naeher, desto groesser: diese Woche 72 hoch, der Rest 56. */
export const WEEK_ROW_HEIGHT = 72;
export const COMPACT_ROW_HEIGHT = 56;

export type BirthdayRowProps = {
  entry: UpcomingBirthday;
  contact: ContactRow | undefined;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

/** Langer Druck: Nachricht, Anrufen, Bearbeiten, Geburtstag entfernen. */
function useRowMenu({ entry, contact, onEdit, onRemove }: BirthdayRowProps) {
  const { t } = useI18n();
  const actions = useBirthdayActions();
  const phone = contact?.phone ?? null;
  const name = entry.person.name;

  const message: MenuItem | null = canMessage(phone)
    ? {
        key: 'message',
        label: t('birthdays.message'),
        icon: 'mail',
        onPress: () => actions.message(name, phone),
      }
    : null;
  const call: MenuItem | null = phone
    ? { key: 'call', label: t('birthdays.call'), icon: 'phone', onPress: () => actions.call(phone) }
    : null;
  const entries: (MenuEntry | null)[] = [
    message,
    call,
    { key: 'edit', label: t('birthdays.editAction'), icon: 'note', onPress: onEdit },
    { key: 'divider', divider: true },
    {
      key: 'remove',
      label: t('birthdays.removeBirthday'),
      icon: 'trash',
      destructive: true,
      onPress: onRemove,
    },
  ];
  return entries.filter((item): item is MenuEntry => item !== null);
}

/** Wisch nach links: halb und ganz „Geburtstag entfernen“ — nur der Geburtstag, nie der Kontakt. */
function useRemoveAction(onRemove: () => void): SwipeAction {
  const { t } = useI18n();
  return {
    key: 'removeBirthday',
    label: t('birthdays.removeBirthday'),
    icon: 'trash',
    tone: 'danger',
    onPress: onRemove,
  };
}

/** Diese Woche: Bild 48, Name, „wird 36 · Sa., 20. Sept.“; rechts die Tage. */
export function WeekRow(props: BirthdayRowProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const menu = useRowMenu(props);
  const remove = useRemoveAction(props.onRemove);
  const { entry, contact } = props;

  const line = weekLine(t, language, entry);
  const when = entry.days === 1 ? t('day.tomorrow') : t('birthdays.inDays', { days: entry.days });

  return (
    <SwipeRow trailing={[remove]} trailingFull={remove} backgroundColor={theme.colors.background}>
      <ContextMenu
        items={menu}
        onPress={props.onOpen}
        accessibilityLabel={[entry.person.name, line, when].join(', ')}
        style={[
          styles.row,
          { minHeight: WEEK_ROW_HEIGHT, gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
        ]}
      >
        <PersonAvatar
          name={entry.person.name}
          photoUploadId={contact?.photoUploadId}
          size={AVATAR.week}
        />
        <View style={styles.text}>
          <Text variant="body" numberOfLines={1} style={{ fontWeight: theme.fontWeight.semibold }}>
            {entry.person.name}
          </Text>
          <Text variant="label" tone="muted" numberOfLines={1}>
            {line}
          </Text>
        </View>
        {entry.days === 1 ? (
          <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t('day.tomorrow')}
          </Text>
        ) : (
          <View style={styles.count}>
            <Text variant="title">{entry.days}</Text>
            <Text variant="caption" tone="muted">
              {t('birthdays.daysUnit')}
            </Text>
          </View>
        )}
      </ContextMenu>
    </SwipeRow>
  );
}

/** Dieser Monat und Später: Bild 40, Name, „20. Okt. · wird 41“; rechts „in 37 Tagen“. */
export function CompactRow(props: BirthdayRowProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const menu = useRowMenu(props);
  const remove = useRemoveAction(props.onRemove);
  const { entry, contact } = props;

  const line = compactLine(t, language, entry);
  const when = t('birthdays.inDays', { days: entry.days });

  return (
    <SwipeRow trailing={[remove]} trailingFull={remove} backgroundColor={theme.colors.background}>
      <ContextMenu
        items={menu}
        onPress={props.onOpen}
        accessibilityLabel={[entry.person.name, line, when].join(', ')}
        style={[
          styles.row,
          {
            minHeight: COMPACT_ROW_HEIGHT,
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
          },
        ]}
      >
        <PersonAvatar
          name={entry.person.name}
          photoUploadId={contact?.photoUploadId}
          size={AVATAR.compact}
        />
        <View style={styles.text}>
          <Text variant="body" numberOfLines={1}>
            {entry.person.name}
          </Text>
          <Text variant="label" tone="muted" numberOfLines={1}>
            {line}
          </Text>
        </View>
        <Text variant="label" tone="muted">
          {when}
        </Text>
      </ContextMenu>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  count: { alignItems: 'center', minWidth: HIT_TARGET },
});
