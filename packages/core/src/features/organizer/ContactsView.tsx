import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { contacts as contactRepo, dayKey, useLiveQuery, type ContactRow } from '@/db';
import { formatDateValue, parseDateValue } from '@/features/calendar/dates';
import { nextBirthday, parseDay, relativeDay } from '@/features/shared/days';
import { formatShortDate, useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
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

/** Geburtstage in dieser Spanne stehen oben. */
export const BIRTHDAY_DAYS = 30;

type Editor = { mode: 'new' } | { mode: 'edit'; row: ContactRow } | null;

/** Menschen, Geburtstage, und wann man sich zuletzt gesehen hat. */
export function ContactsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [editor, setEditor] = useState<Editor>(null);

  const list = useLiveQuery(() => contactRepo.list(account.id), [account.id]);
  const rows = list.data ?? [];
  const birthdays = rows
    .flatMap((row) => (row.birthday ? [{ row, next: nextBirthday(row.birthday) }] : []))
    .filter((entry) => entry.next.days <= BIRTHDAY_DAYS)
    .sort((a, b) => a.next.days - b.next.days);

  function subtitleOf(row: ContactRow): string | undefined {
    if (row.lastSeenOn) {
      return t('contacts.lastSeen', { when: relativeDay(t, language, row.lastSeenOn) });
    }
    if (row.birthday) return formatShortDate(language, parseDay(row.birthday).toISOString());
    return undefined;
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t(rows.length === 1 ? 'contacts.count.one' : 'contacts.count', {
            count: rows.length,
          })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState title={t('contacts.empty.title')} body={t('contacts.empty.body')} />
      ) : null}

      {birthdays.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('contacts.birthdays')}
          </Text>
          <Card>
            {birthdays.map(({ row, next }, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow onDelete={() => void contactRepo.remove(row.id)}>
                  <ListItem
                    title={row.name}
                    icon="gift"
                    subtitle={t('contacts.turns', { age: next.age })}
                    right={
                      <Text variant="label" tone={next.days === 0 ? 'accent' : 'muted'}>
                        {relativeDay(t, language, next.day)}
                      </Text>
                    }
                    onPress={() => setEditor({ mode: 'edit', row })}
                  />
                </SwipeRow>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {rows.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          {birthdays.length > 0 ? (
            <Text variant="section" tone="muted">
              {t('contacts.everyone')}
            </Text>
          ) : null}
          <Card>
            {rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow onDelete={() => void contactRepo.remove(row.id)}>
                  <ListItem
                    title={row.name}
                    subtitle={subtitleOf(row)}
                    showChevron
                    onPress={() => setEditor({ mode: 'edit', row })}
                  />
                </SwipeRow>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <FloatingButton label={t('contacts.add')} onPress={() => setEditor({ mode: 'new' })} />

      <ContactEditor
        key={editor?.mode === 'edit' ? editor.row.id : (editor?.mode ?? 'closed')}
        editor={editor}
        accountId={account.id}
        onClose={() => setEditor(null)}
      />
    </Screen>
  );
}

function ContactEditor({
  editor,
  accountId,
  onClose,
}: {
  editor: Editor;
  accountId: string;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const existing = editor?.mode === 'edit' ? editor.row : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [birthdayText, setBirthdayText] = useState(
    existing?.birthday ? formatDateValue(parseDay(existing.birthday)) : '',
  );
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<'name' | 'birthday' | null>(null);

  async function save() {
    if (name.trim().length === 0) {
      setError('name');
      return;
    }
    const parsed = birthdayText.trim().length > 0 ? parseDateValue(birthdayText) : null;
    if (birthdayText.trim().length > 0 && !parsed) {
      setError('birthday');
      return;
    }
    const birthday = parsed ? dayKey(parsed) : null;
    if (existing) {
      await contactRepo.update(existing.id, { name, birthday, phone, note });
    } else {
      await contactRepo.add({ accountId, name, birthday, phone, note });
    }
    onClose();
  }

  async function seenToday() {
    if (!existing) return;
    await contactRepo.update(existing.id, { lastSeenOn: dayKey() });
    onClose();
  }

  async function remove() {
    if (existing) await contactRepo.remove(existing.id);
    onClose();
  }

  return (
    <Sheet
      visible={editor !== null}
      onClose={onClose}
      title={existing ? t('contacts.detail') : t('contacts.add')}
      subtitle={
        existing?.lastSeenOn
          ? t('contacts.lastSeen', { when: relativeDay(t, language, existing.lastSeenOn) })
          : undefined
      }
    >
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={t('contacts.name')}
          placeholder={t('contacts.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          {...(error === 'name' ? { error: t('contacts.error.name') } : {})}
        />
        <Input
          label={t('contacts.birthday')}
          placeholder={t('contacts.birthdayPlaceholder')}
          value={birthdayText}
          onChangeText={setBirthdayText}
          keyboardType="numbers-and-punctuation"
          {...(error === 'birthday' ? { error: t('contacts.birthdayError') } : {})}
        />
        <Input
          label={t('contacts.phone')}
          placeholder={t('common.optional')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Input
          label={t('contacts.note')}
          placeholder={t('common.optional')}
          value={note}
          onChangeText={setNote}
          autoCapitalize="sentences"
        />

        <View style={{ gap: theme.spacing.sm }}>
          <Button label={t('common.done')} icon="check" onPress={save} />
          {existing ? (
            <Button
              label={t('contacts.seenToday')}
              variant="secondary"
              icon="people"
              onPress={seenToday}
            />
          ) : null}
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
