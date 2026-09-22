import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CalendarSource } from '@/db/repositories';
import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Checkbox, Icon, Input, Segmented, Sheet, Text } from '@/ui';

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

/** Eine offene Anfrage: jemand will deinen Kalender sehen, oder du bist eingeladen. */
export type PickerRequest = {
  key: string;
  title: string;
  body: string;
  onAccept: () => void;
  onDecline: () => void;
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
  /** Was auf eine Antwort wartet — steht zuoberst. */
  requests: readonly PickerRequest[];
  selected: readonly CalendarSource[];
  onToggle: (source: CalendarSource) => void;
  onAsk: (username: string) => void;
  /** Rueckmeldung auf die letzte Anfrage. */
  askMessage?: { tone: 'ok' | 'error'; text: string } | null;
};

/**
 * Das eine Menue des Kalenders, hinter dem Knopf oben rechts: zuoberst, was
 * auf eine Antwort wartet, dann die Ansicht (Tag, Woche, Monat), die eigenen
 * Kalender — nur, wenn es mehr als einen gibt — und die Kalender anderer, die
 * man sich anzeigen lassen kann. Anlegen und Verwalten gibt es hier nicht.
 */
export function CalendarPicker({
  visible,
  onClose,
  mode,
  onMode,
  calendars,
  people,
  waiting,
  requests,
  selected,
  onToggle,
  onAsk,
  askMessage = null,
}: CalendarPickerProps) {
  const t = useTranslate();
  const theme = useTheme();
  const [asking, setAsking] = useState(false);
  const [username, setUsername] = useState('');

  return (
    <Sheet visible={visible} onClose={onClose} title={t('calendar.picker.title')}>
      <View style={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.lg }}>
        {requests.length > 0 ? (
          <View style={{ gap: theme.spacing.md }}>
            {requests.map((request) => (
              <View key={request.key} style={{ gap: theme.spacing.sm }}>
                <View style={{ gap: theme.spacing.xs }}>
                  <Text variant="label" style={{ fontWeight: theme.fontWeight.semibold }}>
                    {request.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {request.body}
                  </Text>
                </View>
                <View style={[styles.row, { gap: theme.spacing.sm }]}>
                  <Button
                    label={t('calendars.invites.accept')}
                    size="sm"
                    icon="check"
                    fullWidth={false}
                    onPress={request.onAccept}
                  />
                  <Button
                    label={t('calendars.invites.decline')}
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    onPress={request.onDecline}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
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

        {/* Mit nur einem eigenen Kalender gibt es nichts an- oder abzuwaehlen. */}
        {calendars.length > 1 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="section" tone="muted">
              {t('calendar.picker.calendars')}
            </Text>
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
        ) : null}

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="section" tone="muted">
            {t('calendar.picker.people')}
          </Text>

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
                  minHeight: 44,
                  gap: theme.spacing.md,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.plus,
                  { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.xs },
                ]}
              >
                <Icon name="plus" size={14} color={theme.colors.textMuted} />
              </View>
              <Text variant="body" tone="muted">
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
          minHeight: 44,
          gap: theme.spacing.md,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Checkbox checked={checked} />
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
  plus: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center' },
});
