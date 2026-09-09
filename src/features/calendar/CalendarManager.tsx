import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  calendars as calendarRepo,
  households as householdRepo,
  useLiveQuery,
  MAX_CALENDARS,
  type CalendarWithRole,
} from '@/db';
import { useTranslate } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Badge, Button, Divider, Icon, Input, ListItem, Loading, Sheet, Text } from '@/ui';

import { EVENT_COLORS, EVENT_COLOR_KEYS, colorLabelKey, type EventColorKey } from './colors';

export type CalendarManagerProps = {
  visible: boolean;
  onClose: () => void;
  calendars: readonly CalendarWithRole[];
};

/**
 * Kalender anlegen, teilen und wieder verlassen. Haushaltsmitglieder kommen
 * direkt dazu, Externe erst nach ihrer Zustimmung.
 */
export function CalendarManager({ visible, onClose, calendars }: CalendarManagerProps) {
  const t = useTranslate();
  const theme = useTheme();
  const account = useAccount();
  const { household } = useApp();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<EventColorKey>('blue');
  const [username, setUsername] = useState('');
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const memberList = useLiveQuery(
    () => (household ? householdRepo.members(household.id) : Promise.resolve([])),
    [household?.id],
  );
  const householdMembers = (memberList.data ?? []).filter(
    (entry) => entry.membership.accountId !== account.id,
  );

  const atLimit = calendars.length >= MAX_CALENDARS;

  async function create() {
    if (name.trim().length === 0) {
      setMessage(t('calendars.error.name'));
      return;
    }
    const created = await calendarRepo.create(account.id, name, color);
    if (!created) {
      setMessage(t('calendars.error.limit', { max: MAX_CALENDARS }));
      return;
    }
    setName('');
    setMessage(null);
    setCreating(false);
    setInviteFor(created.id);
  }

  async function inviteByName(calendarId: string) {
    const result = await calendarRepo.inviteByUsername(calendarId, account.id, username);
    if (!result.ok) {
      setMessage(
        result.error === 'unknown_user'
          ? t('calendars.error.unknownUser')
          : result.error === 'self'
            ? t('calendars.error.self')
            : t('calendars.error.alreadyInvited'),
      );
      return;
    }
    setUsername('');
    setMessage(t('calendars.invited'));
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('calendars.title')} fullScreen>
      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        <Text variant="label" tone="muted">
          {t('calendars.count', { count: calendars.length, max: MAX_CALENDARS })}
        </Text>

        {calendars.map((entry) => (
          <View key={entry.calendar.id} style={{ gap: theme.spacing.sm }}>
            <ListItem
              title={entry.calendar.name}
              subtitle={entry.isOwner ? t('calendars.owned') : t('calendars.shared')}
              right={
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: EVENT_COLORS[entry.calendar.color as EventColorKey] },
                  ]}
                />
              }
              onPress={() =>
                setInviteFor(inviteFor === entry.calendar.id ? null : entry.calendar.id)
              }
              showChevron
            />

            {inviteFor === entry.calendar.id ? (
              <CalendarShare
                calendarId={entry.calendar.id}
                canManage={entry.isOwner}
                householdMembers={householdMembers.map((m) => ({
                  accountId: m.membership.accountId,
                  name: m.displayName,
                }))}
                username={username}
                onUsername={(value) => {
                  setUsername(value);
                  setMessage(null);
                }}
                onInviteUsername={() => inviteByName(entry.calendar.id)}
                onInviteMember={async (accountId) => {
                  // Wer im Haushalt ist, braucht keine Zustimmung.
                  await calendarRepo.invite(entry.calendar.id, account.id, accountId, true);
                  setMessage(t('calendars.added'));
                }}
                onLeave={async () => {
                  await calendarRepo.leave(entry.calendar.id, account.id);
                  setInviteFor(null);
                }}
              />
            ) : null}
            <Divider />
          </View>
        ))}

        {creating ? (
          <View style={{ gap: theme.spacing.md }}>
            <Input
              label={t('calendars.field.name')}
              placeholder={t('calendars.field.namePlaceholder')}
              value={name}
              onChangeText={(value) => {
                setName(value);
                setMessage(null);
              }}
              autoCapitalize="words"
            />
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="label" tone="muted">
                {t('calendar.field.color')}
              </Text>
              <View style={[styles.row, { gap: theme.spacing.md, flexWrap: 'wrap' }]}>
                {EVENT_COLOR_KEYS.map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: color === key }}
                    accessibilityLabel={t(colorLabelKey(key))}
                    onPress={() => setColor(key)}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: EVENT_COLORS[key],
                        borderColor: color === key ? theme.colors.text : 'transparent',
                      },
                    ]}
                  >
                    {color === key ? <Icon name="check" size={16} color="#FFFFFF" /> : null}
                  </Pressable>
                ))}
              </View>
            </View>
            <Button label={t('calendars.create')} icon="check" onPress={create} />
            <Button label={t('common.cancel')} variant="ghost" onPress={() => setCreating(false)} />
          </View>
        ) : (
          <Button
            label={
              atLimit ? t('calendars.limitReached', { max: MAX_CALENDARS }) : t('calendars.add')
            }
            icon="plus"
            disabled={atLimit}
            onPress={() => setCreating(true)}
          />
        )}

        {message ? (
          <Text variant="caption" tone="muted">
            {message}
          </Text>
        ) : null}

        {memberList.loading ? <Loading compact /> : null}
        <View style={{ height: theme.spacing.xl }} />
      </View>
    </Sheet>
  );
}

type ShareProps = {
  calendarId: string;
  canManage: boolean;
  householdMembers: readonly { accountId: string; name: string }[];
  username: string;
  onUsername: (value: string) => void;
  onInviteUsername: () => void;
  onInviteMember: (accountId: string) => void;
  onLeave: () => void;
};

function CalendarShare({
  calendarId,
  canManage,
  householdMembers,
  username,
  onUsername,
  onInviteUsername,
  onInviteMember,
  onLeave,
}: ShareProps) {
  const t = useTranslate();
  const theme = useTheme();

  const list = useLiveQuery(() => calendarRepo.members(calendarId), [calendarId]);
  const members = list.data ?? [];

  return (
    <View
      style={{
        gap: theme.spacing.md,
        paddingLeft: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
      }}
    >
      <Text variant="label" tone="muted">
        {t('calendars.members')}
      </Text>
      {members.map((member) => (
        <View key={member.membership.id} style={[styles.row, { gap: theme.spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text variant="label">{member.displayName}</Text>
            {member.account ? (
              <Text variant="caption" tone="faint">
                @{member.account.username}
              </Text>
            ) : null}
          </View>
          <Badge
            label={
              member.membership.role === 'owner'
                ? t('calendars.role.owner')
                : member.membership.status === 'pending'
                  ? t('calendars.pending')
                  : t('calendars.role.member')
            }
            tone={member.membership.status === 'pending' ? 'neutral' : 'accent'}
          />
        </View>
      ))}

      {canManage ? (
        <>
          {householdMembers.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="caption" tone="faint">
                {t('calendars.fromHousehold')}
              </Text>
              <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
                {householdMembers.map((member) => (
                  <Button
                    key={member.accountId}
                    label={member.name}
                    size="sm"
                    variant="secondary"
                    fullWidth={false}
                    icon="plus"
                    onPress={() => onInviteMember(member.accountId)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Input
            label={t('calendars.field.username')}
            placeholder={t('calendars.field.usernamePlaceholder')}
            value={username}
            onChangeText={onUsername}
            autoCapitalize="none"
            hint={t('calendars.externalHint')}
          />
          <Button
            label={t('calendars.invite')}
            size="sm"
            variant="secondary"
            icon="people"
            onPress={onInviteUsername}
          />
        </>
      ) : null}

      <Button
        label={canManage ? t('calendars.delete') : t('calendars.leave')}
        size="sm"
        variant="danger"
        icon="trash"
        onPress={onLeave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
