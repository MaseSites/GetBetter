import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { contacts as contactRepo, useLiveQuery, type ContactRow } from '@/db';
import { useI18n } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  EmptyState,
  FLOATING_BUTTON_SIZE,
  FloatingButton,
  Header,
  Input,
  Loading,
  PlainList,
  Screen,
  SectionHeader,
  Text,
  useUndo,
} from '@/ui';

import { BirthdayEditor, type BirthdayDraft } from './BirthdayEditor';
import { canImportContacts, importBirthdays } from './importContacts';
import { CompactRow, WeekRow, type BirthdayRowProps } from './BirthdayRows';
import {
  birthdaySections,
  matchesQuery,
  SEARCH_MIN_PEOPLE,
  upcomingBirthdays,
  withBirthday,
  type UpcomingBirthday,
} from './birthdays';
import { AVATAR } from './PersonAvatar';
import { PersonScreen } from './PersonScreen';
import { TodayCard } from './TodayCard';
import { useBirthdayActions } from './useBirthdayActions';

/** Ein Suchparameter kann im Browser auch mehrfach dastehen — gezaehlt wird der erste. */
function single(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.length > 0 ? first : null;
}

/** Der Weg zu einer Person: ein eigener Bildschirm auf dem Stapel, zurueck mit dem Randwisch. */
export function birthdayPersonHref(contactId: string): string {
  return `/run/birthdays?person=${encodeURIComponent(contactId)}`;
}

/**
 * Geburtstage. Ohne Parameter „Demnächst“; `?new=1` oeffnet gleich das Blatt
 * zum Anlegen, `?person=<Kontakt-Id>` die Seite einer Person.
 */
export function BirthdaysView({ module }: { module: ModuleDefinition }) {
  const params = useLocalSearchParams<{ new?: string; person?: string }>();
  const person = single(params.person);

  if (person) return <PersonScreen key={person} contactId={person} />;
  return <BirthdayList module={module} startAdding={single(params.new) === '1'} />;
}

/** „Demnächst“: wer als Nächstes feiert, steht oben — je näher, desto grösser. */
function BirthdayList({ module, startAdding }: { module: ModuleDefinition; startAdding: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const actions = useBirthdayActions();
  const undo = useUndo();

  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);

  /** Geburtstage aus den Kontakten des Handys — nur dort, wo es Kontakte gibt. */
  async function runImport() {
    if (importing) return;
    setImporting(true);
    try {
      const result = await importBirthdays(account.id);
      const taken = result.ok ? result.added + result.updated : 0;
      undo.show({
        message: !result.ok
          ? t(result.error === 'denied' ? 'birthdays.import.denied' : 'birthdays.import.failed')
          : taken > 0
            ? t('birthdays.import.done', { count: taken })
            : t('birthdays.import.none'),
      });
    } finally {
      setImporting(false);
    }
  }
  const [editing, setEditing] = useState<BirthdayDraft | null>(() => (startAdding ? {} : null));

  const list = useLiveQuery(() => contactRepo.list(account.id), [account.id]);
  const rows = list.data ?? [];
  const byId: ReadonlyMap<string, ContactRow> = new Map(rows.map((row) => [row.id, row]));
  const people = withBirthday(rows);

  // Das Suchfeld gibt es erst ab 15 Personen; darunter sieht man alle auf einen Blick.
  const searchable = people.length >= SEARCH_MIN_PEOPLE;
  const needle = searchable ? query : '';
  const sections = birthdaySections(
    upcomingBirthdays(people.filter((person) => matchesQuery(person.name, needle))),
  );
  const hits =
    sections.today.length + sections.week.length + sections.month.length + sections.later.length;

  const openPerson = (contactId: string) => router.push(birthdayPersonHref(contactId));

  const rowProps = (entry: UpcomingBirthday): BirthdayRowProps => {
    const contact = byId.get(entry.person.id);
    return {
      entry,
      contact,
      onOpen: () => openPerson(entry.person.id),
      onEdit: () => {
        if (contact) setEditing({ contact });
      },
      onRemove: () => void actions.removeBirthday(entry.person.id),
    };
  };

  return (
    <Screen
      header={
        <Header
          title={moduleName(t, module.id)}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={
            canImportContacts
              ? [{ icon: 'people', label: t('birthdays.import'), onPress: () => void runImport() }]
              : []
          }
        />
      }
      scroll={false}
      padded={false}
      gap={0}
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: theme.spacing.edge,
            paddingTop: theme.spacing.lg,
            // Die letzte Zeile bleibt ueber dem Knopf unten rechts erreichbar.
            paddingBottom: FLOATING_BUTTON_SIZE + theme.spacing.xxl,
            gap: theme.spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {list.loading && rows.length === 0 ? <Loading /> : null}

        {!list.loading && people.length === 0 ? (
          <EmptyState
            title={t('birthdays.empty.title')}
            body={t('birthdays.emptyLine')}
            actionLabel={t('birthdays.addPerson')}
            onAction={() => setEditing({})}
          />
        ) : null}

        {searchable ? (
          <Input
            icon="search"
            placeholder={t('birthdays.search')}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            accessibilityLabel={t('birthdays.search')}
          />
        ) : null}

        {searchable && hits === 0 ? (
          <Text variant="body" tone="muted" align="center">
            {t('birthdays.noMatch', { query: query.trim() })}
          </Text>
        ) : null}

        {sections.today.length > 0 ? (
          <TodayCard entries={sections.today} contacts={byId} onOpen={openPerson} />
        ) : null}

        <Section
          label={t('birthdays.section.week')}
          entries={sections.week}
          size="week"
          rowProps={rowProps}
        />
        <Section
          label={t('birthdays.section.month')}
          entries={sections.month}
          size="compact"
          rowProps={rowProps}
        />
        <Section
          label={t('birthdays.section.later')}
          entries={sections.later}
          size="compact"
          rowProps={rowProps}
        />
      </ScrollView>

      {people.length > 0 ? (
        <FloatingButton label={t('birthdays.addPerson')} onPress={() => setEditing({})} />
      ) : null}

      <BirthdayEditor draft={editing} accountId={account.id} onClose={() => setEditing(null)} />
    </Screen>
  );
}

/** Ein Abschnitt nach Nähe. Ist er leer, faellt er ganz weg. */
function Section({
  label,
  entries,
  size,
  rowProps,
}: {
  label: string;
  entries: readonly UpcomingBirthday[];
  size: 'week' | 'compact';
  rowProps: (entry: UpcomingBirthday) => BirthdayRowProps;
}) {
  const theme = useTheme();
  if (entries.length === 0) return null;

  const avatar = size === 'week' ? AVATAR.week : AVATAR.compact;

  return (
    <View>
      <SectionHeader label={label} first />
      <PlainList separatorInset={avatar + theme.spacing.md}>
        {entries.map((entry) =>
          size === 'week' ? (
            <WeekRow key={entry.person.id} {...rowProps(entry)} />
          ) : (
            <CompactRow key={entry.person.id} {...rowProps(entry)} />
          ),
        )}
      </PlainList>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
});
