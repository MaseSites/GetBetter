import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type PanResponderInstance,
} from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme, type Theme } from '@/theme';

import { detentOffset, resolveSheetRelease, type SheetDetent } from './gestureLogic';
import { FLING_VELOCITY, isDownwardSwipe, isVerticalSwipe } from './gestures';
import { Icon } from './Icon';
import { usePhoneFrame } from './PhoneFrame';
import { Text } from './Text';

export type { SheetDetent };

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /**
   * Eigene Kopfzeile statt Titel und Schliessen-Kreuz — etwa X, Titel und Haken
   * beim Wecker. Sie liegt im Griffbereich: an ihr zieht man das Blatt herunter.
   */
  header?: ReactNode;
  children: ReactNode;
  /** Vollbild statt von unten eingeschobener Karte. Wirkt nicht zusammen mit `detent`. */
  fullScreen?: boolean;
  /**
   * Mit Hoehenstufen wie auf dem iPhone: `medium` (etwa die Haelfte) oder
   * `large`. Am Griff nach oben wird es gross, nach unten gross → mittel → zu.
   * Ohne Angabe bleibt das Blatt so hoch wie sein Inhalt.
   */
  detent?: SheetDetent;
  /** Meldet, wenn jemand die Stufe wechselt. */
  onDetentChange?: (detent: SheetDetent) => void;
};

/** Ab dieser Strecke nach unten geht das Blatt zu. */
const DISMISS_DISTANCE = 120;
/** So weit faehrt es beim Schliessen hinaus — sicher unter jedem Bildschirmrand. */
const OUT_OF_VIEW = 1200;
/** Anteil der Hoehe, den ein Blatt in der Stufe „gross“ einnimmt. */
const LARGE_SHARE = 0.92;
/** … und in der Stufe „mittel“. */
const MEDIUM_SHARE = 0.55;

const useNativeDriver = Platform.OS !== 'web';

type DragConfig = {
  detented: boolean;
  mediumOffset: number;
  onClose: () => void;
  onDetentChange?: (detent: SheetDetent) => void;
};

/** Das Ziehen, ausserhalb von React: gerendert wird dabei nichts. */
class DragController {
  readonly dragY = new Animated.Value(0);
  readonly responder: PanResponderInstance;
  private config: DragConfig = { detented: false, mediumOffset: 0, onClose: () => undefined };
  private detent: SheetDetent = 'large';
  private base = 0;

  constructor(private readonly motion: Theme['motion']) {
    this.responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => this.wants(gesture),
      // Auch ueber den Knoepfen der Kopfzeile: ein Zug ist kein Tipp.
      onMoveShouldSetPanResponderCapture: (_, gesture) => this.wants(gesture),
      onPanResponderGrant: () => {
        this.dragY.stopAnimation();
        this.base = this.offset;
      },
      onPanResponderMove: (_, gesture) => this.dragY.setValue(Math.max(0, this.base + gesture.dy)),
      onPanResponderRelease: (_, gesture) => this.release(gesture.dy, gesture.vy),
      onPanResponderTerminate: () => this.settle(),
      onPanResponderTerminationRequest: () => false,
    });
  }

  configure(config: DragConfig) {
    this.config = config;
  }

  /** Jedes Oeffnen beginnt in seiner Stufe, auch wenn das Blatt zuletzt hinausgewischt wurde. */
  reset(detent: SheetDetent) {
    this.detent = detent;
    this.dragY.setValue(this.offset);
  }

  /** Fuer die Bedienungshilfe: groesser oder kleiner ohne Ziehen. */
  setDetent(next: SheetDetent) {
    if (!this.config.detented) return;
    const changed = next !== this.detent;
    this.detent = next;
    this.settle();
    if (changed) this.config.onDetentChange?.(next);
  }

  private get offset() {
    return this.config.detented ? detentOffset(this.detent, this.config.mediumOffset) : 0;
  }

  private wants(gesture: Parameters<typeof isVerticalSwipe>[0]) {
    return this.config.detented ? isVerticalSwipe(gesture) : isDownwardSwipe(gesture);
  }

  private release(dy: number, vy: number) {
    if (!this.config.detented) {
      if (dy > DISMISS_DISTANCE || vy > FLING_VELOCITY) {
        this.dismiss();
        return;
      }
      this.settle();
      return;
    }

    const next = resolveSheetRelease({
      detent: this.detent,
      dy,
      vy,
      mediumOffset: this.config.mediumOffset,
      dismissDistance: DISMISS_DISTANCE,
      flingVelocity: FLING_VELOCITY,
    });
    if (next === 'close') {
      this.dismiss();
      return;
    }
    this.setDetent(next);
  }

  private settle() {
    Animated.spring(this.dragY, {
      toValue: this.offset,
      useNativeDriver,
      bounciness: 0,
      speed: 20,
    }).start();
  }

  private dismiss() {
    Animated.timing(this.dragY, {
      toValue: OUT_OF_VIEW,
      duration: this.motion.duration.exit,
      easing: this.motion.easing.out,
      useNativeDriver,
    }).start();
    this.config.onClose();
  }
}

/**
 * Ein Blatt von unten. Zu geht es mit dem Kreuz, mit einem Tipp daneben — oder
 * indem man es am Griff oder an der Kopfzeile nach unten wischt. Nur dort: im
 * Inhalt stecken Felder, Listen und das Wecker-Rad, die selbst gezogen werden.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  header,
  children,
  fullScreen = false,
  detent,
  onDetentChange,
}: SheetProps) {
  const theme = useTheme();
  const t = useTranslate();
  const frame = usePhoneFrame();

  const [drag] = useState(() => new DragController(theme.motion));

  const detented = detent !== undefined;
  // Ohne Rahmen ist `frame.height` die Fensterhoehe.
  const panelHeight = frame.height * LARGE_SHARE;
  const mediumOffset = frame.height * (LARGE_SHARE - MEDIUM_SHARE);

  useEffect(() => {
    drag.configure({ detented, mediumOffset, onClose, onDetentChange });
  }, [drag, detented, mediumOffset, onClose, onDetentChange]);

  useEffect(() => {
    if (visible) drag.reset(detent ?? 'large');
  }, [visible, drag, detent]);

  // Der Schleier wird heller, je weiter das Blatt unter seine tiefste Stufe geht.
  const overlayOpacity = detented
    ? drag.dragY.interpolate({
        inputRange: [0, mediumOffset, mediumOffset + DISMISS_DISTANCE * 3],
        outputRange: [1, 1, 0],
        extrapolate: 'clamp',
      })
    : drag.dragY.interpolate({
        inputRange: [0, DISMISS_DISTANCE * 3],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });

  const grabber = (
    <View style={[styles.grabberWrap, { paddingVertical: theme.spacing.md }]}>
      <View
        style={[
          styles.grabber,
          { backgroundColor: theme.colors.borderStrong, borderRadius: theme.radii.pill },
        ]}
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={fullScreen && !detented ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      {/* Im Browser liegt das Blatt im Telefon, nicht ueber dem ganzen Fenster. */}
      <View style={frame.framed ? styles.stage : styles.fill}>
        <View
          style={[
            styles.backdrop,
            frame.framed
              ? {
                  // Die Buehne darf das Blatt nicht ausfuellen, es soll so gross
                  // sein wie das Telefon. `flex: 0` waere hier falsch: daraus
                  // wird `flex-basis: 0%`, und die Hoehe faellt auf null.
                  flexGrow: 0,
                  flexShrink: 0,
                  flexBasis: 'auto',
                  width: frame.width,
                  height: frame.height,
                  borderRadius: 34,
                  overflow: 'hidden',
                }
              : null,
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.nonInteractive,
              { backgroundColor: theme.colors.overlay, opacity: overlayOpacity },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            style={
              detented
                ? StyleSheet.absoluteFill
                : fullScreen
                  ? styles.dismissAreaTop
                  : styles.dismissArea
            }
          />
          <Animated.View
            style={[
              detented ? { height: panelHeight } : fullScreen ? styles.fullPanel : styles.panel,
              {
                backgroundColor: theme.colors.background,
                borderTopLeftRadius: theme.radii.xl,
                borderTopRightRadius: theme.radii.xl,
                paddingBottom: theme.spacing.xl,
                transform: [{ translateY: drag.dragY }],
              },
            ]}
          >
            {/* Der Griffbereich: Griff und Kopfzeile ziehen das Blatt mit. */}
            <View {...drag.responder.panHandlers}>
              {detented ? (
                <View
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel={t('ui.sheet.size')}
                  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === 'increment') drag.setDetent('large');
                    if (event.nativeEvent.actionName === 'decrement') drag.setDetent('medium');
                  }}
                >
                  {grabber}
                </View>
              ) : (
                grabber
              )}
              {header ? (
                <View
                  style={{ paddingHorizontal: theme.spacing.edge, paddingBottom: theme.spacing.md }}
                >
                  {header}
                </View>
              ) : title ? (
                <View
                  style={[
                    styles.header,
                    {
                      paddingHorizontal: theme.spacing.edge,
                      paddingBottom: theme.spacing.md,
                      gap: theme.spacing.md,
                    },
                  ]}
                >
                  <View style={styles.headerText}>
                    <Text variant="title">{title}</Text>
                    {subtitle ? (
                      <Text variant="label" tone="muted">
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('common.close')}
                    onPress={onClose}
                    hitSlop={12}
                  >
                    <Icon name="close" size={22} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              ) : null}
            </View>
            {/* Laengere Formulare muessen rollen, sonst ist der Knopf unten nicht erreichbar. */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.edge,
                paddingBottom: theme.spacing.lg,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  nonInteractive: { pointerEvents: 'none' },
  dismissArea: { flex: 1 },
  dismissAreaTop: { height: 44 },
  panel: { maxHeight: '85%' },
  fullPanel: { flex: 1 },
  grabberWrap: { alignItems: 'center' },
  grabber: { width: 40, height: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1, gap: 2 },
  body: { flexShrink: 1 },
});
