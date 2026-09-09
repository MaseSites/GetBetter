import { Pressable, StyleSheet, View } from 'react-native';

import type { CalendarWithRole, HouseholdMember } from '@/db';
import type { CalendarSource } from '@/db/repositories';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Divider, Icon, Segmented, Sheet, Text } from '@/ui';

import { EVENT_COLORS, type EventColorKey } from './colors';

export type CalendarMode = 'day' | 'week' | 'month';

export type PickerEntry = {
  source: CalendarSource;
  label: string;
  /** Farbpunkt vor dem Namen, wo einer sinnvoll ist. */
  color?: string;
};

export type CalendarPickerProps = {
  visible: boolean;
  onClose: () => void;
  mode: CalendarMode;
  onMode: (mode: CalendarMode) => void;
  entries: readonly PickerEntry[];
  selected: readonly CalendarSource[];
  onToggle: (source: CalendarSource) => void;
  onAll: (all: boolean) => void;
  onManage: () => void;
};

/**
 * Das aufklappbare Menue: oben die Ansicht, darunter die Kalender mit
 * Haekchen. Angezeigt wird alles, was angehakt ist.
 */
export function CalendarPicker({
  visible,
  onClose,
  mode,
  onMode,
  entries,
  selected,
  onToggle,
  onAll,
  onManage,
}: CalendarPickerProps) {
  const t = useTranslate();
  const theme = useTheme();

  const allOn = entries.length > 0 && entries.every((entry) => selected.includes(entry.source));

  return (
    <Sheet visible={visible} onClose={onClose} title={t('calendar.picker.title')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('calendar.view')}
          </Text>
          <Segmented
            accessibilityLabel={t('calendar.view')}
            value={mode}
            onChange={onMode}
            options={[
              { value: 'day', label: t('calendar.view.day') },
              { value: 'week', label: t('calendar.view.week') },
              { value: 'month', label: t('calendar.view.month') },
            ]}
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {t('calendar.picker.calendars')}
          </Text>

          <CheckRow
            label={t('calendar.picker.all')}
            checked={allOn}
            onPress={() => onAll(!allOn)}
          />
          <Divider />

          {entries.map((entry) => (
            <CheckRow
              key={entry.source}
              label={entry.label}
              color={entry.color}
              checked={selected.includes(entry.source)}
              onPress={() => onToggle(entry.source)}
            />
          ))}
        </View>

        <Button
          label={t('calendars.manage')}
          icon="settings"
          variant="secondary"
          onPress={onManage}
        />
      </View>
    </Sheet>
  );
}

function CheckRow({
  label,
  color,
  checked,
  onPress,
}: {
  label: string;
  color?: string;
  checked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Icon
        name={checked ? 'checkCircle' : 'circle'}
        size={22}
        color={checked ? theme.colors.accent : theme.colors.borderStrong}
      />
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" tone={checked ? 'default' : 'muted'}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Baut die Liste der waehlbaren Quellen aus Kalendern und Haushalt. */
export function buildEntries(
  labels: { personal: string; family: string },
  hasHousehold: boolean,
  calendars: readonly CalendarWithRole[],
  members: readonly HouseholdMember[],
  ownAccountId: string,
): PickerEntry[] {
  const entries: PickerEntry[] = [{ source: 'personal', label: labels.personal }];

  if (hasHousehold) entries.push({ source: 'family', label: labels.family });

  calendars.forEach((entry) => {
    entries.push({
      source: `cal:${entry.calendar.id}`,
      label: entry.calendar.name,
      color: EVENT_COLORS[entry.calendar.color as EventColorKey],
    });
  });

  members
    .filter((member) => member.membership.accountId !== ownAccountId)
    .forEach((member) => {
      entries.push({
        source: `member:${member.membership.accountId}`,
        label: member.displayName,
      });
    });

  return entries;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
