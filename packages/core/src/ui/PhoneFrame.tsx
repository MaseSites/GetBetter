import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

/** Massgabe aus dem Plan: 390 x 844 Punkte. */
export const PHONE_WIDTH = 390;
export const PHONE_HEIGHT = 844;

const STATUS_BAR_HEIGHT = 44;

type Props = { children: ReactNode };

export type PhoneFrameMetrics = {
  /** Ob der Telefonrahmen gerade gezeichnet wird. */
  framed: boolean;
  width: number;
  height: number;
};

/**
 * Damit sich Blaetter und Dialoge in den Rahmen legen statt ueber das
 * ganze Browserfenster. Auf dem Geraet ist `framed` immer false.
 */
export function usePhoneFrame(): PhoneFrameMetrics {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < PHONE_WIDTH + 64 || height < 560) {
    return { framed: false, width, height };
  }
  return { framed: true, width: PHONE_WIDTH, height: Math.min(PHONE_HEIGHT, height - 64) };
}

/**
 * P-002: Auf Web legt diese Komponente den Inhalt in einen zentrierten Telefonrahmen.
 * Auf einem echten Geraet rendert sie die Kinder unveraendert.
 */
export function PhoneFrame({ children }: Props) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  // In einem schmalen Browserfenster ist der Rahmen nur im Weg.
  const fitsFrame = width >= PHONE_WIDTH + 64 && height >= 560;
  if (!fitsFrame) {
    return <View style={styles.fill}>{children}</View>;
  }

  const frameHeight = Math.min(PHONE_HEIGHT, height - 64);

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.surfaceMuted }]}>
      <View
        style={[
          styles.frame,
          {
            width: PHONE_WIDTH,
            height: frameHeight,
            borderRadius: 44,
            borderColor: theme.colors.text,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <StatusBarMock />
        <View style={styles.fill}>{children}</View>
      </View>
    </View>
  );
}

function StatusBarMock() {
  const theme = useTheme();
  return (
    <View
      style={[styles.statusBar, { height: STATUS_BAR_HEIGHT, paddingHorizontal: theme.spacing.xl }]}
      pointerEvents="none"
    >
      <Text variant="caption" style={{ fontWeight: theme.fontWeight.semibold }}>
        9:41
      </Text>
      <View style={[styles.notch, { backgroundColor: theme.colors.text }]} />
      <View style={styles.statusIcons}>
        <View style={[styles.bar, { height: 6, backgroundColor: theme.colors.text }]} />
        <View style={[styles.bar, { height: 9, backgroundColor: theme.colors.text }]} />
        <View style={[styles.bar, { height: 12, backgroundColor: theme.colors.text }]} />
        <View
          style={[styles.battery, { borderColor: theme.colors.text, marginLeft: theme.spacing.xs }]}
        >
          <View style={[styles.batteryFill, { backgroundColor: theme.colors.text }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    overflow: 'hidden',
    borderWidth: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notch: {
    width: 96,
    height: 22,
    borderRadius: 999,
    opacity: 0.9,
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: { width: 3, borderRadius: 1 },
  battery: {
    width: 20,
    height: 11,
    borderWidth: 1,
    borderRadius: 3,
    padding: 1,
  },
  batteryFill: { flex: 1, borderRadius: 1 },
});
