import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  dayKey,
  pets as petRepo,
  useLiveQuery,
  type PetEventKind,
  type PetEventRow,
  type PetKind,
  type PetRow,
} from '@/db';
import { formatDateValue, parseDateValue } from '@/features/calendar/dates';
import { daysUntil, parseDay, relativeDay } from '@/features/shared/days';
import { DayPicker } from '@/features/shared/DayPicker';
import { useI18n, type TranslationKey } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  FloatingButton,
  Header,
  IconButton,
  Input,
  ListItem,
  Screen,
  Sheet,
  Text,
} from '@/ui';

const KINDS: readonly PetKind[] = ['dog', 'cat', 'rabbit', 'bird', 'fish', 'other'];
const EVENT_KINDS: readonly PetEventKind[] = ['vet', 'vaccine', 'worming', 'grooming', 'other'];

/** Wie alt ein Tier ist — in Jahren, unter einem Jahr in Monaten. */
function ageLabel(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  birthday: string,
): string {
  const born = parseDay(birthday);
  const today = new Date();
  const months =
    (today.getFullYear() - born.getFullYear()) * 12 + (today.getMonth() - born.getMonth());
  if (months < 12) return t('pets.months', { count: Math.max(0, months) });
  return t('pets.years', { count: Math.floor(months / 12) });
}

/** Haustiere mit ihren Terminen: Tierarzt, Impfung, Entwurmung, Pflege. */
export function PetsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const householdId = household?.id ?? null;
  const today = dayKey();

  const [adding, setAdding] = useState(false);
  const [eventFor, setEventFor] = useState<PetRow | null>(null);

  const list = useLiveQuery(() => petRepo.list(account.id, householdId), [account.id, householdId]);
  const eventList = useLiveQuery(
    () => petRepo.events(account.id, householdId),
    [account.id, householdId],
  );
  const rows = list.data ?? [];
  const events = eventList.data ?? [];
  const upcoming = events.filter((event) => event.day >= today);

  const kindLabel = (kind: PetKind) => t(`pets.kind.${kind}` as TranslationKey);
  const eventLabel = (kind: PetEventKind) => t(`pets.event.${kind}` as TranslationKey);
  const nameOf = (petId: string) => rows.find((pet) => pet.id === petId)?.name ?? '';

  function eventRow(event: PetEventRow, withPet: boolean) {
    const diff = daysUntil(event.day);
    return (
      <ListItem
        title={
          withPet ? `${nameOf(event.petId)} · ${eventLabel(event.kind)}` : eventLabel(event.kind)
        }
        subtitle={event.note ?? undefined}
        right={
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <Text variant="label" tone={diff < 0 ? 'faint' : diff <= 7 ? 'accent' : 'muted'}>
              {relativeDay(t, language, event.day)}
            </Text>
            <IconButton
              icon="trash"
              label={t('common.remove')}
              onPress={() => void petRepo.removeEvent(event.id)}
            />
          </View>
        }
      />
    );
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={
            upcoming[0]
              ? `${nameOf(upcoming[0].petId)} · ${eventLabel(upcoming[0].kind)} · ${relativeDay(t, language, upcoming[0].day)}`
              : t(rows.length === 1 ? 'pets.count.one' : 'pets.count', { count: rows.length })
          }
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon="pet" title={t('pets.empty.title')} body={t('pets.empty.body')} />
      ) : null}

      {upcoming.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('pets.upcoming')}
          </Text>
          <Card>
            {upcoming.slice(0, 5).map((event, index) => (
              <View key={event.id}>
                {index > 0 ? <Divider /> : null}
                {eventRow(event, true)}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {rows.map((pet) => {
        const own = events.filter((event) => event.petId === pet.id && event.day < today).slice(-3);
        return (
          <Card key={pet.id}>
            <View style={{ gap: theme.spacing.md }}>
              <View style={[styles.row, { gap: theme.spacing.sm }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title">{pet.name}</Text>
                  <Text variant="caption" tone="muted">
                    {pet.birthday
                      ? `${kindLabel(pet.kind)} · ${ageLabel(t, pet.birthday)}`
                      : kindLabel(pet.kind)}
                  </Text>
                </View>
                <Button
                  label={t('pets.addEvent')}
                  icon="calendar"
                  size="sm"
                  fullWidth={false}
                  variant="secondary"
                  onPress={() => setEventFor(pet)}
                />
                <IconButton
                  icon="trash"
                  label={t('common.remove')}
                  onPress={() => void petRepo.remove(pet.id)}
                />
              </View>
              {own.length > 0 ? (
                <View style={{ opacity: 0.7 }}>
                  <Text variant="caption" tone="faint">
                    {t('pets.history')}
                  </Text>
                  {own.map((event) => (
                    <View key={event.id}>{eventRow(event, false)}</View>
                  ))}
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}

      <FloatingButton label={t('pets.add')} onPress={() => setAdding(true)} />

      <PetAdd
        visible={adding}
        scope={{ accountId: account.id, householdId }}
        onClose={() => setAdding(false)}
      />

      <EventAdd
        key={eventFor?.id ?? 'closed'}
        pet={eventFor}
        accountId={account.id}
        onClose={() => setEventFor(null)}
      />
    </Screen>
  );
}

function PetAdd({
  visible,
  scope,
  onClose,
}: {
  visible: boolean;
  scope: { accountId: string; householdId: string | null };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<PetKind>('dog');
  const [birthdayText, setBirthdayText] = useState('');
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
    await petRepo.add(scope, { name, kind, birthday: parsed ? dayKey(parsed) : null });
    setName('');
    setBirthdayText('');
    setError(null);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('pets.add')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={t('pets.name')}
          placeholder={t('pets.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          {...(error === 'name' ? { error: t('money.error.name') } : {})}
        />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('pets.kindLabel')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {KINDS.map((entry) => (
              <Chip
                key={entry}
                label={t(`pets.kind.${entry}` as TranslationKey)}
                selected={kind === entry}
                onPress={() => setKind(entry)}
              />
            ))}
          </View>
        </View>
        <Input
          label={t('pets.birthday')}
          placeholder={formatDateValue(new Date())}
          value={birthdayText}
          onChangeText={setBirthdayText}
          keyboardType="numbers-and-punctuation"
          {...(error === 'birthday' ? { error: t('day.error') } : {})}
        />
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

function EventAdd({
  pet,
  accountId,
  onClose,
}: {
  pet: PetRow | null;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const [kind, setKind] = useState<PetEventKind>('vet');
  const [day, setDay] = useState<string | null>(dayKey());
  const [note, setNote] = useState('');

  async function save() {
    if (!pet || !day) return;
    await petRepo.addEvent({ petId: pet.id, accountId, kind, day, note });
    onClose();
  }

  return (
    <Sheet
      visible={pet !== null}
      onClose={onClose}
      title={pet?.name ?? ''}
      subtitle={t('pets.addEvent')}
    >
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('pets.eventKind')}
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {EVENT_KINDS.map((entry) => (
              <Chip
                key={entry}
                label={t(`pets.event.${entry}` as TranslationKey)}
                selected={kind === entry}
                onPress={() => setKind(entry)}
              />
            ))}
          </View>
        </View>
        <DayPicker label={t('pets.when')} value={day} onChange={setDay} allowNone={false} />
        <Input
          label={t('pets.note')}
          placeholder={t('common.optional')}
          value={note}
          onChangeText={setNote}
        />
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
