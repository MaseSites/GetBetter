import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey, trips as tripRepo, useLiveQuery, type PackingItemRow, type TripRow } from '@/db';
import { DayPicker } from '@/features/shared/DayPicker';
import { daysUntil, parseDay, relativeDay, shiftDay } from '@/features/shared/days';
import { formatShortDate, useI18n, type TranslationKey } from '@/i18n';
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
  IconButton,
  Input,
  ProgressBar,
  Screen,
  Sheet,
  Text,
} from '@/ui';

/** Wie lange eine Reise dauert — die ueblichen Laengen. */
const DURATIONS = [2, 3, 7, 14] as const;

/** Was fast immer mit muss. Ein Tipp legt es auf die Liste. */
const SUGGESTIONS = [
  'passport',
  'charger',
  'toothbrush',
  'meds',
  'headphones',
  'adapter',
  'sunscreen',
  'tickets',
] as const;

type Status = 'upcoming' | 'ongoing' | 'past';

function statusOf(trip: TripRow, today: string): Status {
  if (trip.endDay < today) return 'past';
  if (trip.startDay <= today) return 'ongoing';
  return 'upcoming';
}

/** Reisen mit Countdown und Packliste. Buchungen und Tickets kommen spaeter. */
export function TripsView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();

  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useLiveQuery(() => tripRepo.list(account.id), [account.id]);
  const itemList = useLiveQuery(() => tripRepo.allItems(account.id), [account.id]);
  const rows = list.data ?? [];
  const items = itemList.data ?? [];
  const current = rows.filter((trip) => statusOf(trip, today) !== 'past');
  const past = rows.filter((trip) => statusOf(trip, today) === 'past').reverse();
  const next = current[0];
  const open = rows.find((trip) => trip.id === openId) ?? null;

  const range = (trip: TripRow) =>
    t('trips.range', {
      from: formatShortDate(language, parseDay(trip.startDay).toISOString()),
      to: formatShortDate(language, parseDay(trip.endDay).toISOString()),
    });

  function statusLabel(trip: TripRow): string {
    const status = statusOf(trip, today);
    if (status === 'ongoing') return t('trips.ongoing');
    if (status === 'past') return t('trips.past');
    return relativeDay(t, language, trip.startDay);
  }

  const subtitle = next
    ? statusOf(next, today) === 'ongoing'
      ? t('trips.ongoing')
      : t('trips.next', { days: daysUntil(next.startDay), name: next.name })
    : t('trips.empty.title');

  function card(trip: TripRow, dim = false) {
    const own = items.filter((item) => item.tripId === trip.id);
    const packed = own.filter((item) => item.packed).length;
    return (
      <Card key={trip.id} onPress={() => setOpenId(trip.id)} accessibilityLabel={trip.name}>
        <View style={{ gap: theme.spacing.sm, opacity: dim ? 0.6 : 1 }}>
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{trip.name}</Text>
              <Text variant="caption" tone="muted">
                {trip.destination ? `${trip.destination} · ${range(trip)}` : range(trip)}
              </Text>
            </View>
            <Text variant="label" tone={dim ? 'faint' : 'accent'}>
              {statusLabel(trip)}
            </Text>
          </View>
          {own.length > 0 ? (
            <>
              <ProgressBar share={packed / own.length} />
              <Text variant="caption" tone="faint">
                {t('trips.packed', { packed, total: own.length })}
              </Text>
            </>
          ) : null}
        </View>
      </Card>
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
        <EmptyState icon="travel" title={t('trips.empty.title')} body={t('trips.empty.body')} />
      ) : null}

      {current.map((trip) => card(trip))}

      {past.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('trips.previous')}
          </Text>
          {past.map((trip) => card(trip, true))}
        </View>
      ) : null}

      <FloatingButton label={t('trips.add')} onPress={() => setAdding(true)} />

      <TripAdd visible={adding} accountId={account.id} onClose={() => setAdding(false)} />

      <TripDetail
        trip={open}
        items={items.filter((item) => item.tripId === openId)}
        subtitle={open ? range(open) : ''}
        accountId={account.id}
        onClose={() => setOpenId(null)}
      />
    </Screen>
  );
}

function TripAdd({
  visible,
  accountId,
  onClose,
}: {
  visible: boolean;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [start, setStart] = useState<string | null>(shiftDay(7));
  const [duration, setDuration] = useState<number>(DURATIONS[2]);
  const [error, setError] = useState(false);

  async function save() {
    if (name.trim().length === 0 || !start) {
      setError(true);
      return;
    }
    await tripRepo.add({
      accountId,
      name,
      destination,
      startDay: start,
      endDay: shiftDay(duration - 1, parseDay(start)),
    });
    setName('');
    setDestination('');
    setError(false);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('trips.add')}>
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={t('trips.name')}
          placeholder={t('trips.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          {...(error ? { error: t('money.error.name') } : {})}
        />
        <Input
          label={t('trips.destination')}
          placeholder={t('common.optional')}
          value={destination}
          onChangeText={setDestination}
          autoCapitalize="sentences"
        />
        <DayPicker label={t('trips.start')} value={start} onChange={setStart} allowNone={false} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('trips.duration')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {DURATIONS.map((days) => (
              <Chip
                key={days}
                label={t('trips.days', { count: days })}
                selected={duration === days}
                onPress={() => setDuration(days)}
              />
            ))}
          </View>
        </View>
        <Button label={t('common.done')} icon="check" onPress={save} />
      </View>
    </Sheet>
  );
}

/** Die Packliste einer Reise: abhaken, ergaenzen, Vorschlaege antippen. */
function TripDetail({
  trip,
  items,
  subtitle,
  accountId,
  onClose,
}: {
  trip: TripRow | null;
  items: readonly PackingItemRow[];
  subtitle: string;
  accountId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [draft, setDraft] = useState('');

  const packed = items.filter((item) => item.packed).length;
  const names = new Set(items.map((item) => item.name.toLowerCase()));
  const suggestions = SUGGESTIONS.map((id) => t(`trips.suggestion.${id}` as TranslationKey)).filter(
    (label) => !names.has(label.toLowerCase()),
  );

  async function add(name: string) {
    if (!trip || name.trim().length === 0) return;
    setDraft('');
    await tripRepo.addItem(trip.id, accountId, name);
  }

  async function remove() {
    if (!trip) return;
    await tripRepo.remove(trip.id);
    onClose();
  }

  return (
    <Sheet
      visible={trip !== null}
      onClose={onClose}
      title={trip?.name ?? ''}
      subtitle={subtitle}
      fullScreen
    >
      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="section" tone="muted">
            {t('trips.packing')}
          </Text>
          {items.length > 0 ? (
            <>
              <ProgressBar share={packed / items.length} />
              <Text variant="caption" tone="faint">
                {t('trips.packed', { packed, total: items.length })}
              </Text>
            </>
          ) : null}
        </View>

        {items.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: theme.spacing.lg }}>
            {items.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <View
                  style={[styles.row, { paddingVertical: theme.spacing.md, gap: theme.spacing.md }]}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.packed }}
                    accessibilityLabel={item.name}
                    onPress={() => void tripRepo.setPacked(item.id, !item.packed)}
                    hitSlop={8}
                  >
                    <Icon
                      name={item.packed ? 'checkCircle' : 'circle'}
                      size={24}
                      color={item.packed ? theme.colors.accent : theme.colors.borderStrong}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="body"
                      tone={item.packed ? 'faint' : 'default'}
                      style={item.packed ? { textDecorationLine: 'line-through' } : undefined}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <IconButton
                    icon="trash"
                    label={t('common.remove')}
                    onPress={() => void tripRepo.removeItem(item.id)}
                  />
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Input
          placeholder={t('trips.packingPlaceholder')}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => void add(draft)}
          returnKeyType="done"
          accessibilityLabel={t('trips.packingPlaceholder')}
        />

        {suggestions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {suggestions.map((label) => (
              <Chip key={label} label={label} onPress={() => void add(label)} />
            ))}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.remove')}
          onPress={remove}
          style={[styles.removeRow, { gap: theme.spacing.sm, paddingVertical: theme.spacing.md }]}
        >
          <Icon name="trash" size={18} color={theme.colors.danger} />
          <Text variant="label" tone="danger">
            {t('common.remove')}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
