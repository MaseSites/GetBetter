import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey } from '@/db';
import { useNow } from '@/features/weather/time';
import { formatTime, useI18n } from '@/i18n';
import { moduleBase, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { spanText, type DayEntry } from './DayThread';
import { focusOf } from './homeView';
import { minutesLeftOf, minutesUntilOf } from './threadState';
import { useDayThread } from './useDayThread';

const NOW_TICK_MS = 10_000;

type Timed = DayEntry & { at: string };

/**
 * Die grosse Karte „Jetzt“: laeuft etwas, ist sie Better-Gruen mit „noch 40
 * Min.“; kommt etwas, ist sie Papier mit „in 20 Min.“; sonst sagt sie, dass
 * heute nichts mehr ansteht. Ein Tipp oeffnet den grossen Zeitstrahl bei ihr.
 *
 * Sie steht in der Ansicht „Jetzt“ und als Stil des Tagesstrahls in der
 * eigenen Ansicht.
 */
export function FocusNow() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const today = dayKey();
  const band = useDayThread(today);
  const now = new Date(useNow(NOW_TICK_MS));

  const timed = band.entries.filter((item): item is Timed => Boolean(item.at));
  const focus = focusOf(timed, now);
  const entry = focus?.entry ?? null;
  const running = focus?.running ?? false;
  const onPress = () =>
    router.push(`/timeline?day=${today}${entry ? `&focus=${encodeURIComponent(entry.key)}` : ''}`);

  if (!entry) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.grid.nothingLeft')}
        onPress={onPress}
        style={({ pressed }) => [
          theme.elevation.card,
          {
            padding: theme.spacing.lg,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.surface,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text variant="body" tone="muted">
          {t('today.grid.nothingLeft')}
        </Text>
      </Pressable>
    );
  }

  const minutes = running ? minutesLeftOf(entry, now) : minutesUntilOf(entry, now);
  const span = minutes === null ? null : spanText(t, minutes, running ? 'left' : 'in');
  const time = entry.until
    ? `${formatTime(language, entry.at)}–${formatTime(language, entry.until)}`
    : formatTime(language, entry.at);
  const detail = [span, time, entry.meta].filter(Boolean).join(' · ');
  // Auf dem Gruen steht nur `textOnAccent` — lesbar in jeder Akzentfarbe.
  const ink = running ? theme.colors.textOnAccent : theme.colors.text;
  const label = running ? t('today.focus.now') : t('today.focus.next');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${entry.title}, ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [
        running ? theme.elevation.raised : theme.elevation.card,
        {
          gap: theme.spacing.sm,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          backgroundColor: running ? theme.colors.accent : theme.colors.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <Icon
          name={entry.icon}
          size={16}
          color={running ? ink : moduleBase(theme, entry.moduleId)}
        />
        <Text
          variant="overline"
          style={{
            letterSpacing: theme.tracking.label,
            color: running ? ink : theme.colors.textMuted,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        variant="display"
        numberOfLines={2}
        style={{ fontSize: theme.fontSize.title, lineHeight: theme.lineHeight.title, color: ink }}
      >
        {entry.title}
      </Text>
      <Text
        variant="label"
        numberOfLines={2}
        style={{
          fontWeight: theme.fontWeight.semibold,
          color: running ? ink : theme.colors.textMuted,
        }}
      >
        {detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
