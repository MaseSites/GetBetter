import { StyleSheet, View } from 'react-native';

import type { HouseholdMember } from '@/db/households';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, Text, Toggle } from '@/ui';

/**
 * „Reihum“: ein Schalter, darunter die Mitglieder zum Anhaken. Die Reihenfolge
 * ist die der Mitgliederliste; eingeschaltet sind anfangs alle dabei.
 */
export function RotationPicker({
  members,
  value,
  onChange,
}: {
  members: readonly HouseholdMember[];
  value: readonly string[];
  onChange: (rotation: string[]) => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const ids = members.map((member) => member.membership.accountId);
  const on = value.length > 0;

  function toggle(accountId: string) {
    const next = value.includes(accountId)
      ? value.filter((id) => id !== accountId)
      : [...value, accountId];
    // In der Reihenfolge der Mitglieder, nicht des Anhakens.
    onChange(ids.filter((id) => next.includes(id)));
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <Text variant="body" style={{ flex: 1 }}>
          {t('familyplus.chores.rotation')}
        </Text>
        <Toggle
          value={on}
          onValueChange={(next) => onChange(next ? ids : [])}
          accessibilityLabel={t('familyplus.chores.rotation')}
        />
      </View>
      {on ? (
        <View style={[styles.chips, { gap: theme.spacing.xs }]}>
          {members.map((member) => (
            <Chip
              key={member.membership.id}
              label={member.displayName}
              selected={value.includes(member.membership.accountId)}
              onPress={() => toggle(member.membership.accountId)}
            />
          ))}
        </View>
      ) : null}
      {on && value.length < 2 ? (
        <Text variant="caption" tone="muted">
          {t('familyplus.chores.rotationPick')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
