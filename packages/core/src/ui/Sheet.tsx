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

import { FLING_VELOCITY, isDownwardSwipe } from './gestures';
import { Icon } from './Icon';
import { usePhoneFrame } from './PhoneFrame';
import { Text } from './Text';

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
  /** Vollbild statt von unten eingeschobener Karte. */
  fullScreen?: boolean;
};

/** Ab dieser Strecke nach unten geht das Blatt zu. */
const DISMISS_DISTANCE = 120;
/** So weit faehrt es beim Schliessen hinaus — sicher unter jedem Bildschirmrand. */
const OUT_OF_VIEW = 1200;

const useNativeDriver = Platform.OS !== 'web';

/** Das Herunterziehen, ausserhalb von React: gerendert wird dabei nichts. */
class DragController {
  readonly dragY = new Animated.Value(0);
  readonly responder: PanResponderInstance;
  private onClose: () => void = () => undefined;

  constructor(private readonly motion: Theme['motion']) {
    const back = () =>
      Animated.spring(this.dragY, {
        toValue: 0,
        useNativeDriver,
        bounciness: 0,
        speed: 20,
      }).start();

    this.responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => isDownwardSwipe(gesture),
      // Auch ueber den Knoepfen der Kopfzeile: ein Zug nach unten ist kein Tipp.
      onMoveShouldSetPanResponderCapture: (_, gesture) => isDownwardSwipe(gesture),
      onPanResponderMove: (_, gesture) => this.dragY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_DISTANCE || gesture.vy > FLING_VELOCITY) {
          Animated.timing(this.dragY, {
            toValue: OUT_OF_VIEW,
            duration: this.motion.duration.exit,
            easing: this.motion.easing.out,
            useNativeDriver,
          }).start();
          this.onClose();
          return;
        }
        back();
      },
      onPanResponderTerminate: back,
      onPanResponderTerminationRequest: () => false,
    });
  }

  setOnClose(onClose: () => void) {
    this.onClose = onClose;
  }

  /** Jedes Oeffnen beginnt oben, auch wenn das Blatt zuletzt hinausgewischt wurde. */
  reset() {
    this.dragY.setValue(0);
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
}: SheetProps) {
  const theme = useTheme();
  const t = useTranslate();
  const frame = usePhoneFrame();

  const [drag] = useState(() => new DragController(theme.motion));

  useEffect(() => {
    drag.setOnClose(onClose);
  }, [drag, onClose]);

  useEffect(() => {
    if (visible) drag.reset();
  }, [visible, drag]);

  // Der Schleier wird heller, je weiter das Blatt hinunter ist.
  const overlayOpacity = drag.dragY.interpolate({
    inputRange: [0, DISMISS_DISTANCE * 3],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType={fullScreen ? 'slide' : 'fade'}
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
            style={fullScreen ? styles.dismissAreaTop : styles.dismissArea}
          />
          <Animated.View
            style={[
              fullScreen ? styles.fullPanel : styles.panel,
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
              <View style={[styles.grabberWrap, { paddingVertical: theme.spacing.md }]}>
                <View
                  style={[
                    styles.grabber,
                    { backgroundColor: theme.colors.borderStrong, borderRadius: theme.radii.pill },
                  ]}
                />
              </View>
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
