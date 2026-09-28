import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  chatMessages as messageRepo,
  chats as chatRepo,
  dayKey,
  useLiveQuery,
  type ChatRow,
} from '@/db';
import { relativeDay } from '@/features/shared/days';
import { useI18n } from '@/i18n';
import { AI_CHAT_STARTER_KEYS } from '@/mocks/aiChat';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  ComposeBar,
  ContextMenu,
  EmptyState,
  Header,
  Icon,
  Input,
  Screen,
  Sheet,
  SuggestionChip,
  SwipeRow,
  Text,
} from '@/ui';

import { filterChats, SEARCH_FROM } from './chatList';

/**
 * Die Startseite von BetterAi: die Gespraeche, das Neueste zuerst, im Aussehen
 * des Kontos. Unten das Feld: wer tippt, faengt ein neues Gespraech an; die
 * Vorschlaege darueber tun dasselbe mit einem Tipp.
 */
export function ChatsView() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<ChatRow | null>(null);

  const list = useLiveQuery(() => chatRepo.list(account.id), [account.id]);
  const latest = useLiveQuery(() => messageRepo.latest(account.id), [account.id]);
  const everything = useLiveQuery(() => messageRepo.listAll(account.id), [account.id]);
  const rows = list.data ?? [];
  const previews = latest.data ?? new Map();
  // Angeheftete oben; mit Suche nur, was im Titel oder einer Nachricht passt.
  const shown = filterChats(rows, everything.data ?? [], query);
  const searching = query.trim().length > 0;

  async function startChat(firstMessage?: string) {
    const created = await chatRepo.create(account.id);
    if (firstMessage) {
      await messageRepo.add({
        chatId: created.id,
        accountId: account.id,
        role: 'user',
        text: firstMessage,
      });
      // Die Antwort holt das Gespraech selbst, sobald es offen ist — mit Denkanzeige.
    }
    router.push(`/chat/${created.id}`);
  }

  function send() {
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft('');
    void startChat(text);
  }

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <Header
          large
          crumb={{ label: t('tabs.assistant') }}
          title={t('chats.title')}
          subtitle={t(rows.length === 1 ? 'chats.count.one' : 'chats.count', {
            count: rows.length,
          })}
          actions={[
            { icon: 'plus' as const, label: t('chats.new'), onPress: () => void startChat() },
          ]}
        />
      }
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {draft.length === 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: theme.spacing.sm }}
            >
              {AI_CHAT_STARTER_KEYS.map((key) => (
                <SuggestionChip key={key} label={t(key)} onPress={() => void startChat(t(key))} />
              ))}
            </ScrollView>
          ) : null}
          <ComposeBar
            value={draft}
            onChangeText={setDraft}
            onSubmit={send}
            placeholder={t('aiChat.placeholder')}
            sendLabel={t('assistant.send')}
          />
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: theme.spacing.edge,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.sm,
          justifyContent: rows.length === 0 ? 'center' : 'flex-start',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {rows.length === 0 ? (
          <EmptyState title={t('chats.empty.title')} body={t('chats.empty.body')} />
        ) : null}

        {rows.length >= SEARCH_FROM || searching ? (
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('gymplus.chats.search')}
            accessibilityLabel={t('gymplus.chats.search')}
            icon="search"
            autoCapitalize="none"
            returnKeyType="search"
          />
        ) : null}

        {searching && shown.length === 0 ? (
          <EmptyState
            title={t('gymplus.chats.noResults')}
            body={t('gymplus.chats.noResultsBody', { query: query.trim() })}
          />
        ) : null}

        {shown.map((chat) => {
          const preview = previews.get(chat.id);
          const title = chat.title || t('chats.untitled');
          const pinned = Boolean(chat.pinnedAt);
          const togglePin = () => void chatRepo.setPinned(chat.id, !pinned);
          // Nach rechts wischen heftet an, nach links loescht; ein langer Druck kann beides und mehr.
          return (
            <SwipeRow
              key={chat.id}
              radius={theme.radii.item}
              leading={{
                key: 'pin',
                label: pinned ? t('gymplus.chats.unpin') : t('gymplus.chats.pin'),
                icon: pinned ? 'pin' : 'pinFilled',
                tone: 'accent',
                onPress: togglePin,
              }}
              onDelete={() => void chatRepo.remove(chat.id)}
            >
              <ContextMenu
                accessibilityLabel={pinned ? `${t('gymplus.chats.pinned')}: ${title}` : title}
                onPress={() => router.push(`/chat/${chat.id}`)}
                items={[
                  {
                    key: 'pin',
                    label: pinned ? t('gymplus.chats.unpin') : t('gymplus.chats.pin'),
                    icon: pinned ? 'pin' : 'pinFilled',
                    onPress: togglePin,
                  },
                  {
                    key: 'rename',
                    label: t('gymplus.chats.rename'),
                    icon: 'note',
                    onPress: () => setRenaming(chat),
                  },
                  { key: 'divider', divider: true },
                  {
                    key: 'delete',
                    label: t('common.delete'),
                    icon: 'trash',
                    destructive: true,
                    onPress: () => void chatRepo.remove(chat.id),
                  },
                ]}
                style={{
                  gap: theme.spacing.xs,
                  padding: theme.spacing.lg,
                  borderRadius: theme.radii.item,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}
                >
                  {pinned ? (
                    <Icon name="pinFilled" size={14} color={theme.colors.accentMark} />
                  ) : null}
                  <Text
                    variant="label"
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: theme.fontSize.lede,
                      lineHeight: theme.lineHeight.lede,
                      fontWeight: theme.fontWeight.semibold,
                    }}
                  >
                    {title}
                  </Text>
                  <Text variant="caption" tone="faint">
                    {relativeDay(t, language, dayKey(new Date(chat.updatedAt)))}
                  </Text>
                </View>
                {preview ? (
                  <Text variant="label" tone="muted" numberOfLines={2}>
                    {preview.text}
                  </Text>
                ) : null}
              </ContextMenu>
            </SwipeRow>
          );
        })}
      </ScrollView>

      <RenameSheet chat={renaming} onClose={() => setRenaming(null)} />
    </Screen>
  );
}

/** Ein Feld, ein Knopf: der Titel eines Gespraechs, von Hand. */
function RenameSheet({ chat, onClose }: { chat: ChatRow | null; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  // Je Gespraech frisch: der Schluessel setzt das Feld zurueck.
  return (
    <Sheet visible={chat !== null} onClose={onClose} title={t('gymplus.chats.renameTitle')}>
      {chat ? <RenameForm key={chat.id} chat={chat} onClose={onClose} gap={theme.spacing.lg} /> : null}
    </Sheet>
  );
}

function RenameForm({ chat, onClose, gap }: { chat: ChatRow; onClose: () => void; gap: number }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(chat.title);

  async function save() {
    await chatRepo.rename(chat.id, title);
    onClose();
  }

  return (
    <View style={{ gap, paddingBottom: gap }}>
      <Input
        value={title}
        onChangeText={setTitle}
        placeholder={t('chats.untitled')}
        accessibilityLabel={t('gymplus.chats.rename')}
        autoCapitalize="sentences"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      <Button label={t('common.done')} icon="check" onPress={() => void save()} />
    </View>
  );
}
