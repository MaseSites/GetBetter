import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { dayKey } from '@/db';
import { useTheme } from '@/theme';

import { AllDayLane } from './DayThread';
import { DayTasks } from './DayTasks';
import { FocusNow } from './FocusNow';
import { useDayThread } from './useDayThread';

/**
 * Die Startseite auf das Jetzt reduziert: gross, was gerade laeuft — sonst,
 * was als Naechstes kommt (`FocusNow`) —, darueber das Ganztaegige, darunter
 * immer die Aufgaben von heute. Sonst nichts.
 */
export function HomeFocus({ onAddTask }: { onAddTask: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const today = dayKey();
  const band = useDayThread(today);

  const openTimeline = (key?: string) =>
    router.push(`/timeline?day=${today}${key ? `&focus=${encodeURIComponent(key)}` : ''}`);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {band.allDay.length > 0 ? <AllDayLane entries={band.allDay} onOpen={openTimeline} /> : null}
      <FocusNow />
      {/* Hier steht der Bereich immer — auch ohne Aufgaben. */}
      <DayTasks day={today} onAdd={onAddTask} keepEmpty />
    </View>
  );
}
