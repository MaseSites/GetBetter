import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PanResponderInstance,
} from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme, type Theme } from '@/theme';

import { FLING_VELOCITY, isHorizontalSwipe } from './gestures';
import { Icon } from './Icon';
import { Text } from './Text';

export type SwipeRowProps = {
  children: ReactNode;
  /** Was ein Wisch nach links am Ende tut — meistens Loeschen. */
  onDelete: () => void;
  /** Beschriftung der roten Flaeche; ohne Angabe „Löschen“. */
  deleteLabel?: string;
  /**
   * Radius der Zeile, damit die rote Flaeche dieselbe Form hat. Eigenstaendige
   * Karten geben `theme.radii.md` mit; Zeilen in einer Karte lassen ihn weg und
   * werden dann an ihren Grenzen abgeschnitten.
   */
  radius?: number;
};

/** So breit ist die rote Flaeche, wenn die Zeile offen stehen bleibt. */
const ACTION_WIDTH = 88;
/** Ab diesem Anteil der Breite loescht ein Wisch ohne weiteren Tipp. */
const FULL_SWIPE_SHARE = 0.55;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Der Zustand der Geste lebt ausserhalb von React: waehrend des Wischens
 * aendert sich nur die Verschiebung, gerendert wird erst, wenn die Zeile
 * offen oder zu ist.
 */
class SwipeController {
  readonly translateX = new Animated.Value(0);
  readonly responder: PanResponderInstance;
  private width = 0;
  private base = 0;
  private open = false;
  private onDelete: () => void = () => undefined;

  constructor(
    private readonly motion: Theme['motion'],
    private readonly onOpenChange: (open: boolean) => void,
  ) {
    this.responder = PanResponder.create({
      // Nur waagrechte Wische nach links — oder zurueck, wenn die Zeile offen ist.
      // Senkrecht bleibt der Liste zum Rollen.
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        isHorizontalSwipe(gesture) && (gesture.dx < 0 || this.open),
      onPanResponderGrant: () => {
        this.translateX.stopAnimation();
        this.base = this.open ? -ACTION_WIDTH : 0;
      },
      onPanResponderMove: (_, gesture) => {
        this.translateX.setValue(Math.min(0, Math.max(-this.span, this.base + gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        const x = this.base + gesture.dx;
        if (
          x < -this.span * FULL_SWIPE_SHARE ||
          (gesture.vx < -FLING_VELOCITY * 2 && x < -ACTION_WIDTH)
        ) {
          this.setOpen(false);
          this.slide(-this.span, () => {
            this.onDelete();
            // Bleibt die Zeile stehen (etwa weil das Loeschen scheiterte), kommt sie zurueck.
            this.translateX.setValue(0);
          });
          return;
        }
        if (x < -ACTION_WIDTH / 2 || gesture.vx < -FLING_VELOCITY) {
          this.setOpen(true);
          this.slide(-ACTION_WIDTH);
          return;
        }
        this.close();
      },
      onPanResponderTerminate: () => this.slide(this.open ? -ACTION_WIDTH : 0),
      // Einmal gewischt, bleibt die Geste bei der Zeile — sonst springt die Liste mit.
      onPanResponderTerminationRequest: () => false,
    });
  }

  setWidth(width: number) {
    this.width = width;
  }

  /** Solange die Zeile noch nicht vermessen ist, gilt die Fensterbreite — nie null. */
  private get span() {
    return this.width > 0 ? this.width : Dimensions.get('window').width;
  }

  setOnDelete(onDelete: () => void) {
    this.onDelete = onDelete;
  }

  close() {
    this.setOpen(false);
    this.slide(0);
  }

  private setOpen(open: boolean) {
    this.open = open;
    this.onOpenChange(open);
  }

  private slide(to: number, then?: () => void) {
    Animated.timing(this.translateX, {
      toValue: to,
      duration: this.motion.duration.reveal,
      easing: this.motion.easing.out,
      useNativeDriver,
    }).start(() => then?.());
  }
}

/**
 * Eine Zeile, die man nach links wischt wie in der iPhone-Uhr: ein Stueck
 * weit, und „Löschen“ steht daneben; ganz durch, und sie ist weg. Ein Tipp auf
 * die offene Zeile oder ein Wisch zurueck schliesst sie wieder.
 *
 * Wer nicht wischen kann, erreicht dasselbe ueber die Bedienungshilfe
 * („Aktionen“) — die Zeile meldet das Loeschen dort als eigene Aktion.
 */
export function SwipeRow({ children, onDelete, deleteLabel, radius = 0 }: SwipeRowProps) {
  const theme = useTheme();
  const t = useTranslate();
  const label = deleteLabel ?? t('common.delete');

  const [open, setOpen] = useState(false);
  const [controller] = useState(() => new SwipeController(theme.motion, setOpen));

  useEffect(() => {
    controller.setOnDelete(onDelete);
  }, [controller, onDelete]);

  function remove() {
    controller.close();
    onDelete();
  }

  // Die rote Flaeche erscheint erst, wenn die Zeile sich bewegt — sonst
  // blitzt sie an den runden Ecken durch.
  const actionOpacity = controller.translateX.interpolate({
    inputRange: [-1, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Ohne eigenen Radius ist die Zeile Teil einer Karte: dort bleibt sie beim
  // Wischen in ihren Grenzen, statt ueber den Kartenrand zu gleiten. Eigenstaendige
  // Karten schneiden wir nicht ab, sonst verschwindet ihr Schatten.
  const inCard = radius === 0;

  return (
    <View
      style={inCard ? styles.clip : null}
      onLayout={(event) => controller.setWidth(event.nativeEvent.layout.width)}
    >
      {/* Geschlossen gehoert die rote Flaeche nicht zur Bedienungshilfe — dort gibt es die Aktion. */}
      <Animated.View
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        style={[
          StyleSheet.absoluteFill,
          styles.actions,
          { backgroundColor: theme.colors.danger, borderRadius: radius, opacity: actionOpacity },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={remove}
          style={[styles.action, { width: ACTION_WIDTH, gap: theme.spacing.xs }]}
        >
          <Icon name="trash" size={20} color={theme.colors.surface} />
          <Text variant="caption" style={{ color: theme.colors.surface }}>
            {label}
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        accessibilityActions={[{ name: 'delete', label }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete();
        }}
        // Die Zeile deckt die rote Flaeche ab — auch Zeilen, die selbst durchsichtig sind.
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: radius,
          transform: [{ translateX: controller.translateX }],
        }}
        {...controller.responder.panHandlers}
      >
        {children}
        {/* Offen faengt ein Tipp auf die Zeile das Schliessen ab, nicht das Oeffnen. */}
        {open ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={() => controller.close()}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', overflow: 'hidden' },
  action: { alignItems: 'center', justifyContent: 'center' },
});
