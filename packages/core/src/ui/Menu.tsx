import { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type View as ViewType,
} from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { HIT_TARGET } from './layout';
import { placeMenu, type Rect } from './menuPlacement';
import { AfterClose, Overlay, useOverlayBounds } from './Overlay';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

export type MenuItem = {
  key: string;
  label: string;
  icon?: IconName;
  /** Rot: loescht oder entfernt etwas. */
  destructive?: boolean;
  disabled?: boolean;
  /** Gesetzt heisst: Haekchen. Sobald ein Punkt es kennt, bekommen alle die Spalte dafuer. */
  selected?: boolean;
  /** Ein kurzer Satz unter dem Namen, wo der Name allein nicht sagt, was passiert. */
  detail?: string;
  onPress: () => void;
};

/** Eine Linie zwischen zwei Gruppen. */
export type MenuDivider = { key: string; divider: true };

export type MenuEntry = MenuItem | MenuDivider;

/** Wo das Menue haengt, in Fensterkoordinaten. Ein Druckpunkt hat Breite und Hoehe 0. */
export type MenuAnchor = Rect;

export type MenuProps = {
  visible: boolean;
  onClose: () => void;
  anchor: MenuAnchor | null;
  items: readonly MenuEntry[];
  /** `start`: linke Kanten buendig (Standard); `end`: rechte Kanten. */
  align?: 'start' | 'end';
  /** Wohin es lieber geht; passt es dort nicht, geht es auf die andere Seite. */
  prefer?: 'below' | 'above';
  accessibilityLabel?: string;
};

const MENU_MIN_WIDTH = 220;
const MENU_MAX_WIDTH = 280;
/** So stark waechst das Menue beim Aufgehen heran. */
const ENTER_SCALE = 0.94;

const useNativeDriver = Platform.OS !== 'web';

export function isMenuDivider(entry: MenuEntry): entry is MenuDivider {
  return 'divider' in entry && entry.divider === true;
}

/** Misst ein Element fuer `anchor`. Nur in Handlern aufrufen, nie beim Rendern. */
export function measureAnchor(node: ViewType | null): Promise<MenuAnchor | null> {
  return new Promise((resolve) => {
    if (!node) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

/**
 * Ein kleines Menue neben seinem Anker: unter dem Titel, neben einem Knopf,
 * am Druckpunkt. Ein Tipp daneben oder Escape schliesst; ein Punkt schliesst
 * und loest danach aus. Hoechstens sieben Punkte, sonst ist es ein Blatt.
 */
export function Menu({
  visible,
  onClose,
  anchor,
  items,
  align = 'start',
  prefer = 'below',
  accessibilityLabel,
}: MenuProps) {
  const theme = useTheme();
  const bounds = useOverlayBounds();
  const reduced = useReducedMotion();

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const [after] = useState(() => new AfterClose());

  // Erst wenn die Groesse bekannt ist, weiss das Menue, wohin es gehoert.
  useEffect(() => {
    if (!visible || !size) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: theme.motion.duration.reveal,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }, [visible, size, progress, theme.motion]);

  const gap = theme.spacing.md;
  const placement =
    anchor && size ? placeMenu({ anchor, menu: size, bounds, gap, align, prefer }) : null;
  const showsCheck = items.some((entry) => !isMenuDivider(entry) && entry.selected !== undefined);

  const shift = placement?.above ? theme.spacing.sm : -theme.spacing.sm;
  const transform =
    reduced === true
      ? []
      : [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [shift, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_SCALE, 1] }) },
        ];

  function select(item: MenuItem) {
    after.run(onClose, item.onPress);
  }

  return (
    <Overlay visible={visible} onClose={onClose} onDismiss={() => after.flush()}>
      <Animated.View
        accessibilityRole="menu"
        accessibilityLabel={accessibilityLabel}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (!size || size.width !== width || size.height !== height) setSize({ width, height });
        }}
        style={[
          styles.menu,
          theme.elevation.raised,
          {
            left: placement?.left ?? anchor?.x ?? 0,
            top: placement?.top ?? anchor?.y ?? 0,
            minWidth: MENU_MIN_WIDTH,
            maxWidth: Math.min(MENU_MAX_WIDTH, bounds.width - gap * 2),
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surface,
            // Vor dem Vermessen unsichtbar, sonst blitzt es am falschen Ort auf.
            opacity: placement ? progress : 0,
            transform,
          },
        ]}
      >
        {items.map((entry) =>
          isMenuDivider(entry) ? (
            <View
              key={entry.key}
              style={[
                styles.divider,
                { marginVertical: theme.spacing.xs, backgroundColor: theme.colors.border },
              ]}
            />
          ) : (
            <MenuRow key={entry.key} item={entry} showsCheck={showsCheck} onSelect={select} />
          ),
        )}
      </Animated.View>
    </Overlay>
  );
}

function MenuRow({
  item,
  showsCheck,
  onSelect,
}: {
  item: MenuItem;
  showsCheck: boolean;
  onSelect: (item: MenuItem) => void;
}) {
  const theme = useTheme();
  const color = item.disabled
    ? theme.colors.disabledText
    : item.destructive
      ? theme.colors.danger
      : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={item.detail ? `${item.label}. ${item.detail}` : item.label}
      accessibilityState={{ disabled: item.disabled ?? false, selected: item.selected ?? false }}
      disabled={item.disabled}
      onPress={() => onSelect(item)}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: HIT_TARGET,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.md,
          backgroundColor: pressed ? theme.colors.surfaceMuted : undefined,
        },
      ]}
    >
      {showsCheck ? (
        <View style={styles.check}>
          {item.selected ? <Icon name="check" size={16} color={color} /> : null}
        </View>
      ) : null}
      <View style={[styles.label, item.detail ? { paddingVertical: theme.spacing.xs } : null]}>
        <Text variant="body" numberOfLines={1} style={{ color }}>
          {item.label}
        </Text>
        {item.detail ? (
          <Text variant="caption" tone="faint" numberOfLines={2}>
            {item.detail}
          </Text>
        ) : null}
      </View>
      {item.icon ? <Icon name={item.icon} size={18} color={color} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menu: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
  check: { width: 16, alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
});
