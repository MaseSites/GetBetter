import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

import { useI18n } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import { useTheme } from '@/theme';
import { Icon, ModuleIcon, SectionHead, Text, usePhoneFrame } from '@/ui';

import { QuickAccessSheet } from './QuickAccessSheet';
import { StarButton } from './StarButton';
import { appNameOf, useFavorites, useQuickAccess, type QuickEntry } from './useFavorites';

/** Ein Platz. Der Rastabstand ist genau eine Objektbreite — die Seitenobjekte sind kleiner. */
const CARD_WIDTH = 108;
const CARD_HEIGHT = 130;
const SPAN = CARD_WIDTH;
/** Das Plus bleibt bewusst kompakter als die frei schwebenden Bilder. */
const PLUS_BOX = 64;
const PLUS_GLYPH = 30;
/** Im Browser gibt es kein Einrasten; so lange nach dem letzten Ruck rastet das Band ein. */
const SETTLE_MS = 120;

/**
 * Abstand zur Mitte in Karten, von rechts nach links — so wachsen die
 * Eingaben der Interpolation. Drei Karten je Seite reichen: weiter aussen
 * liegt nichts mehr im Bild.
 */
const DEPTH = [3, 2, 1, 0, -1, -2, -3] as const;
/**
 * Die Bilder stehen auf einem Ring, behalten aber wie Plakatwaende stets den
 * direkten Blick zum Betrachter. `translateZ` kennt React Native nicht, die
 * Tiefe entsteht darum aus Versatz, Groesse, Hoehe und Deckkraft.
 */
const SCALE = [0.72, 0.84, 0.94, 1, 0.94, 0.84, 0.72];
/** `R · sin(Winkel)` minus dem, was die Rollfläche schon verschoben hat. */
const SHIFT = [-134, -67, -27, 0, 27, 67, 134];
const OPACITY = [0.3, 0.6, 0.9, 1, 0.9, 0.6, 0.3];
/** Das mittlere Bild schwebt am hoechsten, entfernte sinken sanft zurueck. */
const LIFT = [12, 7, 3, 0, 3, 7, 12];

const useNativeDriver = Platform.OS !== 'web';

/**
 * Die Rollposition und das Einrasten im Browser, ausserhalb von React: beim
 * Rollen wird nichts gerendert. Entsteht einmal per `useState(() => new …)`.
 */
class CoverFlowMotion {
  readonly scrollX = new Animated.Value(0);
  private findView: () => ScrollView | null = () => null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: this.scrollX } } }], {
    useNativeDriver,
    listener: (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      this.scheduleSettle(event.nativeEvent.contentOffset.x),
  });

  /** Auf dem Geraet rastet `snapToInterval`; im Browser erst, wenn es still ist. */
  private scheduleSettle(x: number) {
    if (Platform.OS !== 'web') return;
    this.clear();
    this.timer = setTimeout(() => this.settle(x), SETTLE_MS);
  }

  private settle(x: number) {
    const target = Math.max(0, Math.round(x / SPAN)) * SPAN;
    if (Math.abs(x - target) > 0.5) this.findView()?.scrollTo({ x: target, animated: true });
  }

  /** Wo das Band steckt — aus einem Effekt nachgereicht, der Ref haengt erst nach dem Rendern. */
  setView(findView: () => ScrollView | null) {
    this.findView = findView;
  }

  clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

/**
 * Schnellzugriff auf der Startseite: die Favoriten des Kontos als Karussell
 * mit Tiefe. Die mittlere Karte steht gerade und gross, die seitlichen drehen
 * sich weg. Die letzte Karte ist „+“ und oeffnet das Blatt; langes Druecken auf
 * eine Karte ebenso. Braucht keine Props.
 *
 * Das Band reicht bis an den Bildschirmrand: es nimmt den Seitenrand von
 * `Screen` mit einem negativen Aussenabstand zurueck.
 */
export function QuickAccess() {
  const { t } = useI18n();
  const theme = useTheme();
  // Zwei Listen: das Karussell zeigt den Schnellzugriff, der Stern die Favoriten.
  const quick = useQuickAccess();
  const favorites = useFavorites();
  const [motion] = useState(() => new CoverFlowMotion());
  const scrollRef = useRef<ScrollView>(null);
  const frame = usePhoneFrame();
  // Bis gemessen ist, gilt die Breite des Telefons — so steht das Band gleich
  // beim ersten Bild in der Mitte.
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? frame.width;
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    motion.setView(() => scrollRef.current);
    return () => motion.clear();
  }, [motion]);

  const openSheet = () => setEditing(true);
  const closeSheet = () => setEditing(false);
  const entries = quick.entries;

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0) setMeasured(next);
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionHead title={t('quick.title')} />
      <View
        onLayout={onLayout}
        style={[
          styles.stage,
          { marginHorizontal: -theme.spacing.edge, height: CARD_HEIGHT + theme.spacing.lg },
        ]}
      >
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={motion.onScroll}
          scrollEventThrottle={16}
          snapToInterval={SPAN}
          decelerationRate="fast"
          contentContainerStyle={[
            styles.track,
            // So viel Rand, dass die erste und die letzte Karte in die Mitte kommen.
            { paddingHorizontal: Math.max(0, (width - SPAN) / 2) },
          ]}
        >
          {entries.map((entry, index) => (
            <CoverSlot key={entry.key} index={index} scrollX={motion.scrollX}>
              <View>
                <FavoriteCard
                  entry={entry}
                  foreign={entry.appId !== quick.currentAppId}
                  onOpen={() => quick.open(entry.appId, entry.module.id)}
                  onEdit={openSheet}
                />
                {/* Der Stern gehoert den Favoriten. Er sitzt neben der Karte,
                    nie darin — ein Knopf im Knopf waere im Browser ungueltig. */}
                <View style={styles.star}>
                  <StarButton
                    active={favorites.isFavorite(entry.appId, entry.module.id)}
                    name={moduleName(t, entry.module.id)}
                    onPress={() => favorites.toggle(entry.appId, entry.module.id)}
                  />
                </View>
              </View>
            </CoverSlot>
          ))}
          <CoverSlot index={entries.length} scrollX={motion.scrollX}>
            <AddCard onPress={openSheet} />
          </CoverSlot>
        </Animated.ScrollView>
      </View>
      <QuickAccessSheet visible={editing} onClose={closeSheet} />
    </View>
  );
}

/** Ein Platz im Band; Drehung, Groesse und Deckkraft folgen der Rollposition. */
function CoverSlot({
  index,
  scrollX,
  children,
}: {
  index: number;
  scrollX: Animated.Value;
  children: ReactNode;
}) {
  const animated = useMemo(() => {
    const inputRange = DEPTH.map((depth) => (index - depth) * SPAN);
    const numbers = (outputRange: number[]) =>
      scrollX.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
    return {
      opacity: numbers(OPACITY),
      transform: [
        { translateX: numbers(SHIFT) },
        { translateY: numbers(LIFT) },
        { scale: numbers(SCALE) },
      ],
    };
  }, [index, scrollX]);

  return <Animated.View style={[styles.slot, animated]}>{children}</Animated.View>;
}

function FavoriteCard({
  entry,
  foreign,
  onOpen,
  onEdit,
}: {
  entry: QuickEntry;
  foreign: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const appName = appNameOf(entry.appId);
  const name = moduleName(t, entry.module.id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={foreign ? t('quick.inApp', { name, app: appName }) : name}
      accessibilityHint={t('quick.editHint')}
      onPress={onOpen}
      onLongPress={onEdit}
      style={({ pressed }) => [
        styles.card,
        {
          gap: theme.spacing.xs,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <ModuleIcon moduleId={entry.module.id} icon={entry.module.icon} size="xl" />
      <View style={styles.cardText}>
        <Text
          variant="label"
          align="center"
          numberOfLines={1}
          style={{ fontWeight: theme.fontWeight.semibold }}
        >
          {name}
        </Text>
        {foreign ? (
          <Text variant="caption" tone="faint" align="center" numberOfLines={1}>
            {appName}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Das letzte Objekt: ein kompaktes Plus mit „Hinzufuegen“. */
function AddCard({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('quick.add')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          gap: theme.spacing.xs,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.plus,
          { borderRadius: theme.radii.md, backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        <Icon name="plus" size={PLUS_GLYPH} color={theme.colors.textMuted} />
      </View>
      <Text variant="label" tone="muted" align="center" numberOfLines={1}>
        {t('quick.add')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { justifyContent: 'center' },
  track: { alignItems: 'center' },
  slot: { width: SPAN, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { alignSelf: 'stretch', alignItems: 'center', gap: 1 },
  // Der Stern liegt in der oberen Ecke der Karte, ohne ihre Hoehe zu aendern.
  star: { position: 'absolute', top: 0, right: 0 },
  plus: { width: PLUS_BOX, height: PLUS_BOX, alignItems: 'center', justifyContent: 'center' },
});
