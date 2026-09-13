import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { ContactRow } from '@/db';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Text } from '@/ui';

import type { UpcomingBirthday } from './birthdays';
import { todayLine } from './format';
import { AVATAR, PersonAvatar } from './PersonAvatar';
import { canMessage, useBirthdayActions } from './useBirthdayActions';

/** Die Punkte unter der Karte, wenn mehrere heute feiern. */
const DOT_SIZE = 6;

/**
 * Wer heute feiert: die einzige grosse Flaeche im Modul — gross und ruhig,
 * ohne Farbverlauf. Feiern mehrere, blaettert man seitlich.
 */
export function TodayCard({
  entries,
  contacts,
  onOpen,
}: {
  entries: readonly UpcomingBirthday[];
  contacts: ReadonlyMap<string, ContactRow>;
  onOpen: (contactId: string) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const paged = entries.length > 1;
  const single = entries[0];

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[
          styles.card,
          theme.elevation.card,
          { borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface },
        ]}
      >
        {paged ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              if (width > 0) setPage(Math.round(event.nativeEvent.contentOffset.x / width));
            }}
          >
            {entries.map((entry) => (
              <View key={entry.person.id} style={{ width }}>
                <TodayPage
                  entry={entry}
                  contact={contacts.get(entry.person.id)}
                  onOpen={() => onOpen(entry.person.id)}
                />
              </View>
            ))}
          </ScrollView>
        ) : single ? (
          <TodayPage
            entry={single}
            contact={contacts.get(single.person.id)}
            onOpen={() => onOpen(single.person.id)}
          />
        ) : null}
      </View>

      {paged ? (
        <View
          accessible
          accessibilityLabel={t('birthdays.page', { index: page + 1, count: entries.length })}
          style={[styles.dots, { gap: theme.spacing.xs }]}
        >
          {entries.map((entry, index) => (
            <View
              key={entry.person.id}
              style={[
                styles.dot,
                {
                  backgroundColor: index === page ? theme.colors.text : theme.colors.borderStrong,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TodayPage({
  entry,
  contact,
  onOpen,
}: {
  entry: UpcomingBirthday;
  contact: ContactRow | undefined;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const actions = useBirthdayActions();
  const phone = contact?.phone ?? null;
  const name = entry.person.name;
  const line = todayLine(t, entry);

  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[name, line].join(', ')}
        onPress={onOpen}
        style={({ pressed }) => [styles.row, { gap: theme.spacing.lg, opacity: pressed ? 0.7 : 1 }]}
      >
        <PersonAvatar name={name} photoUploadId={contact?.photoUploadId} size={AVATAR.hero} />
        <View style={styles.grow}>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: theme.fontFamilyDisplay,
              fontSize: theme.fontSize.stat,
              lineHeight: theme.lineHeight.lg,
              fontWeight: theme.fontWeight.semibold,
            }}
          >
            {name}
          </Text>
          <Text variant="body" tone="muted">
            {line}
          </Text>
        </View>
      </Pressable>

      {canMessage(phone) ? (
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <View style={styles.grow}>
            <Button
              label={t('birthdays.message')}
              icon="mail"
              onPress={() => actions.message(name, phone)}
            />
          </View>
          {phone ? (
            <View style={styles.grow}>
              <Button
                label={t('birthdays.call')}
                icon="phone"
                variant="secondary"
                onPress={() => actions.call(phone)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center' },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
