import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';

import type { Rect } from './menuPlacement';
import { usePhoneFrame } from './PhoneFrame';

export type OverlayProps = {
  visible: boolean;
  onClose: () => void;
  /** Dunkelt den Grund ab, etwa beim Menue des Knopfs unten rechts. */
  dim?: boolean;
  /** Nur auf iOS: sobald das Overlay ganz verschwunden ist. */
  onDismiss?: () => void;
  /** Absolut positioniert, in Fensterkoordinaten. */
  children: ReactNode;
};

/**
 * Die Flaeche, in der ein Menue stehen darf, in Fensterkoordinaten: im Browser
 * das Telefon, auf dem Geraet das Fenster ohne die Sicherheitsabstaende.
 */
export function useOverlayBounds(): Rect {
  const window = useWindowDimensions();
  const frame = usePhoneFrame();
  const insets = useSafeAreaInsets();
  if (frame.framed) {
    return {
      x: (window.width - frame.width) / 2,
      y: (window.height - frame.height) / 2,
      width: frame.width,
      height: frame.height,
    };
  }
  return {
    x: 0,
    y: insets.top,
    width: window.width,
    height: Math.max(0, window.height - insets.top - insets.bottom),
  };
}

/**
 * Was ein Menuepunkt ausloest, kommt erst, wenn das Menue zu ist. Auf iOS
 * oeffnet sich ein Blatt nicht, solange ein anderes Modal noch verschwindet —
 * dort wartet die Aktion auf `onDismiss`.
 */
export class AfterClose {
  private action: (() => void) | null = null;

  run(close: () => void, action: () => void): void {
    if (Platform.OS === 'ios') {
      this.action = action;
      close();
      return;
    }
    close();
    action();
  }

  flush(): void {
    const action = this.action;
    this.action = null;
    action?.();
  }
}

/**
 * Eine Ebene ueber allem, fuer Menues. Ein Tipp daneben schliesst, im Browser
 * auch Escape. Den Inhalt legt, wer sie benutzt, selbst an seinen Platz.
 */
export function Overlay({ visible, onClose, dim = false, onDismiss, children }: OverlayProps) {
  const theme = useTheme();
  const t = useTranslate();
  const frame = usePhoneFrame();
  const window = useWindowDimensions();
  const bounds = useOverlayBounds();

  // Im Browser dunkelt nur das Telefon ab, nicht das ganze Fenster.
  const shade = frame.framed
    ? {
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        borderRadius: theme.radii.xl,
      }
    : { left: 0, top: 0, width: window.width, height: window.height };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={styles.fill}>
        {dim ? (
          <View style={[styles.shade, shade, { backgroundColor: theme.colors.overlay }]} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shade: { position: 'absolute', pointerEvents: 'none' },
});
