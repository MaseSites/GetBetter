import { useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MailFolderRole } from '@/db/types';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import {
  EmptyState,
  FLOATING_BUTTON_SIZE,
  FloatingButton,
  Input,
  ListSeparator,
  Menu,
  Screen,
  Text,
  measureAnchor,
  type MenuAnchor,
  type MenuEntry,
} from '@/ui';

import { FILTER_EMPTY_KEYS, FilterControls, SelectionBar } from './InboxParts';
import { Dots, RoundButton, TextButton, TopBar } from './MailChrome';
import type { MailListFilter, MailThread, SwipeAway } from './threads';
import { ThreadRow, threadMenu, type PreviewLines, type ThreadCommand } from './ThreadRow';

/** Ab so viel Rollen schrumpft „Schreiben“ zum runden Knopf. */
const COLLAPSE_AFTER = 24;

const PREVIEW_KEYS: Readonly<Record<PreviewLines, TranslationKey>> = {
  0: 'mailui.menu.preview0',
  1: 'mailui.menu.preview1',
  2: 'mailui.menu.preview2',
};
const PREVIEW_CHOICES: readonly PreviewLines[] = [0, 1, 2];

export type RowInfo = { swipeAway: SwipeAway; canSpam: boolean; mailboxLabel: string | null };

export type SelectionCommand = 'archive' | 'read' | 'move' | 'delete';

export type InboxScreenProps = {
  title: string;
  /** Die Adresse ueber dem Titel, wenn ein einzelnes Postfach offen ist. */
  overline: string | null;
  role: MailFolderRole;
  threads: readonly MailThread[];
  /** Kein Postfach: statt der Liste die Anbieter. */
  setup: ReactNode | null;
  /** Die Zeilen unter dem Titel: laedt, offline, abgelehnt. */
  status: ReactNode;
  /** Erster Abgleich ohne Daten — dann steht keine leere Liste da. */
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  filter: MailListFilter | null;
  onFilter: (filter: MailListFilter | null) => void;
  previewLines: PreviewLines;
  onPreviewLines: (lines: PreviewLines) => void;
  selecting: boolean;
  selected: ReadonlySet<string>;
  onSelecting: (selecting: boolean) => void;
  onSelectAll: () => void;
  selection: { canArchive: boolean; purge: boolean };
  onSelectionCommand: (command: SelectionCommand) => void;
  refreshing: boolean;
  onRefresh: () => void;
  rowInfo: (thread: MailThread) => RowInfo;
  onCommand: (thread: MailThread, command: ThreadCommand) => void;
  onCompose: () => void;
  onMailboxes: () => void;
};

type OpenMenu = { anchor: MenuAnchor; open: boolean };

function Separator() {
  const theme = useTheme();
  return <ListSeparator inset={theme.spacing.edge + theme.spacing.xs} />;
}

/**
 * Der Posteingang als Arbeitsliste: oben nur „‹ Postfächer“, „…“, der Titel
 * und ein Suchfeld, das mitrollt. Unten links Filter, rechts Schreiben.
 */
export function InboxScreen(props: InboxScreenProps) {
  const { threads, setup, selecting, selected, filter, search, previewLines, rowInfo, onCommand } =
    props;
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const dots = useRef<View>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [viewMenu, setViewMenu] = useState<OpenMenu | null>(null);
  const [moreMenu, setMoreMenu] = useState<(OpenMenu & { threadId: string }) | null>(null);

  const moreThread = moreMenu ? threads.find((thread) => thread.id === moreMenu.threadId) : null;
  const ready = setup === null;

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = event.nativeEvent.contentOffset.y > COLLAPSE_AFTER;
    if (next !== collapsed) setCollapsed(next);
  }

  async function openViewMenu() {
    const anchor = await measureAnchor(dots.current);
    if (anchor) setViewMenu({ anchor, open: true });
  }

  const viewItems: MenuEntry[] = [
    {
      key: 'select',
      label: t('mailui.menu.select'),
      icon: 'checkbox',
      onPress: () => props.onSelecting(true),
    },
    { key: 'divider', divider: true },
    ...PREVIEW_CHOICES.map((lines) => ({
      key: `preview-${lines}`,
      label: t(PREVIEW_KEYS[lines]),
      selected: previewLines === lines,
      onPress: () => props.onPreviewLines(lines),
    })),
  ];

  const topBar = selecting ? (
    <TopBar
      backAccessibilityLabel={t('common.back')}
      left={
        <TextButton
          label={
            selected.size === threads.length && threads.length > 0
              ? t('mailui.select.none')
              : t('mailui.select.all')
          }
          onPress={props.onSelectAll}
        />
      }
      right={
        <>
          <Text variant="label" tone="muted">
            {t('mailui.select.count', { count: selected.size })}
          </Text>
          <TextButton label={t('common.done')} strong onPress={() => props.onSelecting(false)} />
        </>
      }
    />
  ) : (
    <TopBar
      backLabel={t('mailui.mailboxes.title')}
      backAccessibilityLabel={t('mailui.mailboxes.back')}
      onBack={props.onMailboxes}
      right={
        ready ? (
          <RoundButton ref={dots} label={t('ui.menu.more')} onPress={() => void openViewMenu()}>
            <Dots />
          </RoundButton>
        ) : null
      }
    />
  );

  const header = (
    <View
      style={{
        paddingHorizontal: theme.spacing.edge,
        paddingBottom: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      {props.overline ? (
        <Text variant="overline" tone="faint" numberOfLines={1}>
          {props.overline}
        </Text>
      ) : null}
      <Text variant="display" numberOfLines={1}>
        {props.title}
      </Text>
      {props.status}
      {ready ? (
        <Input
          value={search}
          onChangeText={props.onSearch}
          icon="search"
          placeholder={t('mailui.search.placeholder')}
          accessibilityLabel={t('mail.search')}
          autoCapitalize="none"
          returnKeyType="search"
        />
      ) : null}
    </View>
  );

  const empty = !ready ? (
    setup
  ) : props.loading ? null : filter ? (
    <EmptyState
      title={t(FILTER_EMPTY_KEYS[filter])}
      body={t('mailui.empty.filteredBody')}
      actionLabel={t('mailui.filter.clear')}
      onAction={() => props.onFilter(null)}
    />
  ) : search.trim().length > 0 ? (
    <EmptyState title={t('mailui.empty.search')} body={t('mailui.empty.searchBody')} />
  ) : (
    <EmptyState title={t('mailui.empty.inbox')} body={t('mailui.empty.inboxBody')} />
  );

  return (
    <Screen header={topBar} scroll={false} padded={false} gap={0}>
      <FlatList
        style={styles.fill}
        data={ready ? threads : []}
        keyExtractor={(thread) => thread.id}
        extraData={[selected, selecting, previewLines]}
        renderItem={({ item }) => {
          const info = rowInfo(item);
          return (
            <ThreadRow
              thread={item}
              role={props.role}
              swipeAway={info.swipeAway}
              canSpam={info.canSpam}
              mailboxLabel={info.mailboxLabel}
              previewLines={previewLines}
              selecting={selecting}
              checked={selected.has(item.id)}
              onCommand={(command) => onCommand(item, command)}
              onMore={(anchor) => setMoreMenu({ anchor, open: true, threadId: item.id })}
            />
          );
        }}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ? <View style={styles.empty}>{empty}</View> : null}
        refreshControl={
          ready ? (
            <RefreshControl
              refreshing={props.refreshing}
              onRefresh={props.onRefresh}
              tintColor={theme.colors.textMuted}
            />
          ) : undefined
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: FLOATING_BUTTON_SIZE + theme.spacing.xxl + insets.bottom,
        }}
      />

      {selecting ? (
        <SelectionBar
          count={selected.size}
          canArchive={props.selection.canArchive}
          purge={props.selection.purge}
          onArchive={() => props.onSelectionCommand('archive')}
          onRead={() => props.onSelectionCommand('read')}
          onMove={() => props.onSelectionCommand('move')}
          onDelete={() => props.onSelectionCommand('delete')}
        />
      ) : ready ? (
        <>
          <FilterControls filter={filter} onFilter={props.onFilter} />
          <FloatingButton
            label={t('mailui.compose.new')}
            icon="note"
            text={t('mailui.compose.write')}
            collapsed={collapsed}
            onPress={props.onCompose}
          />
        </>
      ) : null}

      <Menu
        visible={viewMenu?.open ?? false}
        anchor={viewMenu?.anchor ?? null}
        align="end"
        items={viewItems}
        onClose={() => setViewMenu((current) => (current ? { ...current, open: false } : null))}
      />
      <Menu
        visible={moreMenu?.open === true && moreThread !== null && moreThread !== undefined}
        anchor={moreMenu?.anchor ?? null}
        align="end"
        items={
          moreThread
            ? threadMenu(moreThread, { ...rowInfo(moreThread), full: false }, t, (command) =>
                onCommand(moreThread, command),
              )
            : []
        }
        onClose={() => setMoreMenu((current) => (current ? { ...current, open: false } : null))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  empty: { flexGrow: 1, justifyContent: 'center' },
});
