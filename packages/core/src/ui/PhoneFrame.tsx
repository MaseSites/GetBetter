import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { formatTime } from '@/i18n/format';
import { numeric, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

/**
 * Die Masse eines iPhone 12, in Punkten — Geraetemasse, keine Design-Tokens:
 * sie stehen fest, weil das Geraet feststeht. Der Bildschirm ist 390 x 844,
 * der Rahmen liegt **aussen** darum, damit die App wirklich 390 breit ist.
 */
export const PHONE_WIDTH = 390;
export const PHONE_HEIGHT = 844;

/** Die runde Ecke des Bildschirms, wie Apple sie zeichnet. */
export const PHONE_RADIUS = 47.33;
/** Oberer Sicherheitsabstand (Statusleiste) und unterer (Home-Anzeige). */
const STATUS_BAR_HEIGHT = 47;
const BOTTOM_INSET = 34;
/** Die Kerbe haengt oben in den Bildschirm hinein. */
const NOTCH_WIDTH = 157;
const NOTCH_HEIGHT = 33;
const NOTCH_RADIUS = 20;
const HOME_INDICATOR_WIDTH = 134;
const HOME_INDICATOR_HEIGHT = 5;
/** Schwarzer Rand um das Glas und die Metallkante darum. */
const BEZEL = 12;
const RIM = 3;
const EDGE = BEZEL + RIM;
const DEVICE_WIDTH = PHONE_WIDTH + EDGE * 2;
const DEVICE_HEIGHT = PHONE_HEIGHT + EDGE * 2;
const DEVICE_RADIUS = PHONE_RADIUS + EDGE;
/** Der Platz, den das Geraet im Browserfenster ringsum braucht. */
const PAGE_GUTTER = 24;
/** Kleiner gezeigt taugt das Telefon nichts mehr — dann lieber das Fenster. */
const MIN_SCALE = 0.6;

/** Die Knoepfe auf der Metallkante, von oben gemessen. */
const BUTTONS = [
  { key: 'ring', side: 'left', top: 148, height: 30 },
  { key: 'up', side: 'left', top: 198, height: 62 },
  { key: 'down', side: 'left', top: 274, height: 62 },
  { key: 'power', side: 'right', top: 238, height: 96 },
] as const;

/** Das Geraet behaelt seine Farbe, auch wenn die App hell steht. */
const BODY = '#08090B';
const RIM_METAL = ['#8A9099', '#23262C', '#2E3239', '#23262C', '#8A9099'] as const;
const RIM_STOPS = [0, 0.05, 0.5, 0.95, 1] as const;
const NOTCH_SPEAKER = '#16181C';
const NOTCH_LENS = '#0B1822';
const NOTCH_LENS_GLINT = 'rgba(120, 170, 220, 0.5)';
/** Eine Politur auf dem schwarzen Rand — nie ueber dem Bildschirm. */
const BEZEL_SHEEN = ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'] as const;
const DEVICE_SHADOW =
  '0 1px 1px rgba(255,255,255,0.22) inset, 0 -1px 2px rgba(0,0,0,0.6) inset,' +
  ' 0 44px 80px -30px rgba(0,0,0,0.55), 0 14px 28px -14px rgba(0,0,0,0.32)';

/** Die Statusleiste ist in zwei Ohren geteilt, dazwischen sitzt die Kerbe. */
const EAR_WIDTH = (PHONE_WIDTH - NOTCH_WIDTH) / 2;
const EAR_PADDING = 18;
const BATTERY_LEVEL = 0.8;

/** Im Rahmen gelten die Sicherheitsabstaende des Geraets, nicht die des Browsers. */
const FRAME_INSETS = { top: 0, right: 0, bottom: BOTTOM_INSET, left: 0 };

type Props = { children: ReactNode };

export type PhoneFrameMetrics = {
  /** Ob der Telefonrahmen gerade gezeichnet wird. */
  framed: boolean;
  /** Der Bildschirm in Punkten — im Rahmen immer die echten 390 x 844. */
  width: number;
  height: number;
  /**
   * Wie stark das Geraet verkleinert auf dem Schirm steht. Innen rechnet die
   * App weiter in Punkten; wer ausserhalb des Rahmens zeichnet (Blatt, Menue),
   * muss damit umrechnen.
   */
  scale: number;
};

/**
 * Wie gross das Geraet in diesem Fenster gezeigt werden kann. Null heisst:
 * gar nicht — in einem schmalen Fenster ist der Rahmen nur im Weg, und ein
 * Telefon im Telefon waere ohnehin Unsinn.
 */
function scaleFor(width: number, height: number): number {
  if (width < DEVICE_WIDTH + PAGE_GUTTER * 2) return 0;
  const fit = (height - PAGE_GUTTER * 2) / DEVICE_HEIGHT;
  return Math.min(1, fit);
}

/**
 * Damit sich Blaetter und Dialoge in den Rahmen legen statt ueber das
 * ganze Browserfenster. Auf dem Geraet ist `framed` immer false.
 */
export function usePhoneFrame(): PhoneFrameMetrics {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web') return { framed: false, width, height, scale: 1 };
  const scale = scaleFor(width, height);
  if (scale < MIN_SCALE) return { framed: false, width, height, scale: 1 };
  return { framed: true, width: PHONE_WIDTH, height: PHONE_HEIGHT, scale };
}

/**
 * P-002: Auf Web legt diese Komponente den Inhalt in ein iPhone 12 — der
 * Bildschirm misst wirklich 390 x 844 Punkte, der Rahmen liegt aussen darum.
 * Passt das Geraet nicht ins Fenster, wird es als Ganzes verkleinert, statt
 * den Bildschirm zu beschneiden: sonst sieht man nicht, was ein Telefon zeigt.
 *
 * Auf einem echten Geraet rendert sie die Kinder unveraendert.
 */
export function PhoneFrame({ children }: Props) {
  const theme = useTheme();
  const frame = usePhoneFrame();

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  // In einem kleinen Browserfenster ist der Rahmen nur im Weg.
  if (!frame.framed) {
    return <View style={styles.fill}>{children}</View>;
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.surfaceMuted }]}>
      <View style={[styles.device, { transform: [{ scale: frame.scale }] }]}>
        <Buttons />
        <LinearGradient
          colors={RIM_METAL}
          locations={RIM_STOPS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.rim, { borderRadius: DEVICE_RADIUS }]}
        >
          <View style={[styles.bezel, { borderRadius: DEVICE_RADIUS - RIM }]}>
            <LinearGradient
              colors={BEZEL_SHEEN}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 0.45 }}
              style={[styles.sheen, { borderRadius: DEVICE_RADIUS - RIM }]}
            />
            <View
              style={[
                styles.screen,
                { borderRadius: PHONE_RADIUS, backgroundColor: theme.colors.background },
              ]}
            >
              <StatusBar />
              <View style={styles.fill}>
                <SafeAreaInsetsContext.Provider value={FRAME_INSETS}>
                  {children}
                </SafeAreaInsetsContext.Provider>
              </View>
              <Notch />
              <HomeIndicator />
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

/** Klingelschalter, lauter, leiser und der Seitenknopf — auf der Metallkante. */
function Buttons() {
  return (
    <>
      {BUTTONS.map((button) => (
        <LinearGradient
          key={button.key}
          colors={RIM_METAL}
          locations={RIM_STOPS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.button,
            button.side === 'left' ? styles.buttonLeft : styles.buttonRight,
            { top: button.top, height: button.height },
          ]}
        />
      ))}
    </>
  );
}

/** Die Kerbe haengt an der Oberkante des Glases: Hoerer und Kamera. */
function Notch() {
  return (
    <View
      style={[
        styles.notch,
        {
          width: NOTCH_WIDTH,
          height: NOTCH_HEIGHT,
          marginLeft: -NOTCH_WIDTH / 2,
          borderBottomLeftRadius: NOTCH_RADIUS,
          borderBottomRightRadius: NOTCH_RADIUS,
        },
      ]}
    >
      <View style={styles.speaker} />
      <View style={styles.lens}>
        <View style={styles.lensGlint} />
      </View>
    </View>
  );
}

/**
 * Der Strich unten, ueber allem: auf dem Geraet liegt er ueber der Tab-Leiste.
 *
 * Er nimmt keine Themafarbe, sondern kehrt um, was hinter ihm liegt — sonst
 * verschwaende er auf dem dunklen Feld der Anmeldung. Genau das tut iOS auch.
 */
function HomeIndicator() {
  return (
    <View
      style={[
        styles.homeIndicator,
        {
          width: HOME_INDICATOR_WIDTH,
          height: HOME_INDICATOR_HEIGHT,
          marginLeft: -HOME_INDICATOR_WIDTH / 2,
        },
      ]}
    />
  );
}

/** Die Uhr der Statusleiste geht richtig — ein echtes Telefon zeigt jetzt. */
function useClock(): string {
  const { language } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  return formatTime(language, new Date(now).toISOString());
}

/**
 * Die Statusleiste von iOS: Uhrzeit im linken Ohr, Empfang, WLAN und Batterie
 * im rechten. Sie folgt dem Thema der App — das tut die echte auch.
 */
function StatusBar() {
  const theme = useTheme();
  const clock = useClock();
  const ink = theme.colors.text;

  return (
    <View style={[styles.statusBar, { height: STATUS_BAR_HEIGHT }]}>
      <View style={[styles.ear, styles.earLeft, { width: EAR_WIDTH }]}>
        <Text
          variant="caption"
          style={[
            numeric,
            { fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: ink },
          ]}
        >
          {clock}
        </Text>
      </View>
      <View style={{ width: NOTCH_WIDTH }} />
      <View
        style={[
          styles.ear,
          styles.earRight,
          { width: EAR_WIDTH, paddingRight: EAR_PADDING, gap: theme.spacing.xs },
        ]}
      >
        <Icon name="cellular" size={16} color={ink} />
        <Icon name="wifi" size={16} color={ink} />
        <Battery color={ink} />
      </View>
    </View>
  );
}

function Battery({ color }: { color: string }) {
  return (
    <View style={styles.batteryRow}>
      <View style={[styles.battery, { borderColor: color }]}>
        <View style={[styles.batteryFill, { flex: BATTERY_LEVEL, backgroundColor: color }]} />
      </View>
      <View style={[styles.batteryCap, { backgroundColor: color }]} />
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
  device: { width: DEVICE_WIDTH, height: DEVICE_HEIGHT },
  rim: {
    flex: 1,
    padding: RIM,
    boxShadow: DEVICE_SHADOW,
  },
  bezel: {
    flex: 1,
    padding: BEZEL,
    backgroundColor: BODY,
  },
  sheen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
  screen: { flex: 1, overflow: 'hidden' },
  button: {
    position: 'absolute',
    width: RIM * 2,
    borderRadius: RIM,
  },
  buttonLeft: { left: -RIM },
  buttonRight: { right: -RIM },
  notch: {
    position: 'absolute',
    top: 0,
    left: '50%',
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingBottom: 4,
    pointerEvents: 'none',
  },
  speaker: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: NOTCH_SPEAKER,
  },
  lens: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: NOTCH_LENS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensGlint: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: NOTCH_LENS_GLINT,
    transform: [{ translateX: -1 }, { translateY: -1 }],
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    mixBlendMode: 'difference',
    pointerEvents: 'none',
  },
  statusBar: {
    pointerEvents: 'none',
    flexDirection: 'row',
    alignItems: 'center',
  },
  ear: { flexDirection: 'row', alignItems: 'center' },
  earLeft: { justifyContent: 'center' },
  earRight: { justifyContent: 'flex-end' },
  batteryRow: { flexDirection: 'row', alignItems: 'center' },
  battery: {
    width: 25,
    height: 13,
    borderWidth: 1,
    borderRadius: 4,
    padding: 1.5,
    opacity: 0.55,
    flexDirection: 'row',
  },
  batteryFill: { borderRadius: 1.5 },
  batteryCap: {
    width: 1.5,
    height: 5,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    marginLeft: 1,
    opacity: 0.45,
  },
});
