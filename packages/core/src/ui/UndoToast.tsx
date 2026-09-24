import { useSegments } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onReadOnlyAttempt } from '@/app/viewMode';
import { useTranslate } from '@/i18n';
import { useTheme, type Theme } from '@/theme';

import { HIT_TARGET, TAB_BAR_HEIGHT } from './layout';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

export type UndoOptions = {
  /** Was passiert ist, etwa „Aufgabe gelöscht“. */
  message: string;
  /** Beschriftung des Knopfs; ohne Angabe „Rückgängig“. */
  undoLabel?: string;
  /** Ohne `onUndo` erscheint nur die Nachricht, ohne Knopf. */
  onUndo?: () => void;
  /** Wie lange sie stehen bleibt. */
  durationMs?: number;
};

export type UndoApi = {
  /** Zeigt die Meldung. Eine neue ersetzt die alte — deren Aktion bleibt dann bestehen. */
  show: (options: UndoOptions) => void;
  hide: () => void;
};

/** Fuenf Sekunden, wie im Bauplan. */
export const UNDO_DURATION_MS = 5000;

/** Nie breiter als ein Telefon im Hochformat, auch auf dem Tablet. */
const TOAST_MAX_WIDTH = 480;

const useNativeDriver = Platform.OS !== 'web';

const UndoContext = createContext<UndoApi>({ show: () => undefined, hide: () => undefined });

/** Steht gerade eine Meldung unten? Dann tritt der Knopf unten rechts zurueck. */
const ToastVisible = createContext(false);

/**
 * „Gelöscht · Rückgängig“: die Rueckmeldung nach allem, was sich zuruecknehmen
 * laesst. Ausserhalb von `UndoProvider` tut `show` nichts.
 */
export function useUndo(): UndoApi {
  return useContext(UndoContext);
}

/** Fuer `FloatingButton`: solange die Meldung unten steht, tritt er zurueck. */
export function useToastVisible(): boolean {
  return useContext(ToastVisible);
}

type Toast = UndoOptions & { id: number };

class ToastIds {
  private last = 0;

  next(): number {
    this.last += 1;
    return this.last;
  }
}

/**
 * Einmal in der Huelle (`RootShell`), um alle Bildschirme herum. Die Meldung
 * steht **ganz unten**, direkt ueber der Tab-Leiste — im Vollbild am unteren
 * Rand. Der Knopf unten rechts tritt solange zurueck, damit sich nichts
 * ueberdeckt.
 *
 * `readOnlyMessage` (nur beim Ansehen aus dem Admin): jede Meldung wird zu
 * diesem Satz, ohne Rückgängig — „Gelöscht“ stimmte ja nicht. Und jeder
 * Versuch zu schreiben zeigt ihn auch.
 */
export function UndoProvider({
  children,
  readOnlyMessage,
}: {
  children: ReactNode;
  readOnlyMessage?: string | undefined;
}) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [ids] = useState(() => new ToastIds());

  const api = useMemo<UndoApi>(
    () => ({
      show: (options) =>
        setToast(
          readOnlyMessage
            ? { message: readOnlyMessage, id: ids.next() }
            : { ...options, id: ids.next() },
        ),
      hide: () => setToast(null),
    }),
    [ids, readOnlyMessage],
  );

  useEffect(() => {
    if (!readOnlyMessage) return undefined;
    return onReadOnlyAttempt(() => setToast({ message: readOnlyMessage, id: ids.next() }));
  }, [ids, readOnlyMessage]);

  const finish = useCallback(
    (id: number) => setToast((current) => (current?.id === id ? null : current)),
    [],
  );

  return (
    <UndoContext.Provider value={api}>
      <ToastVisible.Provider value={toast !== null}>
        <View style={styles.fill}>
          {children}
          {toast ? <ToastView key={toast.id} toast={toast} onFinish={finish} /> : null}
        </View>
      </ToastVisible.Provider>
    </UndoContext.Provider>
  );
}

/** Ein- und Ausblenden, ausserhalb von React. */
class ToastMotion {
  readonly progress = new Animated.Value(0);
  private leaving = false;
  private onFinish: () => void = () => undefined;

  constructor(private readonly motion: Theme['motion']) {}

  setOnFinish(onFinish: () => void) {
    this.onFinish = onFinish;
  }

  enter() {
    this.leaving = false;
    Animated.timing(this.progress, {
      toValue: 1,
      duration: this.motion.duration.reveal,
      easing: this.motion.easing.out,
      useNativeDriver,
    }).start();
  }

  /** `false`, wenn sie schon am Gehen ist — so wirkt Rückgängig nur einmal. */
  leave(): boolean {
    if (this.leaving) return false;
    this.leaving = true;
    Animated.timing(this.progress, {
      toValue: 0,
      duration: this.motion.duration.exit,
      easing: this.motion.easing.out,
      useNativeDriver,
    }).start(() => this.onFinish());
    return true;
  }
}

function ToastView({ toast, onFinish }: { toast: Toast; onFinish: (id: number) => void }) {
  const theme = useTheme();
  const t = useTranslate();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const reduced = useReducedMotion();
  const [motion] = useState(() => new ToastMotion(theme.motion));

  const duration = toast.durationMs ?? UNDO_DURATION_MS;
  const undoLabel = toast.undoLabel ?? t('ui.undo');
  // In den Tabs liegt die Leiste unten; die Module stehen im Vollbild darueber.
  // Ganz unten heisst: gleich darueber, mit einem Finger Luft.
  const inTabs = segments[0] === '(tabs)';
  const bottom = (inTabs ? TAB_BAR_HEIGHT : 0) + insets.bottom + theme.spacing.sm;

  useEffect(() => {
    motion.setOnFinish(() => onFinish(toast.id));
  }, [motion, onFinish, toast.id]);

  useEffect(() => {
    motion.enter();
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(toast.message);
    const timer = setTimeout(() => motion.leave(), duration);
    return () => clearTimeout(timer);
  }, [motion, duration, toast.message]);

  // Bei weniger Bewegung nur ueberblenden.
  const transform =
    reduced === true
      ? []
      : [
          {
            translateY: motion.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [theme.spacing.lg, 0],
            }),
          },
        ];

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.host,
        { bottom, paddingHorizontal: theme.spacing.lg, opacity: motion.progress, transform },
      ]}
    >
      <View
        style={[
          styles.toast,
          theme.elevation.raised,
          {
            minHeight: HIT_TARGET + theme.spacing.sm,
            gap: theme.spacing.md,
            paddingLeft: theme.spacing.lg,
            paddingRight: toast.onUndo ? theme.spacing.xs : theme.spacing.lg,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.inverse,
          },
        ]}
      >
        <Text
          variant="label"
          numberOfLines={2}
          style={[styles.message, { color: theme.colors.onInverse }]}
        >
          {toast.message}
        </Text>
        {toast.onUndo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={undoLabel}
            onPress={() => {
              if (motion.leave()) toast.onUndo?.();
            }}
            style={({ pressed }) => [
              styles.action,
              {
                minHeight: HIT_TARGET,
                paddingHorizontal: theme.spacing.md,
                opacity: pressed ? 0.5 : 1,
              },
            ]}
          >
            <Text
              variant="label"
              style={{ color: theme.colors.onInverse, fontWeight: theme.fontWeight.bold }}
            >
              {undoLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: TOAST_MAX_WIDTH,
  },
  message: { flex: 1 },
  action: { alignItems: 'center', justifyContent: 'center' },
});
