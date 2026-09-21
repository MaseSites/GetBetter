import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { contacts as contactRepo, useLiveQuery, type ContactRow } from '@/db';
import { canPickImage, pickImage } from '@/features/personalize/pickImage';
import { uploadBackdrop } from '@/features/personalize/uploads';
import { parseDay } from '@/features/shared/days';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';
import {
  HIT_TARGET,
  Icon,
  PlainList,
  PlainRow,
  Sheet,
  Text,
  Wheel,
  WheelFrame,
  useUndo,
} from '@/ui';

import { dayCountOf, draftBirthdayKey, previewOf, suggestContacts } from './birthdays';
import { DangerAction } from './DangerAction';
import { formatDayMonthLong, formatLongDay, monthName } from './format';
import { AVATAR, PersonAvatar } from './PersonAvatar';
import { SheetHeader } from './SheetHeader';
import { useBirthdayActions } from './useBirthdayActions';

export type BirthdayDraft = {
  /** Gesetzt beim Bearbeiten — auch ein Kontakt, der noch keinen Geburtstag hat. */
  contact?: ContactRow;
  /** Vorgeschlagener Tag — etwa der, auf dem man im Kalender stand. */
  day?: Date;
};

/** So weit zurueck reicht das Jahresrad. */
const FIRST_YEAR = 1900;
/**
 * Der Platz „ohne Jahr“ ganz unten auf dem Jahresrad — gleich unter dem
 * laufenden Jahr, damit die naechsten Jahre nur ein Stueck weit weg sind.
 */
const NO_YEAR = 0;
const NO_YEAR_LABEL = '—';
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const WHEEL_WIDTH = { day: 72, month: 136, year: 88 } as const;

type PhotoState = { id: string | null; busy: boolean; failed: boolean };
type DateState = { day: number; month: number; yearKnown: boolean; year: number };

function dateOf(contact: ContactRow | undefined, fallback: Date): DateState {
  const thisYear = new Date().getFullYear();
  if (contact?.birthday) {
    const born = parseDay(contact.birthday);
    const yearKnown = contact.birthYearKnown !== false;
    return {
      day: born.getDate(),
      month: born.getMonth() + 1,
      yearKnown,
      year: yearKnown ? born.getFullYear() : thisYear,
    };
  }
  // Das Jahr ist freiwillig und hat keine Vorgabe: der Schalter steht auf aus.
  return {
    day: fallback.getDate(),
    month: fallback.getMonth() + 1,
    yearKnown: false,
    year: thisYear,
  };
}

/** Der Stand des Formulars — geteilt vom Blatt und vom Kalender. */
function useBirthdayForm(draft: BirthdayDraft, accountId: string) {
  const celebrate = useCelebrate();
  const { t } = useI18n();
  const undo = useUndo();

  const [name, setName] = useState(draft.contact?.name ?? '');
  const [linked, setLinked] = useState<ContactRow | null>(draft.contact ?? null);
  const [photo, setPhoto] = useState<PhotoState>({
    id: draft.contact?.photoUploadId ?? null,
    busy: false,
    failed: false,
  });
  const [date, setDate] = useState<DateState>(() => dateOf(draft.contact, draft.day ?? new Date()));

  const list = useLiveQuery(() => contactRepo.list(accountId), [accountId]);
  const rows = list.data ?? [];

  const year = date.yearKnown ? date.year : null;
  const dayCount = dayCountOf(date.month, year);
  // Vom 31. in den Februar: der Tag rutscht auf den letzten, den es gibt.
  const day = Math.min(date.day, dayCount);
  const canSave = name.trim().length > 0 && !photo.busy;
  const suggestions = linked ? [] : suggestContacts(rows, name);

  function changeName(value: string) {
    setName(value);
    // Wer den Namen ganz loescht, meint den vorgeschlagenen Kontakt nicht mehr.
    if (value.trim().length === 0 && linked && linked.id !== draft.contact?.id) setLinked(null);
  }

  /** Ein Vorschlag uebernimmt Name, Foto und Datum — und haengt sich an diesen Kontakt. */
  function pick(contact: ContactRow) {
    setLinked(contact);
    setName(contact.name);
    setPhoto({ id: contact.photoUploadId ?? null, busy: false, failed: false });
    if (contact.birthday) setDate(dateOf(contact, new Date()));
  }

  async function choosePhoto() {
    let dataUrl: string | null;
    try {
      dataUrl = await pickImage();
    } catch {
      setPhoto((current) => ({ ...current, failed: true }));
      return;
    }
    if (!dataUrl) return;
    setPhoto((current) => ({ ...current, busy: true, failed: false }));
    const result = await uploadBackdrop(accountId, dataUrl);
    setPhoto((current) =>
      result.ok
        ? { id: result.id, busy: false, failed: false }
        : { ...current, busy: false, failed: true },
    );
  }

  /** Sichert: an den gewaehlten Kontakt, sonst entsteht einer. `false` ohne Namen. */
  async function save(): Promise<boolean> {
    if (!canSave) return false;
    const patch = {
      name,
      birthday: draftBirthdayKey(date.month, day, year),
      birthYearKnown: date.yearKnown,
      photoUploadId: photo.id,
    };
    // Beim allerersten Geburtstag sagt die App einmal, woran sie denkt.
    const first = !list.loading && !rows.some((row) => row.birthday);
    if (linked) {
      await contactRepo.update(linked.id, patch);
    } else {
      await contactRepo.add({ accountId, ...patch });
      celebrate('birthday');
    }
    if (first) undo.show({ message: t('birthdays.form.firstSaved') });
    return true;
  }

  return {
    name,
    changeName,
    photo,
    choosePhoto,
    date,
    setDay: (value: number) => setDate((current) => ({ ...current, day: value })),
    setMonth: (value: number) => setDate((current) => ({ ...current, month: value })),
    // „—“ heisst ohne Jahr; jede andere Zahl ist ein bekanntes Jahr.
    setYear: (value: number) =>
      setDate((current) =>
        value === NO_YEAR
          ? { ...current, yearKnown: false }
          : { ...current, yearKnown: true, year: value },
      ),
    year,
    day,
    dayCount,
    canSave,
    suggestions,
    pick,
    save,
  };
}

type FormApi = ReturnType<typeof useBirthdayForm>;

/** Foto, Name mit Vorschlaegen, Tag und Monat, „Jahr bekannt“ und die Vorschau. */
function BirthdayFields({ form }: { form: FormApi }) {
  const { t, language } = useI18n();
  const theme = useTheme();

  const thisYear = new Date().getFullYear();
  const years = [
    ...Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, index) => FIRST_YEAR + index),
    NO_YEAR,
  ];
  const days = Array.from({ length: form.dayCount }, (_, index) => index + 1);

  const preview = previewOf(form.date.month, form.day, form.year);
  const longDate = formatLongDay(language, preview.day);
  const previewText =
    preview.age !== null
      ? t('birthdays.turnsOn', { age: preview.age, date: longDate })
      : form.year !== null
        ? t('birthdays.previewBorn')
        : t('birthdays.birthdayOn', { date: longDate });

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.sm }}>
        <View style={[styles.row, { gap: theme.spacing.md }]}>
          <PhotoButton form={form} />
          <TextInput
            autoFocus
            value={form.name}
            onChangeText={form.changeName}
            placeholder={t('birthdays.form.namePlaceholder')}
            placeholderTextColor={theme.colors.textFaint}
            accessibilityLabel={t('birthdays.name')}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            style={[
              styles.name,
              {
                minHeight: HIT_TARGET + theme.spacing.xs,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.sm,
                paddingHorizontal: theme.spacing.md,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                fontFamily: theme.fontFamily,
                fontSize: theme.fontSize.lg,
              },
            ]}
          />
        </View>
        {form.photo.failed ? (
          <Text variant="caption" tone="danger">
            {t('birthdays.form.photoError')}
          </Text>
        ) : null}
        {form.suggestions.length > 0 ? (
          <PlainList>
            {form.suggestions.map((contact) => (
              <PlainRow
                key={contact.id}
                leading={
                  <PersonAvatar
                    name={contact.name}
                    photoUploadId={contact.photoUploadId}
                    size={AVATAR.suggestion}
                  />
                }
                title={
                  contact.birthday
                    ? t('birthdays.form.suggestion', {
                        name: contact.name,
                        date: formatDayMonthLong(language, contact.birthday),
                      })
                    : contact.name
                }
                onPress={() => form.pick(contact)}
              />
            ))}
          </PlainList>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <WheelFrame>
          <Wheel
            values={days}
            value={form.day}
            onChange={form.setDay}
            label={t('birthdays.day')}
            width={WHEEL_WIDTH.day}
            loop
          />
          <Wheel
            values={MONTHS}
            value={form.date.month}
            onChange={form.setMonth}
            label={t('birthdays.month')}
            format={(value) => monthName(language, value)}
            width={WHEEL_WIDTH.month}
            loop
          />
          {/* Das Jahr steht immer da, gleich neben Tag und Monat — „—“ heisst ohne. */}
          <Wheel
            values={years}
            value={form.date.yearKnown ? form.date.year : NO_YEAR}
            onChange={form.setYear}
            label={t('birthdays.year')}
            format={(value) => (value === NO_YEAR ? NO_YEAR_LABEL : String(value))}
            width={WHEEL_WIDTH.year}
          />
        </WheelFrame>
        <Text variant="label" tone="muted" align="center">
          {previewText}
        </Text>
      </View>
    </View>
  );
}

/** Der Kreis links vom Namen. Auf dem Geraet fehlt die Bildauswahl noch — dann ohne Kreis. */
function PhotoButton({ form }: { form: FormApi }) {
  const { t } = useI18n();
  const theme = useTheme();
  const size = AVATAR.form;
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: theme.colors.surfaceMuted,
  };

  const face = form.photo.busy ? (
    <View style={[styles.center, circle]}>
      <ActivityIndicator color={theme.colors.textMuted} />
    </View>
  ) : form.photo.id ? (
    <PersonAvatar name={form.name} photoUploadId={form.photo.id} size={size} />
  ) : (
    <View style={[styles.center, circle]}>
      <Icon name="image" size={22} color={theme.colors.textMuted} />
    </View>
  );

  if (!canPickImage()) return form.photo.id ? face : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('birthdays.form.photo')}
      onPress={() => void form.choosePhoto()}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {face}
    </Pressable>
  );
}

/**
 * Das Blatt „Person hinzufügen“ bzw. „Geburtstag bearbeiten“ — mittelhoch,
 * „Sichern“ oben rechts. Schliessen sichert, sobald ein Name da ist.
 */
export function BirthdayEditor({
  draft,
  accountId,
  onClose,
}: {
  draft: BirthdayDraft | null;
  accountId: string;
  onClose: () => void;
}) {
  if (!draft) return null;
  const key = draft.contact?.id ?? (draft.day ? draft.day.toISOString() : 'new');
  return <EditorSheet key={key} draft={draft} accountId={accountId} onClose={onClose} />;
}

function EditorSheet({
  draft,
  accountId,
  onClose,
}: {
  draft: BirthdayDraft;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const form = useBirthdayForm(draft, accountId);
  const actions = useBirthdayActions();

  const existing = draft.contact?.birthday ? draft.contact : null;
  const title = existing
    ? t('birthdays.form.titleEdit')
    : draft.contact
      ? t('birthdays.add')
      : t('birthdays.addPerson');

  async function saveAndClose() {
    try {
      await form.save();
    } finally {
      onClose();
    }
  }

  function remove() {
    if (!existing) return;
    onClose();
    void actions.removeBirthday(existing.id);
  }

  return (
    <Sheet
      visible
      onClose={() => void saveAndClose()}
      detent="medium"
      header={
        <SheetHeader
          title={title}
          saveLabel={t('birthdays.form.save')}
          canSave={form.canSave}
          onSave={() => void saveAndClose()}
        />
      }
    >
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <BirthdayFields form={form} />
        {existing ? <DangerAction label={t('birthdays.removeBirthday')} onPress={remove} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  name: {
    flex: 1,
    borderWidth: 1,
    // Der Browser zeichnet sonst einen eigenen Fokusrahmen ueber unseren.
    outlineStyle: 'none' as never,
  },
});
