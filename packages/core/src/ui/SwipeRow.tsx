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

import { armedSide, resolveSwipeRelease, type SwipeSide } from './gestureLogic';
import { FLING_VELOCITY, isHorizontalSwipe } from './gestures';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type SwipeActionTone = 'default' | 'accent' | 'danger';

export type SwipeAction = {
  /** Auch der Name der Aktion fuer die Bedienungshilfe — nicht `activate` oder `longpress`. */
  key: string;
  label: string;
  icon: IconName;
  tone: SwipeActionTone;
  onPress: () => void;
};

export type SwipeRowProps = {
  children: ReactNode;
  /** Ganz nach rechts gewischt: loest aus, die Zeile federt zurueck und bleibt. */
  leading?: SwipeAction;
  /** Halb nach links gewischt: diese Knoepfe stehen daneben. */
  trailing?: readonly SwipeAction[];
  /** Ganz nach links gewischt: die Zeile faehrt hinaus, dann loest es aus. */
  trailingFull?: SwipeAction;
  /**
   * Kurzform fuer Loeschen: fuellt `trailing` und `trailingFull`, wo sie nicht
   * mitgegeben sind.
   */
  onDelete?: () => void;
  /** Beschriftung von Loeschen; ohne Angabe „Löschen“. */
  deleteLabel?: string;
  /**
   * Radius der Zeile, damit die Aktionsflaeche dieselbe Form hat. Eigenstaendige
   * Karten geben `theme.radii.md` mit; Zeilen in einer Karte lassen ihn weg und
   * werden dann an ihren Grenzen abgeschnitten.
   */
  radius?: number;
  /**
   * Die Zeile muss die Aktionen darunter abdecken. Ohne Angabe Weiss wie eine
   * Karte; in einer `PlainList` die Papierfarbe (`theme.colors.background`).
   */
  backgroundColor?: string;
};

/** So breit ist ein Knopf, wenn die Zeile offen stehen bleibt. */
const ACTION_WIDTH = 80;
/** Ab diesem Anteil der Breite loest ein Wisch ohne weiteren Tipp aus. */
const FULL_SWIPE_SHARE = 0.6;
/** So viel groesser wird das Symbol, sobald Loslassen ausloest. */
const ARMED_SCALE = 1.2;

const useNativeDriver = Platform.OS !== 'web';

type SwipeConfig = {
  leading?: SwipeAction;
  trailing: readonly SwipeAction[];
  trailingFull?: SwipeAction;
};

/**
 * Der Zustand der Geste lebt ausserhalb von React: waehrend des Wischens
 * aendert sich nur die Verschiebung, gerendert wird erst, wenn die Zeile
 * offen oder zu ist oder eine Aktion scharf wird.
 */
class SwipeController {
  readonly translateX = new Animated.Value(0);
  readonly responder: PanResponderInstance;
  private width = 0;
  private base = 0;
  private open = false;
  private armed: SwipeSide | null = null;
  private config: SwipeConfig = { trailing: [] };

  constructor(
    private readonly motion: Theme['motion'],
    private readonly onOpenChange: (open: boolean) => void,
    private readonly onArmedChange: (side: SwipeSide | null) => void,
  ) {
    this.responder = PanResponder.create({
      // Nur waagrecht, und nur in Richtungen mit Aktion — senkrecht bleibt der Liste.
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        isHorizontalSwipe(gesture) && this.accepts(gesture.dx),
      onPanResponderGrant: () => {
        this.translateX.stopAnimation();
        this.base = this.open ? -this.trailingWidth : 0;
      },
      onPanResponderMove: (_, gesture) => {
        const x = this.clamp(this.base + gesture.dx);
        this.translateX.setValue(x);
        this.setArmed(
          armedSide(
            x,
            this.span,
            FULL_SWIPE_SHARE,
            Boolean(this.config.leading),
            Boolean(this.config.trailingFull),
          ),
        );
      },
      onPanResponderRelease: (_, gesture) =>
        this.release(this.clamp(this.base + gesture.dx), gesture.vx),
      onPanResponderTerminate: () => {
        this.setArmed(null);
        this.slide(this.open ? -this.trailingWidth : 0);
      },
      // Einmal gewischt, bleibt die Geste bei der Zeile — sonst springt die Liste mit.
      onPanResponderTerminationRequest: () => false,
    });
  }

  setConfig(config: SwipeConfig) {
    this.config = config;
  }

  setWidth(width: number) {
    this.width = width;
  }

  /** Aus einem Knopf oder der Bedienungshilfe: schliessen und ausloesen. */
  perform(action: SwipeAction) {
    this.close();
    action.onPress();
  }

  close() {
    this.setOpen(false);
    this.slide(0);
  }

  /** Solange die Zeile noch nicht vermessen ist, gilt die Fensterbreite — nie null. */
  private get span() {
    return this.width > 0 ? this.width : Dimensions.get('window').width;
  }

  private get trailingWidth() {
    return this.config.trailing.length * ACTION_WIDTH;
  }

  private accepts(dx: number) {
    if (this.open) return true;
    if (dx < 0) return this.config.trailing.length > 0 || Boolean(this.config.trailingFull);
    return Boolean(this.config.leading);
  }

  private clamp(x: number) {
    const min = this.config.trailingFull ? -this.span : -this.trailingWidth;
    const max = this.config.leading ? this.span : 0;
    return Math.min(max, Math.max(min, x));
  }

  private release(x: number, vx: number) {
    this.setArmed(null);
    const { leading, trailingFull } = this.config;
    const outcome = resolveSwipeRelease({
      x,
      vx,
      width: this.span,
      trailingWidth: this.trailingWidth,
      hasLeading: Boolean(leading),
      hasTrailingFull: Boolean(trailingFull),
      fullShare: FULL_SWIPE_SHARE,
      flingVelocity: FLING_VELOCITY,
    });

    if (outcome === 'leading' && leading) {
      this.close();
      leading.onPress();
      return;
    }
    if (outcome === 'trailingFull' && trailingFull) {
      this.setOpen(false);
      this.slide(-this.span, () => {
        trailingFull.onPress();
        // Bleibt die Zeile stehen (etwa weil das Loeschen scheiterte), kommt sie zurueck.
        this.translateX.setValue(0);
      });
      return;
    }
    if (outcome === 'openTrailing') {
      this.setOpen(true);
      this.slide(-this.trailingWidth);
      return;
    }
    this.close();
  }

  private setOpen(open: boolean) {
    if (this.open === open) return;
    this.open = open;
    this.onOpenChange(open);
  }

  private setArmed(side: SwipeSide | null) {
    if (this.armed === side) return;
    this.armed = side;
    this.onArmedChange(side);
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

function toneColors(theme: Theme, tone: SwipeActionTone) {
  if (tone === 'danger')
    return { background: theme.colors.danger, foreground: theme.colors.surface };
  if (tone === 'accent') {
    return { background: theme.colors.accent, foreground: theme.colors.textOnAccent };
  }
  return { background: theme.colors.textMuted, foreground: theme.colors.surface };
}

/**
 * Eine Zeile, die man wischt wie in Mail und Erinnerungen:
 *
 * - **nach rechts ganz durch** — `leading` (Erledigt, Gelesen, Anheften)
 * - **nach links halb** — die Knoepfe aus `trailing` stehen daneben
 * - **nach links ganz durch** — `trailingFull` (Loeschen, Archivieren)
 *
 * Ein Tipp auf die offene Zeile oder ein Wisch zurueck schliesst sie wieder.
 * Wer nicht wischen kann, findet jede Aktion bei der Bedienungshilfe.
 */
export function SwipeRow({
  children,
  leading,
  trailing,
  trailingFull,
  onDelete,
  deleteLabel,
  radius = 0,
  backgroundColor,
}: SwipeRowProps) {
  const theme = useTheme();
  const t = useTranslate();

  const deleteAction: SwipeAction | undefined = onDelete
    ? {
        key: 'delete',
        label: deleteLabel ?? t('common.delete'),
        icon: 'trash',
        tone: 'danger',
        onPress: onDelete,
      }
    : undefined;
  const trailingActions = trailing ?? (deleteAction ? [deleteAction] : []);
  const fullAction = trailingFull ?? deleteAction;

  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState<SwipeSide | null>(null);
  const [controller] = useState(() => new SwipeController(theme.motion, setOpen, setArmed));

  // Die neuesten Aktionen, ohne den Controller neu zu bauen.
  useEffect(() => {
    controller.setConfig({ leading, trailing: trailingActions, trailingFull: fullAction });
  });

  const actions = [leading, ...trailingActions, fullAction]
    .filter((action): action is SwipeAction => action !== undefined)
    .filter((action, index, list) => list.findIndex((other) => other.key === action.key) === index);

  // Die Flaechen erscheinen erst, wenn die Zeile sich bewegt — sonst blitzen
  // sie an den runden Ecken durch.
  const leadingOpacity = controller.translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const trailingOpacity = controller.translateX.interpolate({
    inputRange: [-1, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Ohne eigenen Radius ist die Zeile Teil einer Karte: dort bleibt sie beim
  // Wischen in ihren Grenzen, statt ueber den Kartenrand zu gleiten. Eigenstaendige
  // Karten schneiden wir nicht ab, sonst verschwindet ihr Schatten.
  const inCard = radius === 0;
  const leadingColors = leading ? toneColors(theme, leading.tone) : null;
  const fullColors = fullAction ? toneColors(theme, fullAction.tone) : null;

  return (
    <View
      style={inCard ? styles.clip : null}
      onLayout={(event) => controller.setWidth(event.nativeEvent.layout.width)}
    >
      {leading && leadingColors ? (
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            StyleSheet.absoluteFill,
            styles.leading,
            styles.nonInteractive,
            {
              backgroundColor: leadingColors.background,
              borderRadius: radius,
              paddingHorizontal: theme.spacing.xl,
              opacity: leadingOpacity,
            },
          ]}
        >
          <ActionFace
            action={leading}
            color={leadingColors.foreground}
            armed={armed === 'leading'}
          />
        </Animated.View>
      ) : null}

      {trailingActions.length > 0 || fullAction ? (
        // Geschlossen gehoeren die Knoepfe nicht zur Bedienungshilfe — dort gibt es die Aktionen.
        <Animated.View
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          style={[
            StyleSheet.absoluteFill,
            styles.trailing,
            {
              backgroundColor: fullColors?.background,
              borderRadius: radius,
              opacity: trailingOpacity,
            },
          ]}
        >
          {armed === 'trailing' && fullAction && fullColors ? (
            <View style={[styles.action, { width: ACTION_WIDTH }]}>
              <ActionFace action={fullAction} color={fullColors.foreground} armed />
            </View>
          ) : (
            trailingActions.map((action) => {
              const colors = toneColors(theme, action.tone);
              return (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => controller.perform(action)}
                  style={[
                    styles.action,
                    { width: ACTION_WIDTH, backgroundColor: colors.background },
                  ]}
                >
                  <ActionFace action={action} color={colors.foreground} armed={false} />
                </Pressable>
              );
            })
          )}
        </Animated.View>
      ) : null}

      <Animated.View
        accessibilityActions={actions.map((action) => ({ name: action.key, label: action.label }))}
        onAccessibilityAction={(event) => {
          const action = actions.find((entry) => entry.key === event.nativeEvent.actionName);
          if (action) controller.perform(action);
        }}
        // Die Zeile deckt die Aktionen ab — auch Zeilen, die selbst durchsichtig sind.
        style={{
          backgroundColor: backgroundColor ?? theme.colors.surface,
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

function ActionFace({
  action,
  color,
  armed,
}: {
  action: SwipeAction;
  color: string;
  armed: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.face, { gap: theme.spacing.xs }]}>
      <View style={{ transform: [{ scale: armed ? ARMED_SCALE : 1 }] }}>
        <Icon name={action.icon} size={20} color={color} />
      </View>
      <Text variant="caption" numberOfLines={1} style={{ color }}>
        {action.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  nonInteractive: { pointerEvents: 'none' },
  leading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  trailing: { flexDirection: 'row', justifyContent: 'flex-end', overflow: 'hidden' },
  action: { alignItems: 'center', justifyContent: 'center' },
  face: { alignItems: 'center', justifyContent: 'center' },
});
