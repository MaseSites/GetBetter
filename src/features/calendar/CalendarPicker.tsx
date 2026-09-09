import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CalendarSource } from '@/db/repositories';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Divider, Icon, Input, Segmented, Sheet, Text } from '@/ui';

export type CalendarMode = 'day' | 'week' | 'month';

export type PickerEntry = {
  source: CalendarSource;
  label: string;
  /** Farbpunkt vor dem Namen, wo einer sinnvoll ist. */
  color?: string;
};

/** Eine Gruppe von Personen — der Titel steht nur da, wo er noetig ist. */
export type PickerGroup = {
  key: string;
  title?: string;
  entries: readonly PickerEntry[];
};

export type CalendarPickerProps = {
  visible: boolean;
  onClose: () => void;
  mode: CalendarMode;
  onMode: (mode: CalendarMode) => void;
  calendars: readonly PickerEntry[];
  people: readonly PickerGroup[];
  /** Namen, deren Anfrage noch offen ist. */
  waiting: readonly string[];
  selected: readonly CalendarSource[];
  onToggle: (source: CalendarSource) => void;
  onAll: (all: boolean) => void;
  onAsk: (username: string) => void;
  /** Rueckmeldung auf die letzte Anfrage. */
  askMessage?: { tone: 'ok' | 'error'; text: string } | null;
};

/**
 * Das aufklappbare Menue: oben die Ansicht, darunter die eigenen Kalender
 * mit Haekchen, ganz unten die Personen, deren Kalender man dazunehmen kann.
 */
export function CalendarPicker({
  visible,
  onClose,
  mode,
  onMode,
  calendars,
  people,
  waiting,
  selected,
  onToggle,
  onAll,
  onAsk,
  askMessage = null,
}: CalendarPickerProps) {
  const t = useTranslate();
  const theme = useTheme();
  const [asking, setAsking] = useState(false);
  const [username, setUsername] = useState('');

  const allOn = calendars.length > 0 && calendars.every((entry) => selected.includes(entry.source));

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

          {calendars.map((entry) => (
            <CheckRow
              key={entry.source}
              label={entry.label}
              {...(entry.color ? { color: entry.color } : {})}
              checked={selected.includes(entry.source)}
              onPress={() => onToggle(entry.source)}
            />
          ))}
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <Icon name="person" size={16} color={theme.colors.textMuted} />
            <Text variant="label" tone="muted">
              {t('calendar.picker.people')}
            </Text>
          </View>

          {people.map((group) => (
            <View key={group.key}>
              {group.title ? (
                <Text variant="caption" tone="faint" style={{ paddingTop: theme.spacing.sm }}>
                  {group.title}
                </Text>
              ) : null}
              {group.entries.map((entry) => (
                <CheckRow
                  key={`${group.key}:${entry.source}`}
                  label={entry.label}
                  checked={selected.includes(entry.source)}
                  onPress={() => onToggle(entry.source)}
                />
              ))}
            </View>
          ))}

          {waiting.map((name) => (
            <View key={name} style={[styles.row, { paddingVertical: theme.spacing.sm }]}>
              <Text variant="caption" tone="faint">
                {t('calendar.picker.waiting', { name })}
              </Text>
            </View>
          ))}

          {asking ? (
            <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
              <Input
                label={t('calendar.picker.username')}
                placeholder="@name"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                {...(askMessage?.tone === 'error' ? { error: askMessage.text } : {})}
              />
              {askMessage?.tone === 'ok' ? (
                <Text variant="caption" tone="accent">
                  {askMessage.text}
                </Text>
              ) : null}
              <Button
                label={t('calendar.picker.ask')}
                icon="send"
                size="sm"
                onPress={() => {
                  onAsk(username);
                  setUsername('');
                }}
              />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('calendar.picker.other')}
              onPress={() => setAsking(true)}
              style={({ pressed }) => [
                styles.row,
                {
                  paddingVertical: theme.spacing.md,
                  gap: theme.spacing.md,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Icon name="plus" size={22} color={theme.colors.accentStrong} />
              <Text variant="body" tone="accent">
                {t('calendar.picker.other')}
              </Text>
            </Pressable>
          )}
        </View>
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
