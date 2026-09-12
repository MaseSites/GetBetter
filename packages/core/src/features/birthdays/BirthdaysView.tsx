import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';

import { contacts as contactRepo, useLiveQuery, type ContactRow } from '@/db';
import { parseDay, relativeDay } from '@/features/shared/days';
import { formatBirthDate, formatDayMonth, formatLongDate, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { moduleTint, useTheme } from '@/theme';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Header,
  Icon,
  Input,
  Loading,
  Screen,
  Segmented,
  SwipeRow,
  Text,
} from '@/ui';

import { BirthdayEditor, type BirthdayDraft } from './BirthdayEditor';
import { upcomingBirthdays, withBirthday, type UpcomingBirthday } from './birthdays';

type Range = 'today' | 'week' | 'month' | 'year';

/** Wie weit die Liste voraus schaut; ein Jahr heisst: alle. */
const RANGE_DAYS: Record<Range, number> = { today: 0, week: 7, month: 31, year: 366 };
const RANGES: readonly Range[] = ['today', 'week', 'month', 'year'];

/** Teilen gibt es auf dem Telefon immer, im Browser nur, wo er es kann. */
const canShare =
  Platform.OS !== 'web' ||
  (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

/**
 * Geburtstage wie in einer eigenen App: oben, wer heute feiert, gross und
 * farbig; darunter, wer als Naechstes dran ist. Alles liegt bei den Kontakten
 * und steht jedes Jahr ganztaegig im Kalender.
 */
export function BirthdaysView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [range, setRange] = useState<Range>('month');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<BirthdayDraft | null>(null);

  const list = useLiveQuery(() => contactRepo.list(account.id), [account.id]);
  const rows = list.data ?? [];
  const people = withBirthday(rows);
  const byId = new Map(rows.map((row) => [row.id, row]));

  const needle = query.trim().toLowerCase();
  const matching = people.filter((person) => person.name.toLowerCase().includes(needle));
  const today = upcomingBirthdays(matching, 0);
  const upcoming = upcomingBirthdays(matching, RANGE_DAYS[range]).filter(
    (entry) => range === 'today' || entry.days > 0,
  );
  const next = upcomingBirthdays(people, RANGE_DAYS.year).find((entry) => entry.days > 0);

  const open = (entry: UpcomingBirthday) => {
    const contact = byId.get(entry.person.id);
    if (contact) setEditing({ contact });
  };

  const subtitle =
    people.length === 0
      ? module.short
      : t(people.length === 1 ? 'birthdays.count.one' : 'birthdays.count', {
          count: people.length,
        });

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={subtitle}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
      footer={<Button label={t('birthdays.add')} icon="plus" onPress={() => setEditing({})} />}
    >
      {list.loading && rows.length === 0 ? <Loading /> : null}

      {!list.loading && people.length === 0 ? (
        <EmptyState title={t('birthdays.empty.title')} body={t('birthdays.empty.body')} />
      ) : null}

      {people.length > 0 ? (
        <>
          <Input
            icon="search"
            placeholder={t('birthdays.search')}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            accessibilityLabel={t('birthdays.search')}
          />

          <Segmented
            options={RANGES.map((value) => ({ value, label: t(`birthdays.range.${value}`) }))}
            value={range}
            onChange={setRange}
            accessibilityLabel={t('birthdays.rangeLabel')}
          />

          <Text variant="overline" tone="faint">
            {formatLongDate(language, new Date().toISOString())}
          </Text>

          {today.length > 0 ? (
            today.map((entry) => (
              <TodayHero
                key={entry.person.id}
                entry={entry}
                contact={byId.get(entry.person.id)}
                onOpen={() => open(entry)}
              />
            ))
          ) : (
            <QuietHero next={next} />
          )}

          <Text variant="section" tone="muted">
            {t('birthdays.upcoming')}
          </Text>

          {upcoming.length === 0 ? (
            <View style={[styles.center, { gap: theme.spacing.sm }]}>
              <Text variant="label" tone="faint" align="center">
                {t('birthdays.emptyRange')}
              </Text>
              {range !== 'year' ? (
                <Button
                  label={t('birthdays.showAll')}
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={() => setRange('year')}
                />
              ) : null}
            </View>
          ) : (
            upcoming.map((entry) => (
              <SwipeRow
                key={entry.person.id}
                radius={theme.radii.md}
                onDelete={() => void contactRepo.removeBirthday(entry.person.id)}
              >
                <Card
                  onPress={() => open(entry)}
                  accessibilityLabel={`${entry.person.name}, ${t('birthdays.turns', { age: entry.age })}, ${relativeDay(t, language, entry.day)}`}
                >
                  <View style={[styles.row, { gap: theme.spacing.md }]}>
                    <Avatar name={entry.person.name} size={44} />
                    <View style={styles.grow}>
                      <Text
                        variant="body"
                        numberOfLines={1}
                        style={{ fontWeight: theme.fontWeight.semibold }}
                      >
                        {entry.person.name}
                      </Text>
                      <Text variant="label" tone="muted">
                        {formatDayMonth(language, parseDay(entry.day))}
                      </Text>
                    </View>
                    <View style={styles.end}>
                      <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                        {t('birthdays.age', { age: entry.age })}
                      </Text>
                      <Text variant="caption" tone={entry.days <= 7 ? 'accent' : 'faint'}>
                        {relativeDay(t, language, entry.day)}
                      </Text>
                    </View>
                    <Icon name="forward" size={18} color={theme.colors.textFaint} />
                  </View>
                </Card>
              </SwipeRow>
            ))
          )}
        </>
      ) : null}

      <BirthdayEditor draft={editing} accountId={account.id} onClose={() => setEditing(null)} />
    </Screen>
  );
}

/** Wer heute feiert: die Karte in der Farbe des Bereichs, das Alter gross. */
function TodayHero({
  entry,
  contact,
  onOpen,
}: {
  entry: UpcomingBirthday;
  contact: ContactRow | undefined;
  onOpen: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const tint = moduleTint(theme, 'birthdays');
  const phone = contact?.phone ?? null;

  function congratulate() {
    // Wer das Teilen abbricht, hat nichts falsch gemacht — dann passiert nichts.
    Share.share({ message: t('birthdays.wish', { name: entry.person.name }) }).catch(
      () => undefined,
    );
  }

  return (
    <LinearGradient
      colors={tint.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.hero,
        theme.elevation.raised,
        { borderRadius: theme.radii.lg, padding: theme.spacing.lg, gap: theme.spacing.lg },
      ]}
    >
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <Avatar name={entry.person.name} size={56} />
        <View style={styles.grow}>
          <Text variant="overline" style={{ color: tint.foreground }}>
            {t('birthdays.todayLabel')}
          </Text>
          <Text variant="title" numberOfLines={1} style={{ color: tint.foreground }}>
            {entry.person.name}
          </Text>
          <Text variant="caption" style={{ color: tint.foreground, opacity: 0.8 }}>
            {formatBirthDate(language, parseDay(entry.person.birthday))}
          </Text>
        </View>
        <View style={styles.end}>
          <Text variant="display" style={{ color: tint.foreground, fontVariant: ['tabular-nums'] }}>
            {entry.age}
          </Text>
          <Text variant="caption" style={{ color: tint.foreground, opacity: 0.8 }}>
            {t('birthdays.years')}
          </Text>
        </View>
      </View>

      <View style={[styles.row, { gap: theme.spacing.sm, flexWrap: 'wrap' }]}>
        {canShare ? (
          <Button
            label={t('birthdays.congratulate')}
            icon="gift"
            size="sm"
            fullWidth={false}
            onPress={congratulate}
          />
        ) : null}
        {phone ? (
          <Button
            label={t('birthdays.call')}
            icon="phone"
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={() => void Linking.openURL(`tel:${phone}`)}
          />
        ) : null}
        <Button
          label={t('birthdays.details')}
          size="sm"
          variant="ghost"
          fullWidth={false}
          onPress={onOpen}
        />
      </View>
    </LinearGradient>
  );
}

/** Heute feiert niemand — dann sagt die Karte, wer als Naechstes dran ist. */
function QuietHero({ next }: { next: UpcomingBirthday | undefined }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const tint = moduleTint(theme, 'birthdays');

  return (
    <LinearGradient
      colors={tint.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.hero,
        styles.center,
        { borderRadius: theme.radii.lg, padding: theme.spacing.xl, gap: theme.spacing.sm },
      ]}
    >
      <Icon name="gift" size={32} color={tint.foreground} />
      <Text variant="title" align="center" style={{ color: tint.foreground }}>
        {t('birthdays.none.title')}
      </Text>
      {next ? (
        <Text variant="label" align="center" style={{ color: tint.foreground, opacity: 0.8 }}>
          {t('birthdays.none.next', {
            name: next.person.name,
            when: relativeDay(t, language, next.day),
          })}
        </Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, gap: 2 },
  end: { alignItems: 'flex-end' },
  center: { alignItems: 'center', justifyContent: 'center' },
  hero: { overflow: 'hidden' },
});
