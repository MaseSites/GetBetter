import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { currentApp } from '@/app/identity';
import { OtherAppsSection } from '@/features/search/OtherApps';
import { rankResults, type SearchGroup } from '@/features/search/results';
import { useRecentSearches } from '@/features/search/useRecentSearches';
import { useSearchCandidates, type SearchEntry } from '@/features/search/useSearchCandidates';
import { useI18n, type TranslationKey } from '@/i18n';
import { modulesOfApp } from '@/mocks/modules';
import { moduleName } from '@/mocks/moduleText';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Header, Icon, ModuleIcon, PlainList, PlainRow, Screen, SectionHeader, Text } from '@/ui';

const GROUP_LABELS: Readonly<Record<SearchGroup, TranslationKey>> = {
  tasks: 'search.group.tasks',
  notes: 'search.group.notes',
  mail: 'search.group.mail',
  people: 'search.group.people',
  places: 'search.group.places',
  entries: 'search.group.entries',
  functions: 'search.group.functions',
};

/** Welche Gruppen „Alle“ aufgeklappt hat — gilt nur fuer die Suche, bei der es geschah. */
type Expanded = { query: string; groups: readonly SearchGroup[] };

/**
 * Suche ueber alles, was diese App fuehrt.
 *
 * Ohne Eingabe: zuletzt gesucht, dann die Funktionen. Mit Eingabe: der beste
 * Treffer, dann Aufgaben, Notizen, E-Mails, Personen, Orte und Funktionen — je
 * drei, „Alle“ zeigt den Rest. Ein Treffer oeffnet den Eintrag selbst. Ganz
 * unten, zugeklappt, was die anderen Better-Apps fuehren.
 */
export function SearchScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const app = currentApp();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Expanded>({ query: '', groups: [] });
  const { recent, remember } = useRecentSearches(account.id);
  const { candidates, functions } = useSearchCandidates();

  const trimmed = query.trim();
  const openGroups = expanded.query === trimmed ? expanded.groups : [];
  const results = rankResults(trimmed, candidates, openGroups);

  // Die Suche spricht die Sprache der laufenden App. In BetterMoney nach
  // "Aufgabe, Termin, Notiz" zu fragen waere ein falsches Versprechen.
  const examples = modulesOfApp()
    .slice(0, 4)
    .map((module) => moduleName(t, module.id))
    .join(', ');
  const searchPlaceholder = examples || t('search.placeholder');

  function open(entry: SearchEntry) {
    remember(trimmed);
    router.push(entry.item.href);
  }

  function showAll(group: SearchGroup) {
    setExpanded({ query: trimmed, groups: [...openGroups, group] });
  }

  const row = (entry: SearchEntry) => (
    <PlainRow
      key={entry.key}
      title={entry.title}
      subtitle={entry.item.subtitle}
      leading={<ModuleIcon moduleId={entry.item.moduleId} icon={entry.item.icon} size="sm" />}
      onPress={() => open(entry)}
    />
  );

  return (
    <Screen header={<Header large title={t('search.title')} />} gap={theme.spacing.lg}>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <Icon name="search" size={17} color={theme.colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => remember(trimmed)}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.colors.textFaint}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('search.title')}
          style={[
            styles.input,
            {
              fontFamily: theme.fontFamily,
              fontSize: theme.fontSize.lede,
              color: theme.colors.text,
            },
          ]}
        />
      </View>

      {trimmed.length === 0 ? (
        <View>
          {recent.length > 0 ? (
            <>
              <SectionHeader label={t('search.recent')} first />
              <PlainList>
                {recent.map((entry) => (
                  <PlainRow
                    key={entry}
                    title={entry}
                    leading={<Icon name="search" size={18} color={theme.colors.textFaint} />}
                    onPress={() => setQuery(entry)}
                  />
                ))}
              </PlainList>
            </>
          ) : null}
          {functions.length > 0 ? (
            <>
              <SectionHeader label={t('search.group.functions')} first={recent.length === 0} />
              <PlainList>{functions.map(row)}</PlainList>
            </>
          ) : null}
        </View>
      ) : (
        <View>
          {results.best ? (
            <>
              <SectionHeader label={t('search.best')} first />
              <PlainList>{row(results.best)}</PlainList>
            </>
          ) : (
            <Text variant="body" tone="muted" style={{ fontSize: theme.fontSize.lede }}>
              {t('search.none', { query: trimmed })}
            </Text>
          )}
          {results.groups.map((group) => (
            <View key={group.group}>
              <SectionHeader label={t(GROUP_LABELS[group.group])} />
              <PlainList>
                {group.hits.map(row)}
                {group.total > group.hits.length ? (
                  <PlainRow
                    key="all"
                    title={t('search.showAll', { count: group.total })}
                    titleTone="accent"
                    leading={null}
                    onPress={() => showAll(group.group)}
                  />
                ) : null}
              </PlainList>
            </View>
          ))}
        </View>
      )}

      <OtherAppsSection current={app.id} query={trimmed} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', height: 44 },
  input: { flex: 1, height: '100%', outlineStyle: 'none' as never },
});
