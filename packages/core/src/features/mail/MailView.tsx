import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { contacts, useLiveQuery } from '@/db';
import { MAIL_FOLDER_ROLES, mail, type MailMessage } from '@/db/mail';
import type { MailFolderRole } from '@/db/types';
import { formatLongDate, formatTime, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { FLOATING_BUTTON_SIZE, HIT_TARGET } from '@/ui';

import { AccountsSheet } from './AccountsSheet';
import { AttachmentPreview } from './AttachmentPreview';
import {
  draftCompose,
  emptyCompose,
  forwardCompose,
  replyCompose,
  type ComposeState,
} from './compose';
import { ComposeSheet } from './ComposeSheet';
import { ConfirmSheet } from './ConfirmSheet';
import { ConversationScreen } from './ConversationScreen';
import { DraftBar } from './DraftBar';
import { FixSheet } from './FixSheet';
import { FOLDER_LABEL_KEYS, listDateKind, mailErrorKey, rolesOf, senderName } from './format';
import { problemText, StatusLine } from './InboxParts';
import { InboxScreen, type RowInfo, type SelectionCommand } from './InboxScreen';
import { MailboxesScreen } from './MailboxesScreen';
import { MoveSheet } from './MoveSheet';
import { NoMailbox } from './NoMailbox';
import type { MailProviderChoice } from './providers';
import {
  UNIFIED_INBOX,
  commonRoles,
  conversationOf,
  isFromMe,
  mailboxShortName,
  neighboursOf,
  ownAddressesOf,
  selectThreads,
  swipeAwayOf,
  type MailListFilter,
  type MailPlace,
  type MailThread,
} from './threads';
import type { PreviewLines, ThreadCommand } from './ThreadRow';
import { useCompose } from './useCompose';
import { useMailActions } from './useMailActions';
import { useMailSync } from './useMailSync';

type Panel =
  | { kind: 'none' }
  | { kind: 'accounts'; startInForm: boolean; preset: MailProviderChoice | null; email: string }
  | { kind: 'move'; messages: readonly MailMessage[]; roles: MailFolderRole[]; leave: boolean }
  | { kind: 'purge'; messages: readonly MailMessage[]; leave: boolean }
  | { kind: 'fix'; mailboxId: string };

/** Was die Adresse einmal verlangt hat (`?compose=1`), gilt nur beim ersten Mal. */
class Once {
  private used = false;

  claim(): boolean {
    if (this.used) return false;
    this.used = true;
    return true;
  }
}

/** Die Zurueck-Taste auf Android — mit dem neuesten Stand, ohne sich neu anzumelden. */
class BackKey {
  private handler: () => boolean = () => false;

  set(handler: () => boolean) {
    this.handler = handler;
  }

  handle(): boolean {
    return this.handler();
  }
}

/** Die neueste Nachricht, die nicht von mir ist — darauf antwortet man. */
function replyTargetOf(
  conversation: readonly MailMessage[],
  own: ReadonlySet<string>,
): MailMessage | null {
  return (
    [...conversation].reverse().find((message) => !isFromMe(message, own)) ??
    conversation[conversation.length - 1] ??
    null
  );
}

/**
 * Die E-Mail: Posteingang als Wurzel, darueber „Postfächer“, darauf die
 * Unterhaltung im Vollbild. Schreiben ist ein grosses Blatt, das sich
 * minimieren laesst. `/run/mail?compose=1` oeffnet es gleich,
 * `/run/mail?message=<id>` die Unterhaltung dieser Nachricht.
 */
export function MailView(_: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const params = useLocalSearchParams<{ compose?: string; message?: string }>();

  const [level, setLevel] = useState<'inbox' | 'mailboxes'>('inbox');
  const [place, setPlace] = useState<MailPlace>(UNIFIED_INBOX);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MailListFilter | null>(null);
  const [previewLines, setPreviewLines] = useState<PreviewLines>(1);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(
    typeof params.message === 'string' && params.message.length > 0 ? params.message : null,
  );
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [attachment, setAttachment] = useState<{ message: MailMessage; index: number } | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [composeParam] = useState(() => new Once());
  const [backKey] = useState(() => new BackKey());

  const sync = useMailSync(account.id);
  const actions = useMailActions(account.id);
  const compose = useCompose(account.id);

  const boxes = useLiveQuery(() => mail.accounts(account.id), [account.id]);
  const all = useLiveQuery(() => mail.messages(account.id), [account.id]);
  const people = useLiveQuery(() => contacts.list(account.id), [account.id]);
  const mailboxes = boxes.data ?? [];
  const messages = all.data ?? [];
  const loaded = boxes.data !== undefined;
  const firstMailbox = mailboxes[0]?.id ?? null;

  const own = ownAddressesOf(mailboxes, [account.email]);
  const rolesByMailbox = new Map(
    mailboxes.map((box) => [box.id, rolesOf(box.folders, MAIL_FOLDER_ROLES)] as const),
  );
  const rolesFor = (mailAccountId: string) => rolesByMailbox.get(mailAccountId) ?? ['inbox'];
  // Ein getrenntes Postfach faellt auf alle Posteingaenge zurueck.
  const activePlace =
    place.mailAccountId !== null && !mailboxes.some((box) => box.id === place.mailAccountId)
      ? UNIFIED_INBOX
      : place;
  const threads = selectThreads(messages, { place: activePlace, filter, search, own });
  const selected = new Set(selectedIds.filter((id) => threads.some((thread) => thread.id === id)));
  const selectedMessages = threads
    .filter((thread) => selected.has(thread.id))
    .flatMap((thread) => thread.messages);

  // Die Unterhaltung: aus der Liste oder aus `?message=` — dann in deren Ordner.
  const pending = pendingMessage
    ? messages.find((message) => message.id === pendingMessage)
    : undefined;
  const readingThread = reading ?? pending?.threadId ?? null;
  const readingRole = reading ? activePlace.role : (pending?.folderRole ?? activePlace.role);
  const conversation = readingThread ? conversationOf(messages, readingThread, readingRole) : [];

  useEffect(() => {
    if (!loaded || firstMailbox === null || params.compose !== '1') return;
    if (composeParam.claim()) void compose.start(emptyCompose(firstMailbox));
  }, [loaded, firstMailbox, params.compose, composeParam, compose]);

  useEffect(() => {
    backKey.set(() => {
      if (attachment) setAttachment(null);
      else if (conversation.length > 0) closeReading();
      else if (selecting) stopSelecting();
      else if (level === 'inbox') setLevel('mailboxes');
      else return false;
      return true;
    });
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => backKey.handle());
    return () => subscription.remove();
  }, [backKey]);

  function exit() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function closeReading() {
    setReading(null);
    setPendingMessage(null);
  }

  function stopSelecting() {
    setSelecting(false);
    setSelectedIds([]);
  }

  function quoteHeader(message: MailMessage): string {
    const name = senderName(message.from) || t('mail.unknownSender');
    if (listDateKind(message.date) === 'none') return t('mail.quoteHeaderNoDate', { name });
    return t('mail.quoteHeader', {
      date: t('mail.message.dateAt', {
        date: formatLongDate(language, message.date),
        time: formatTime(language, message.date),
      }),
      name,
    });
  }

  function reply(target: MailMessage | null, everyone: boolean) {
    if (!target) return;
    void compose.start(
      replyCompose(target, { all: everyone, own, quoteHeader: quoteHeader(target) }),
    );
  }

  function forward(target: MailMessage | null) {
    if (target) void compose.start(forwardCompose(target));
  }

  function newMail() {
    const from = activePlace.mailAccountId ?? firstMailbox;
    const state: ComposeState = emptyCompose(from);
    void compose.start(state);
  }

  function openMove(list: readonly MailMessage[], leave: boolean) {
    const [first] = list;
    if (!first) return;
    const roles = commonRoles(
      rolesByMailbox,
      list.map((message) => message.mailAccountId),
    ).filter((role) => role !== first.folderRole);
    setPanel({ kind: 'move', messages: list, roles, leave });
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  function runCommand(thread: MailThread, command: ThreadCommand) {
    const full = conversationOf(messages, thread.id, activePlace.role);
    switch (command) {
      case 'open':
        if (activePlace.role === 'drafts') void compose.start(draftCompose(thread.latest));
        else {
          setPendingMessage(null);
          setReading(thread.id);
        }
        return;
      case 'toggle':
        toggleSelected(thread.id);
        return;
      case 'select':
        setSelecting(true);
        setSelectedIds([thread.id]);
        return;
      case 'seen':
        void actions.setSeen(thread.messages, true);
        return;
      case 'unseen':
        void actions.setSeen([thread.latest], false);
        return;
      case 'flag':
        void actions.setFlag([thread.latest], true);
        return;
      case 'unflag':
        void actions.setFlag(thread.messages, false);
        return;
      case 'archive':
        void actions.moveTo(thread.messages, 'archive');
        return;
      case 'delete':
        void actions.remove(thread.messages);
        return;
      case 'purge':
        setPanel({ kind: 'purge', messages: thread.messages, leave: false });
        return;
      case 'reply':
        reply(replyTargetOf(full, own), false);
        return;
      case 'forward':
        forward(replyTargetOf(full, own));
        return;
      case 'move':
        openMove(thread.messages, false);
        return;
      case 'spam':
        void actions.moveTo(thread.messages, 'junk');
        return;
    }
  }

  function runSelection(command: SelectionCommand) {
    const list = selectedMessages;
    if (list.length === 0) return;
    if (command === 'move') {
      openMove(list, false);
      stopSelecting();
      return;
    }
    stopSelecting();
    if (command === 'archive') void actions.moveTo(list, 'archive');
    if (command === 'read') void actions.setSeen(list, true);
    if (command === 'delete') {
      if (activePlace.role === 'trash') setPanel({ kind: 'purge', messages: list, leave: false });
      else void actions.remove(list);
    }
  }

  function rowInfo(thread: MailThread): RowInfo {
    const roles = rolesFor(thread.latest.mailAccountId);
    const box = mailboxes.find((entry) => entry.id === thread.latest.mailAccountId);
    return {
      swipeAway: swipeAwayOf(activePlace.role, roles),
      canSpam: roles.includes('junk') && activePlace.role !== 'junk',
      mailboxLabel:
        activePlace.mailAccountId === null && mailboxes.length > 1 && box
          ? mailboxShortName(box.email)
          : null,
    };
  }

  async function refresh() {
    setRefreshing(true);
    await sync.syncNow();
    setRefreshing(false);
  }

  const failing = mailboxes.filter(
    (box) =>
      box.lastError && (activePlace.mailAccountId === null || box.id === activePlace.mailAccountId),
  );
  const status = (
    <View style={{ gap: theme.spacing.sm }}>
      {sync.syncing && messages.length === 0 && mailboxes.length > 0 ? (
        <StatusLine text={t('mailui.status.loading')} />
      ) : null}
      {sync.failure === 'offline' ? (
        <StatusLine text={t('mailui.status.offline')} />
      ) : sync.failure ? (
        <StatusLine text={t(mailErrorKey(sync.failure))} />
      ) : null}
      {failing.map((box) => (
        <StatusLine
          key={box.id}
          danger
          text={problemText(box, t)}
          actionLabel={t('mailui.fix.action')}
          onPress={() => setPanel({ kind: 'fix', mailboxId: box.id })}
        />
      ))}
    </View>
  );

  const selectionAway = threads
    .filter((thread) => selected.has(thread.id))
    .map((thread) => swipeAwayOf(activePlace.role, rolesFor(thread.latest.mailAccountId)));

  let screen: React.ReactElement;
  let draftBottom = insets.bottom + theme.spacing.lg + FLOATING_BUTTON_SIZE + theme.spacing.md;

  if (conversation.length > 0 && readingThread) {
    const here = conversation.filter((message) => message.folderRole === readingRole);
    const acting = here.length > 0 ? here : conversation;
    const latest = acting[acting.length - 1] ?? null;
    const target = replyTargetOf(conversation, own);
    const flagged = acting.some((message) => message.flagged);
    const inTrash = readingRole === 'trash';
    const neighbours = reading ? neighboursOf(threads, reading) : { previous: null, next: null };
    const leave = () => {
      setPendingMessage(null);
      setReading(neighbours.next);
    };
    const subject =
      (conversation[conversation.length - 1]?.subject ?? '').trim() || t('mail.noSubject');
    draftBottom = insets.bottom + HIT_TARGET + theme.spacing.sm * 2 + theme.spacing.md;

    screen = (
      <ConversationScreen
        key={readingThread}
        messages={conversation}
        subject={subject}
        backLabel={t(FOLDER_LABEL_KEYS[readingRole])}
        onBack={closeReading}
        mailboxes={mailboxes}
        own={own}
        previous={neighbours.previous ? () => setReading(neighbours.previous) : null}
        next={neighbours.next ? () => setReading(neighbours.next) : null}
        canArchive={
          latest !== null && swipeAwayOf(readingRole, rolesFor(latest.mailAccountId)) === 'archive'
        }
        inTrash={inTrash}
        flagged={flagged}
        onArchive={() => void actions.moveTo(acting, 'archive').then((ok) => ok && leave())}
        onMove={() => openMove(acting, true)}
        onReply={(everyone) => reply(target, everyone)}
        onForward={() => forward(target)}
        onFlag={() => void actions.setFlag(flagged ? acting : latest ? [latest] : [], !flagged)}
        onUnread={() => {
          if (latest) void actions.setSeen([latest], false);
          closeReading();
        }}
        onDelete={() => {
          if (inTrash) setPanel({ kind: 'purge', messages: acting, leave: true });
          else void actions.remove(acting).then((ok) => ok && leave());
        }}
        onMarkRead={(ids) =>
          void actions.setSeen(
            conversation.filter((message) => ids.includes(message.id)),
            true,
          )
        }
        onOpenAttachment={(message, index) => setAttachment({ message, index })}
        onReload={() => void sync.syncNow()}
      />
    );
  } else if (level === 'mailboxes') {
    draftBottom = insets.bottom + theme.spacing.lg;
    screen = (
      <MailboxesScreen
        mailboxes={mailboxes}
        messages={messages}
        onOpen={(next) => {
          setPlace(next);
          setFilter(null);
          setSearch('');
          stopSelecting();
          setLevel('inbox');
        }}
        onExit={exit}
        onManage={() => setPanel({ kind: 'accounts', startInForm: false, preset: null, email: '' })}
        onFix={(box) => setPanel({ kind: 'fix', mailboxId: box.id })}
      />
    );
  } else {
    const box = activePlace.mailAccountId
      ? mailboxes.find((entry) => entry.id === activePlace.mailAccountId)
      : undefined;
    screen = (
      <InboxScreen
        title={t(FOLDER_LABEL_KEYS[activePlace.role])}
        overline={box && mailboxes.length > 1 ? box.email : null}
        role={activePlace.role}
        threads={threads}
        setup={
          loaded && mailboxes.length === 0 ? (
            <NoMailbox
              onChoose={(choice) =>
                setPanel({ kind: 'accounts', startInForm: true, preset: choice, email: '' })
              }
            />
          ) : null
        }
        status={status}
        loading={!loaded || (sync.syncing && messages.length === 0) || all.loading}
        search={search}
        onSearch={setSearch}
        filter={filter}
        onFilter={setFilter}
        previewLines={previewLines}
        onPreviewLines={setPreviewLines}
        selecting={selecting}
        selected={selected}
        onSelecting={(on) => (on ? setSelecting(true) : stopSelecting())}
        onSelectAll={() =>
          setSelectedIds(selected.size === threads.length ? [] : threads.map((thread) => thread.id))
        }
        selection={{
          canArchive: selectionAway.length > 0 && selectionAway.every((away) => away === 'archive'),
          purge: activePlace.role === 'trash',
        }}
        onSelectionCommand={runSelection}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        rowInfo={rowInfo}
        onCommand={runCommand}
        onCompose={newMail}
        onMailboxes={() => {
          stopSelecting();
          setLevel('mailboxes');
        }}
      />
    );
  }

  const session = compose.session;
  const fixBox =
    panel.kind === 'fix' ? (mailboxes.find((box) => box.id === panel.mailboxId) ?? null) : null;

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      {screen}

      {session && !session.open ? (
        <DraftBar subject={session.state.subject} bottom={draftBottom} onOpen={compose.reopen} />
      ) : null}

      {session ? (
        <ComposeSheet
          visible={session.open}
          state={session.state}
          initial={session.initial}
          mailboxes={mailboxes}
          messages={messages}
          contactNames={(people.data ?? []).map((person) => person.name)}
          own={own}
          busy={compose.busy}
          error={compose.error}
          onChange={compose.change}
          onSend={() => void compose.send()}
          onMinimize={compose.minimize}
          onClose={compose.close}
          onSaveAndClose={() => void compose.saveAndClose()}
          onDiscard={() => void compose.discard()}
        />
      ) : null}

      <MoveSheet
        visible={panel.kind === 'move'}
        targets={panel.kind === 'move' ? panel.roles : []}
        onMove={(role) => {
          if (panel.kind !== 'move') return;
          const { messages: moving, leave } = panel;
          setPanel({ kind: 'none' });
          void actions.moveTo(moving, role).then((ok) => {
            if (ok && leave) closeReading();
          });
        }}
        onClose={() => setPanel({ kind: 'none' })}
      />
      <ConfirmSheet
        visible={panel.kind === 'purge'}
        title={t('mailui.purge.title')}
        body={t('mailui.purge.body')}
        confirmLabel={t('mailui.action.purge')}
        onConfirm={() => {
          if (panel.kind !== 'purge') return;
          const { messages: purging, leave } = panel;
          setPanel({ kind: 'none' });
          void actions.purge(purging).then((ok) => {
            if (ok && leave) closeReading();
          });
        }}
        onClose={() => setPanel({ kind: 'none' })}
      />
      <FixSheet
        mailbox={fixBox}
        onClose={() => setPanel({ kind: 'none' })}
        onReconnect={(email) =>
          setPanel({ kind: 'accounts', startInForm: true, preset: null, email })
        }
      />
      <AccountsSheet
        visible={panel.kind === 'accounts'}
        mailboxes={mailboxes}
        startInForm={panel.kind === 'accounts' && panel.startInForm}
        preset={panel.kind === 'accounts' ? panel.preset : null}
        {...(panel.kind === 'accounts' && panel.email ? { initialEmail: panel.email } : {})}
        onClose={() => setPanel({ kind: 'none' })}
      />
      <AttachmentPreview
        message={attachment?.message ?? null}
        index={attachment?.index ?? null}
        onClose={() => setAttachment(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
