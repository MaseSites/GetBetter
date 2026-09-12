import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  documents as documentRepo,
  useLiveQuery,
  type DocumentCategory,
  type DocumentRow,
} from '@/db';
import { DayPicker } from '@/features/shared/DayPicker';
import { daysUntil, relativeDay } from '@/features/shared/days';
import { useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  FloatingButton,
  Header,
  Icon,
  Input,
  ListItem,
  Screen,
  Sheet,
  SwipeRow,
  Text,
} from '@/ui';

const CATEGORIES: readonly DocumentCategory[] = [
  'contract',
  'insurance',
  'warranty',
  'id',
  'other',
];

/** Ab wann ein Ablaufdatum oben unter "Laeuft bald ab" steht. */
export const SOON_DAYS = 60;

type Editor = { mode: 'new' } | { mode: 'edit'; row: DocumentRow } | null;

/** Dokumente nach Art, oben was bald ablaeuft. Kein Scan, nur das Datum. */
export function DocumentsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [editor, setEditor] = useState<Editor>(null);

  const list = useLiveQuery(() => documentRepo.list(account.id), [account.id]);
  const rows = list.data ?? [];
  const soon = rows.filter(
    (row) => row.expiresOn !== null && daysUntil(row.expiresOn) <= SOON_DAYS,
  );
  const groups = CATEGORIES.map((category) => ({
    category,
    rows: rows.filter((row) => row.category === category),
  })).filter((group) => group.rows.length > 0);

  const categoryLabel = (category: DocumentCategory) =>
    t(`documents.category.${category}` as TranslationKey);

  function expiryLabel(row: DocumentRow): { text: string; tone: 'muted' | 'danger' | 'faint' } {
    if (!row.expiresOn) return { text: t('documents.noExpiry'), tone: 'faint' };
    const diff = daysUntil(row.expiresOn);
    if (diff < 0) return { text: t('documents.expired'), tone: 'danger' };
    return {
      text: relativeDay(t, language, row.expiresOn),
      tone: diff <= SOON_DAYS ? 'danger' : 'muted',
    };
  }

  const countText = t(rows.length === 1 ? 'documents.count.one' : 'documents.count', {
    count: rows.length,
  });
  const soonText = t(soon.length === 1 ? 'documents.soonCount.one' : 'documents.soonCount', {
    count: soon.length,
  });
  const subtitle = soon.length > 0 ? `${countText} · ${soonText}` : countText;

  /** Eine Zeile — nach links wischen loescht, der Tipp oeffnet das Blatt. */
  function row(item: DocumentRow) {
    const expiry = expiryLabel(item);
    return (
      <SwipeRow onDelete={() => void documentRepo.remove(item.id)}>
        <ListItem
          title={item.title}
          subtitle={item.note ?? categoryLabel(item.category)}
          right={
            <Text variant="label" tone={expiry.tone}>
              {expiry.text}
            </Text>
          }
          onPress={() => setEditor({ mode: 'edit', row: item })}
        />
      </SwipeRow>
    );
  }

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
    >
      {rows.length === 0 ? (
        <EmptyState title={t('documents.empty.title')} body={t('documents.empty.body')} />
      ) : null}

      {soon.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="danger">
            {t('documents.soon')}
          </Text>
          <Card>
            {soon.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                {row(item)}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.category} style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {categoryLabel(group.category)}
          </Text>
          <Card>
            {group.rows.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                {row(item)}
              </View>
            ))}
          </Card>
        </View>
      ))}

      <FloatingButton label={t('documents.add')} onPress={() => setEditor({ mode: 'new' })} />

      <DocumentEditor
        key={editor?.mode === 'edit' ? editor.row.id : (editor?.mode ?? 'closed')}
        editor={editor}
        accountId={account.id}
        onClose={() => setEditor(null)}
      />
    </Screen>
  );
}

function DocumentEditor({
  editor,
  accountId,
  onClose,
}: {
  editor: Editor;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const existing = editor?.mode === 'edit' ? editor.row : null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<DocumentCategory>(existing?.category ?? 'contract');
  const [expiresOn, setExpiresOn] = useState<string | null>(existing?.expiresOn ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState(false);

  async function save() {
    if (title.trim().length === 0) {
      setError(true);
      return;
    }
    if (existing) {
      await documentRepo.update(existing.id, { title, category, expiresOn, note });
    } else {
      await documentRepo.add({ accountId, title, category, expiresOn, note });
    }
    onClose();
  }

  async function remove() {
    if (existing) await documentRepo.remove(existing.id);
    onClose();
  }

  return (
    <Sheet
      visible={editor !== null}
      onClose={onClose}
      title={existing ? t('documents.edit') : t('documents.add')}
    >
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={t('documents.title')}
          placeholder={t('documents.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          autoCapitalize="sentences"
          {...(error ? { error: t('money.error.name') } : {})}
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('documents.category')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {CATEGORIES.map((entry) => (
              <Chip
                key={entry}
                label={t(`documents.category.${entry}` as TranslationKey)}
                selected={category === entry}
                onPress={() => setCategory(entry)}
              />
            ))}
          </View>
        </View>

        <DayPicker label={t('documents.expires')} value={expiresOn} onChange={setExpiresOn} />

        <Input
          label={t('documents.note')}
          placeholder={t('common.optional')}
          value={note}
          onChangeText={setNote}
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t('common.done')} icon="check" onPress={save} />
          {existing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.remove')}
              onPress={remove}
              style={[
                styles.removeRow,
                { gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
              ]}
            >
              <Icon name="trash" size={18} color={theme.colors.danger} />
              <Text variant="label" tone="danger">
                {t('common.remove')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
