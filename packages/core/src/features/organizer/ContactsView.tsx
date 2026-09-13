import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { contacts as contactRepo, dayKey, useLiveQuery, type ContactRow } from '@/db';
import { BirthdayEditor, type BirthdayDraft } from '@/features/birthdays/BirthdayEditor';
import { formatDayMonthLong } from '@/features/birthdays/format';
import { parseDay, relativeDay } from '@/features/shared/days';
import { formatShortDate, useI18n, type Language } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
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

type Editor = { mode: 'new' } | { mode: 'edit'; row: ContactRow } | null;

/** Das Geburtsdatum eines Kontakts — ohne bekanntes Jahr nur Tag und Monat. */
function birthdayText(language: Language, row: ContactRow & { birthday: string }): string {
  return row.birthYearKnown === false
    ? formatDayMonthLong(language, row.birthday)
    : formatShortDate(language, parseDay(row.birthday).toISOString());
}

/**
 * Menschen und wann man sich zuletzt gesehen hat. Geburtstage leben in der
 * Funktion „Geburtstage“; hier fuehrt nur eine Zeile im Kontakt dorthin.
 */
export function ContactsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();

  const [editor, setEditor] = useState<Editor>(null);
  const [birthday, setBirthday] = useState<BirthdayDraft | null>(null);

  const list = useLiveQuery(() => contactRepo.list(account.id), [account.id]);
  const rows = list.data ?? [];

  function subtitleOf(row: ContactRow): string | undefined {
    if (row.lastSeenOn) {
      return t('contacts.lastSeen', { when: relativeDay(t, language, row.lastSeenOn) });
    }
    if (row.birthday) return birthdayText(language, { ...row, birthday: row.birthday });
    return undefined;
  }

  return (
    <Screen
      header={
        <Header
          title={moduleName(t, module.id)}
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

      {rows.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
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
        onBirthday={(row) => {
          setEditor(null);
          setBirthday({ contact: row });
        }}
      />

      <BirthdayEditor draft={birthday} accountId={account.id} onClose={() => setBirthday(null)} />
    </Screen>
  );
}

function ContactEditor({
  editor,
  accountId,
  onClose,
  onBirthday,
}: {
  editor: Editor;
  accountId: string;
  onClose: () => void;
  /** Der Geburtstag wird mit denselben Raedern eingetragen wie in „Geburtstage“. */
  onBirthday: (row: ContactRow) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const existing = editor?.mode === 'edit' ? editor.row : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<'name' | null>(null);

  async function save() {
    if (name.trim().length === 0) {
      setError('name');
      return;
    }
    if (existing) {
      await contactRepo.update(existing.id, { name, phone, note });
    } else {
      await contactRepo.add({ accountId, name, phone, note });
    }
    onClose();
  }

  /** Ein neuer Kontakt wird erst angelegt — der Geburtstag gehoert zu ihm. */
  async function openBirthday() {
    if (name.trim().length === 0) {
      setError('name');
      return;
    }
    const row = existing
      ? await contactRepo.update(existing.id, { name, phone, note })
      : await contactRepo.add({ accountId, name, phone, note });
    if (row) onBirthday(row);
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
        <ListItem
          title={t('contacts.birthday')}
          icon="gift"
          subtitle={
            existing?.birthday
              ? birthdayText(language, { ...existing, birthday: existing.birthday })
              : t('birthdays.add')
          }
          showChevron
          onPress={() => void openBirthday()}
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
