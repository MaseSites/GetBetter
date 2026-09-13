import { useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';

import { useTranslate } from '@/i18n';

import { LONG_PRESS_MS } from './layout';
import { Menu, measureAnchor, type MenuAnchor, type MenuEntry } from './Menu';

export type ContextMenuProps = {
  items: readonly MenuEntry[];
  children: ReactNode;
  /** Der normale Tipp — meistens oeffnen. */
  onPress?: () => void;
  /**
   * Auf Android heisst ein langer Druck: auswaehlen. Wer das anbietet, gibt es
   * hier mit — dann kommt dort kein Menue. Auf iOS und im Browser wirkt es nicht.
   */
  onSelectMode?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Ein langer Druck oeffnet ein Menue am Druckpunkt, wie das Kontextmenue auf
 * dem iPhone. Die Bedienungshilfe erreicht es als Aktion „Weitere Aktionen“.
 *
 * Kein Knopf im Knopf: mit `onPress` ist der Wrapper selbst der Knopf, der
 * Inhalt darf dann keinen eigenen Tipp mehr haben.
 */
export function ContextMenu({
  items,
  children,
  onPress,
  onSelectMode,
  disabled = false,
  accessibilityLabel,
  style,
}: ContextMenuProps) {
  const t = useTranslate();
  const node = useRef<View>(null);
  // Der Anker bleibt beim Schliessen stehen, damit das Menue am Ort ausblendet.
  const [menu, setMenu] = useState<{ anchor: MenuAnchor; open: boolean } | null>(null);

  const selects = Platform.OS === 'android' && onSelectMode !== undefined;
  const hasMenu = items.length > 0;

  function handleLongPress(event: GestureResponderEvent) {
    if (selects) {
      onSelectMode?.();
      return;
    }
    if (!hasMenu) return;
    const { pageX, pageY } = event.nativeEvent;
    setMenu({ anchor: { x: pageX, y: pageY, width: 0, height: 0 }, open: true });
  }

  async function openFromAccessibility() {
    if (selects) {
      onSelectMode?.();
      return;
    }
    if (!hasMenu) return;
    const anchor = await measureAnchor(node.current);
    if (anchor) setMenu({ anchor, open: true });
  }

  return (
    <>
      <Pressable
        ref={node}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={
          hasMenu || selects ? [{ name: 'longpress', label: t('ui.menu.more') }] : undefined
        }
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'longpress') void openFromAccessibility();
        }}
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={LONG_PRESS_MS}
        disabled={disabled}
        style={style}
      >
        {children}
      </Pressable>
      <Menu
        visible={menu?.open ?? false}
        anchor={menu?.anchor ?? null}
        items={items}
        onClose={() => setMenu((current) => (current ? { ...current, open: false } : null))}
      />
    </>
  );
}
