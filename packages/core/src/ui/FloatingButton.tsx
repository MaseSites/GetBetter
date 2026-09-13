import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { FLOATING_BUTTON_SIZE, HIT_TARGET } from './layout';
import { measureAnchor, type MenuAnchor } from './Menu';
import { AfterClose, Overlay } from './Overlay';
import { Text } from './Text';
import { useReserveFloatingButtonSpace } from './UndoToast';
import { usePressScale } from './usePressScale';
import { useReducedMotion } from './useReducedMotion';

export type FloatingButtonMenuItem = {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
};

export type FloatingButtonProps = {
  /** Was der Knopf tut — fuer die Bedienungshilfe. Sichtbar ist nur `text`. */
  label: string;
  icon?: IconName;
  /** Der Tipp. Mit `menu` oeffnet der Tipp das Menue, und `onPress` wird nicht gebraucht. */
  onPress?: () => void;
  /** Sichtbares Wort neben dem Symbol, etwa „Schreiben“ — daraus wird eine Pille. */
  text?: string;
  /** Beim Scrollen: nur das Symbol, das Wort klappt weg. */
  collapsed?: boolean;
  /** Ein kleines Menue, das nach oben aufgeht: Aufgabe · Notiz · E-Mail · Geburtstag. */
  menu?: readonly FloatingButtonMenuItem[];
  /** Auf einem Bildschirm mit Tab-Leiste: 16 ueber der Leiste statt ueber dem unteren Rand. */
  aboveTabBar?: boolean;
};

/** Der helle Ring, der den Knopf vom Inhalt darunter absetzt. */
const RING_WIDTH = 4;
/** So breit darf das Wort neben dem Symbol hoechstens werden. */
const TEXT_MAX_WIDTH = 160;

const useNativeDriver = Platform.OS !== 'web';

/**
 * Der Knopf unten rechts — der eine Ort zum Erstellen. Er legt sich ueber den
 * Inhalt, statt ihn zu verkuerzen.
 *
 * Er traegt Tinte, nicht die Signalfarbe: er steht auf jedem Bildschirm, und
 * was immer da ist, kann nicht gleichzeitig «jetzt» heissen.
 */
export function FloatingButton({
  label,
  icon = 'plus',
  onPress,
  text,
  collapsed = false,
  menu,
  aboveTabBar = false,
}: FloatingButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const press = usePressScale();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const reserve = useReserveFloatingButtonSpace();

  const node = useRef<View>(null);
  const [fan, setFan] = useState<{ anchor: MenuAnchor; open: boolean } | null>(null);
  const [expand] = useState(() => new Animated.Value(collapsed ? 0 : 1));

  // Solange der Knopf zu sehen ist, steht „Rückgängig“ darueber statt darauf.
  useEffect(() => (focused ? reserve() : undefined), [focused, reserve]);

  useEffect(() => {
    const to = collapsed ? 0 : 1;
    if (reduced === true) {
      expand.setValue(to);
      return;
    }
    // Breite laesst sich nicht nativ animieren.
    Animated.timing(expand, {
      toValue: to,
      duration: theme.motion.duration.reveal,
      easing: theme.motion.easing.out,
      useNativeDriver: false,
    }).start();
  }, [collapsed, reduced, expand, theme.motion]);

  const items = menu ?? [];
  const hasMenu = items.length > 0;

  async function handlePress() {
    if (!hasMenu) {
      onPress?.();
      return;
    }
    const anchor = await measureAnchor(node.current);
    if (anchor) setFan({ anchor, open: true });
  }

  return (
    <>
      <View
        ref={node}
        collapsable={false}
        style={[
          styles.place,
          {
            right: theme.spacing.lg,
            bottom: theme.spacing.lg + (aboveTabBar ? 0 : insets.bottom),
          },
        ]}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={hasMenu ? { expanded: fan?.open ?? false } : undefined}
          onPress={() => void handlePress()}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          style={[
            styles.button,
            theme.elevation.raised,
            {
              minWidth: FLOATING_BUTTON_SIZE,
              height: FLOATING_BUTTON_SIZE,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.inverse,
              borderWidth: RING_WIDTH,
              borderColor: theme.colors.background,
              transform: [{ scale: press.scale }],
            },
          ]}
        >
          <Icon name={icon} size={24} color={theme.colors.onInverse} />
          {text ? (
            <Animated.View
              style={[
                styles.textWrap,
                {
                  maxWidth: expand.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, TEXT_MAX_WIDTH],
                  }),
                  marginLeft: expand.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, theme.spacing.sm],
                  }),
                  marginRight: expand.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, theme.spacing.xs],
                  }),
                  opacity: expand,
                },
              ]}
            >
              <Text
                variant="label"
                numberOfLines={1}
                style={{ color: theme.colors.onInverse, fontWeight: theme.fontWeight.semibold }}
              >
                {text}
              </Text>
            </Animated.View>
          ) : null}
        </AnimatedPressable>
      </View>

      {hasMenu && fan ? (
        <FanMenu
          open={fan.open}
          anchor={fan.anchor}
          items={items}
          onClose={() => setFan((current) => (current ? { ...current, open: false } : null))}
        />
      ) : null}
    </>
  );
}

/** Das Menue des Knopfs: Punkte mit Wort und rundem Symbol, uebereinander, ueber dem Knopf. */
function FanMenu({
  open,
  anchor,
  items,
  onClose,
}: {
  open: boolean;
  anchor: MenuAnchor;
  items: readonly FloatingButtonMenuItem[];
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useTranslate();
  const window = useWindowDimensions();
  const reduced = useReducedMotion();
  const [after] = useState(() => new AfterClose());
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!open) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: theme.motion.duration.reveal,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }, [open, progress, theme.motion]);

  // Die runden Symbole stehen mittig ueber dem runden Ende des Knopfs.
  const right = window.width - (anchor.x + anchor.width) + (anchor.height - HIT_TARGET) / 2;
  const bottom = window.height - anchor.y + theme.spacing.md;

  const transform =
    reduced === true
      ? []
      : [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [theme.spacing.lg, 0],
            }),
          },
        ];

  return (
    <Overlay visible={open} onClose={onClose} dim onDismiss={() => after.flush()}>
      <Animated.View
        accessibilityRole="menu"
        style={[styles.fan, { right, bottom, gap: theme.spacing.md, opacity: progress, transform }]}
      >
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="menuitem"
            accessibilityLabel={item.label}
            onPress={() => after.run(onClose, item.onPress)}
            style={[styles.fanItem, { gap: theme.spacing.md }]}
          >
            <View
              style={[
                theme.elevation.card,
                {
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.radii.pill,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <Text variant="label">{item.label}</Text>
            </View>
            <View
              style={[
                styles.fanIcon,
                theme.elevation.raised,
                { borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface },
              ]}
            >
              <Icon name={item.icon} size={20} />
            </View>
          </Pressable>
        ))}
      </Animated.View>

      {/* Wo der Knopf war, steht jetzt Schliessen — derselbe Daumen, derselbe Ort. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={[
          styles.fanClose,
          theme.elevation.raised,
          {
            left: anchor.x + anchor.width - anchor.height,
            top: anchor.y,
            width: anchor.height,
            height: anchor.height,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.inverse,
            borderWidth: RING_WIDTH,
            borderColor: theme.colors.background,
          },
        ]}
      >
        <Icon name="close" size={24} color={theme.colors.onInverse} />
      </Pressable>
    </Overlay>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  place: { position: 'absolute' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  textWrap: { overflow: 'hidden' },
  fan: { position: 'absolute', alignItems: 'flex-end' },
  fanItem: { flexDirection: 'row', alignItems: 'center' },
  fanIcon: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanClose: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
