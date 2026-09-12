import { useState } from 'react';
import { View } from 'react-native';

import { contacts as contactRepo, type ContactRow } from '@/db';
import { parseDay } from '@/features/shared/days';
import { formatDayMonth, localeFor, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Input, Sheet, Text, Wheel, WheelFrame } from '@/ui';

import { birthdayKey, daysInMonth } from './birthdays';

export type BirthdayDraft = {
  /** Gesetzt beim Bearbeiten, leer beim Anlegen. */
  contact?: ContactRow;
  /** Vorgeschlagener Tag — etwa der, auf dem man im Kalender stand. */
  day?: Date;
};

/** So weit zurueck reicht das Jahresrad. */
const FIRST_YEAR = 1900;
/** Ohne bekanntes Jahr steht das Rad auf einem mittleren Alter statt auf 1900. */
const DEFAULT_AGE = 30;

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/**
 * Name, Tag und Notiz eines Geburtstags. Er landet beim Kontakt: gibt es den
 * Kontakt schon, bekommt er das Datum; sonst entsteht er dafuer. Dieselbe
 * Eingabe steht im Geburtstags-Blatt und im Kalender unter „Geburtstag“.
 */
export function BirthdayForm({
  draft,
  accountId,
  onDone,
}: {
  draft: BirthdayDraft;
  accountId: string;
  onDone: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const editing = draft.contact;

  const thisYear = new Date().getFullYear();
  const born = editing?.birthday ? parseDay(editing.birthday) : null;
  const suggested = draft.day ?? new Date();

  const [name, setName] = useState(editing?.name ?? '');
  const [day, setDay] = useState(born ? born.getDate() : suggested.getDate());
  const [month, setMonth] = useState(born ? born.getMonth() + 1 : suggested.getMonth() + 1);
  const [year, setYear] = useState(born ? born.getFullYear() : thisYear - DEFAULT_AGE);
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState(false);

  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, index) => FIRST_YEAR + index);
  const dayCount = daysInMonth(year, month);
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);
  // Vom 31. in den Februar: der Tag rutscht auf den letzten, den es gibt.
  const shownDay = Math.min(day, dayCount);

  const monthName = (value: number) =>
    new Intl.DateTimeFormat(localeFor(language), { month: 'short' }).format(
      new Date(2000, value - 1, 1),
    );

  const key = birthdayKey(year, month, shownDay);
  const nextAge = (() => {
    const today = new Date();
    const passed =
      month - 1 < today.getMonth() ||
      (month - 1 === today.getMonth() && shownDay < today.getDate());
    return today.getFullYear() + (passed ? 1 : 0) - year;
  })();

  async function save() {
    if (name.trim().length === 0) {
      setError(true);
      return;
    }
    if (editing) {
      await contactRepo.update(editing.id, { name, birthday: key, note });
    } else {
      await contactRepo.add({ accountId, name, birthday: key, note });
    }
    onDone();
  }

  async function remove() {
    if (editing) await contactRepo.removeBirthday(editing.id);
    onDone();
  }

  return (
    <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
      <Input
        label={t('birthdays.name')}
        placeholder={t('birthdays.namePlaceholder')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(false);
        }}
        autoCapitalize="words"
        {...(error ? { error: t('birthdays.error.name') } : {})}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" tone="muted">
          {t('birthdays.date')}
        </Text>
        <WheelFrame>
          <Wheel
            values={days}
            value={shownDay}
            onChange={setDay}
            label={t('birthdays.day')}
            width={72}
            loop
          />
          <Wheel
            values={MONTHS}
            value={month}
            onChange={setMonth}
            label={t('birthdays.month')}
            format={monthName}
            width={112}
            loop
          />
          <Wheel
            values={years}
            value={year}
            onChange={setYear}
            label={t('birthdays.year')}
            format={String}
            width={96}
          />
        </WheelFrame>
        <Text variant="caption" tone="faint" align="center">
          {nextAge > 0
            ? t('birthdays.preview', {
                age: nextAge,
                date: formatDayMonth(language, parseDay(key)),
              })
            : t('birthdays.previewBorn')}
        </Text>
      </View>

      <Input
        label={t('birthdays.note')}
        placeholder={t('birthdays.notePlaceholder')}
        value={note}
        onChangeText={setNote}
        multiline
        autoCapitalize="sentences"
      />

      <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
        <Button label={t('common.done')} icon="check" onPress={() => void save()} />
        {editing ? (
          <Button
            label={t('birthdays.remove')}
            variant="danger"
            icon="trash"
            onPress={() => void remove()}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Das Blatt drumherum — fuer die Geburtstage selbst und fuer den Kalender. */
export function BirthdayEditor({
  draft,
  accountId,
  onClose,
}: {
  draft: BirthdayDraft | null;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const formKey = draft?.contact?.id ?? (draft?.day ? draft.day.toISOString() : 'new');

  return (
    <Sheet
      visible={draft !== null}
      onClose={onClose}
      title={draft?.contact ? t('birthdays.edit') : t('birthdays.add')}
      fullScreen
    >
      {draft ? (
        <BirthdayForm key={formKey} draft={draft} accountId={accountId} onDone={onClose} />
      ) : null}
    </Sheet>
  );
}
