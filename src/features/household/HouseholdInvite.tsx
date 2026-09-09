import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { households as householdRepo, type HouseholdRow } from '@/db';
import { useTranslate } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Icon, Input, Text } from '@/ui';

export type HouseholdInviteProps = {
  household: HouseholdRow;
};

/** Der Link fuehrt direkt auf den Beitreten-Bildschirm mit gefuelltem Code. */
export function inviteLinkFor(code: string): string {
  return Linking.createURL('/join-household', { queryParams: { code } });
}

/**
 * Drei Wege, jemanden dazuzuholen: Link teilen, per Benutzername einladen
 * (die Person stimmt dann zu), oder den Code vorlesen.
 */
export function HouseholdInvite({ household }: HouseholdInviteProps) {
  const t = useTranslate();
  const theme = useTheme();
  const account = useAccount();

  const [username, setUsername] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = inviteLinkFor(household.inviteCode);

  async function copyLink() {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setMessage(t('householdInvite.copied'));
  }

  async function shareLink() {
    // Auf Web gibt es kein Share-Blatt; dort bleibt Kopieren der Weg.
    if (Platform.OS === 'web') {
      await copyLink();
      return;
    }
    await Share.share({ message: t('householdInvite.shareText', { name: household.name, link }) });
  }

  async function invite() {
    const result = await householdRepo.inviteByUsername(household.id, account.id, username);
    if (!result.ok) {
      setMessage(
        result.error === 'unknown_user'
          ? t('householdInvite.error.unknownUser')
          : result.error === 'self'
            ? t('householdInvite.error.self')
            : result.error === 'limit'
              ? t('householdInvite.error.limit')
              : t('householdInvite.error.alreadyMember'),
      );
      return;
    }
    setUsername('');
    setMessage(t('householdInvite.sent'));
  }

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card title={t('householdInvite.link.title')} subtitle={t('householdInvite.link.body')}>
        <View
          style={[
            styles.linkBox,
            { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.md },
          ]}
        >
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {link}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            label={copied ? t('householdInvite.copiedShort') : t('householdInvite.copy')}
            icon={copied ? 'check' : 'doc'}
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={copyLink}
          />
          {Platform.OS === 'web' ? null : (
            <Button
              label={t('householdInvite.share')}
              icon="send"
              size="sm"
              variant="secondary"
              fullWidth={false}
              onPress={shareLink}
            />
          )}
        </View>
      </Card>

      <Card
        title={t('householdInvite.username.title')}
        subtitle={t('householdInvite.username.body')}
      >
        <Input
          label={t('calendars.field.username')}
          placeholder={t('calendars.field.usernamePlaceholder')}
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setMessage(null);
          }}
          autoCapitalize="none"
        />
        <Button
          label={t('householdInvite.invite')}
          icon="people"
          variant="secondary"
          onPress={invite}
        />
      </Card>

      <Card title={t('household.invite.title')} subtitle={t('householdInvite.code.body')}>
        <View
          style={[
            styles.code,
            {
              backgroundColor: theme.colors.accentSoft,
              borderRadius: theme.radii.md,
              paddingVertical: theme.spacing.md,
            },
          ]}
        >
          <Text variant="display" align="center" style={{ letterSpacing: 6 }}>
            {household.inviteCode}
          </Text>
        </View>
      </Card>

      {message ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
          <Icon name="info" size={16} color={theme.colors.textFaint} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">
              {message}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  linkBox: { padding: 10 },
  code: { alignItems: 'center' },
});
