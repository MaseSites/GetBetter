import { useEffect, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { noDragScrollId } from '@/app/webDragScroll';
import { useI18n } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Chip, Icon, Sheet, Text } from '@/ui';

import { blockColor, blockIcon, blockName, HomeBlockView } from './HomeBlockView';
import { HomeInspector } from './HomeInspector';
import { HomeTemplates } from './HomeTemplates';
import {
  BLOCK_KINDS,
  CORNERS,
  GRID_COLUMNS,
  GRID_ROW,
  blockScale,
  canvasRows,
  duplicateBlock,
  moveTo,
  newBlock,
  patchBlock,
  removeBlock,
  resizeBy,
  templateLayout,
  type Corner,
  type HomeBlock,
} from './homeLayout';
import { useHomeLayout } from './useHomeLayout';

/** So gross ist ein Eckgriff. */
const HANDLE = 28;
/** Der sichtbare Punkt darin. */
const DOT = 14;
/** So viele leere Zeilen stehen beim Bearbeiten unten bereit. */
const SPARE_ROWS = 2;
/** So viel Platz braucht die Karte unter dem gewaehlten Element. */
const INSPECTOR_ROWS = 5;

type Gesture = { id: string; corner: Corner | null };

/**
 * Die eigene Ansicht: eine freie Flaeche. Die Elemente liegen auf einem Raster
 * von vier Spalten; man landet gleich hier, ohne vorher eine Vorlage zu
 * waehlen — eine Vorlage ist nur ein Angebot.
 *
 * **Erst antippen, dann schieben.** Ein Tipp waehlt ein Element aus: es
 * bekommt einen Rahmen, die vier Eckgriffe und darunter seine Karte (Stil,
 * Groesse, Duplizieren, Entfernen). Erst jetzt faengt der Finger auf dem
 * Element an zu schieben statt zu rollen — so bleibt die Seite ueberall sonst
 * ganz normal zu rollen. Ein Tipp neben die Elemente hebt die Wahl wieder auf.
 *
 * Gemerkt wird alles je Konto auf dem Geraet.
 */
export function HomeCustom({ onAddTask }: { onAddTask: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const account = useAccount();
  const store = useHomeLayout(account.id);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<'add' | 'template' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  // Was gerade am Finger haengt.
  const [gesture, setGesture] = useState<Gesture | null>(null);
  /**
   * Wie das Element **jetzt gerade** liegt, waehrend der Finger zieht: es
   * rastet schon beim Ziehen ins Raster, damit man die neue Groesse samt
   * Inhalt sofort sieht. Gespeichert wird erst beim Loslassen.
   */
  const [draft, setDraft] = useState<HomeBlock | null>(null);
  // Der Rest zwischen zwei Rasterfeldern — damit das Schieben dem Finger folgt.
  const [moveX] = useState(() => new Animated.Value(0));
  const [moveY] = useState(() => new Animated.Value(0));

  const layout = store.layout ?? [];
  const empty = layout.length === 0;
  // Ohne Elemente ist immer Bearbeiten — sonst staende man vor einer leeren Flaeche.
  const editMode = editing || empty;
  const gap = theme.spacing.sm;
  const cell = width > 0 ? width / GRID_COLUMNS : 0;
  const chosen = editMode ? (layout.find((entry) => entry.id === selected) ?? null) : null;
  // Beim Bearbeiten ein paar leere Zeilen, und Platz fuer die Karte darunter.
  const rows = canvasRows(layout) + (editMode ? SPARE_ROWS : 0) + (chosen ? INSPECTOR_ROWS : 0);

  const rest = () => {
    moveX.setValue(0);
    moveY.setValue(0);
  };

  /** Was der Finger bisher ergeben hat — nur setzen, wenn es sich wirklich aendert. */
  const show = (next: HomeBlock) =>
    setDraft((current) =>
      current &&
      current.id === next.id &&
      current.x === next.x &&
      current.y === next.y &&
      current.w === next.w &&
      current.h === next.h
        ? current
        : next,
    );

  /** Bearbeiten an oder aus — die Wahl gilt nur beim Bearbeiten. */
  const toggleEditing = () => {
    setEditing((value) => !value);
    setSelected(null);
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <View style={styles.grow} />
        {editMode ? (
          <>
            <Chip label={t('home.build.add')} onPress={() => setSheet('add')} />
            <Chip label={t('home.build.template')} onPress={() => setSheet('template')} />
          </>
        ) : null}
        {empty ? null : (
          <Chip
            label={editing ? t('home.build.done') : t('home.build.edit')}
            selected={editing}
            onPress={toggleEditing}
          />
        )}
      </View>

      {editMode && !empty ? (
        <Text variant="caption" tone="muted">
          {chosen ? t('home.build.hintSelected') : t('home.build.hintIdle')}
        </Text>
      ) : null}

      {empty ? (
        <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="title">{t('home.build.startTitle')}</Text>
            <Text variant="label" tone="muted">
              {t('home.build.startBody')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.build.addFirst')}
            onPress={() => setSheet('add')}
            style={({ pressed }) => [
              styles.drop,
              {
                gap: theme.spacing.xs,
                paddingVertical: theme.spacing.xl,
                borderRadius: theme.radii.lg,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Icon name="plus" size={22} color={theme.colors.textMuted} />
            <Text variant="label" tone="muted">
              {t('home.build.addFirst')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: rows * GRID_ROW }}
      >
        {/* Ein Tipp neben die Elemente hebt die Wahl auf. */}
        {editMode && chosen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={() => setSelected(null)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {/* Beim Bearbeiten liegt das Raster blass darunter — man sieht, wohin es rastet. */}
        {editMode && cell > 0 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {Array.from({ length: rows + 1 }, (_, row) => (
              <View
                key={`line-${row}`}
                style={[
                  styles.gridLine,
                  { top: row * GRID_ROW, backgroundColor: theme.colors.border },
                ]}
              />
            ))}
            {Array.from({ length: GRID_COLUMNS - 1 }, (_, column) => (
              <View
                key={`column-${column}`}
                style={[
                  styles.gridColumn,
                  { left: (column + 1) * cell, backgroundColor: theme.colors.border },
                ]}
              />
            ))}
          </View>
        ) : null}

        {cell > 0
          ? layout.map((stored) => {
              // Waehrend des Ziehens gilt der Entwurf — Lage, Groesse und Inhalt.
              const entry = draft?.id === stored.id ? draft : stored;
              const picked = chosen?.id === entry.id;
              const dragging = gesture?.id === entry.id;
              const name = blockName(t, entry.kind);
              return (
                <Animated.View
                  key={entry.id}
                  style={[
                    styles.slot,
                    dragging ? theme.elevation.raised : null,
                    {
                      left: entry.x * cell + gap / 2,
                      top: entry.y * GRID_ROW + gap / 2,
                      width: entry.w * cell - gap,
                      height: entry.h * GRID_ROW - gap,
                      transform: dragging ? [{ translateX: moveX }, { translateY: moveY }] : [],
                      zIndex: picked ? 3 : 1,
                      opacity: dragging ? 0.95 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.face,
                      {
                        borderRadius: theme.radii.md,
                        ...(editMode
                          ? {
                              borderWidth: picked ? 2 : StyleSheet.hairlineWidth,
                              borderColor: picked ? theme.colors.accentMark : theme.colors.border,
                              padding: theme.spacing.xs,
                            }
                          : {}),
                      },
                    ]}
                  >
                    {editMode ? (
                      <View style={[styles.row, { gap: theme.spacing.xs }]}>
                        <Icon
                          name={blockIcon(entry.kind)}
                          size={14}
                          color={blockColor(theme, entry.kind)}
                        />
                        <Text variant="caption" tone="muted" numberOfLines={1} style={styles.grow}>
                          {name}
                        </Text>
                        {picked ? (
                          <Icon name="move" size={14} color={theme.colors.accentMark} />
                        ) : null}
                      </View>
                    ) : null}
                    {/* Im Bearbeiten ist der Inhalt nur Bild — der Finger waehlt und
                        schiebt. Ein schmales Element baut seinen Inhalt in voller
                        Breite und zieht ihn dann zusammen: so werden Formen und
                        Schrift mit kleiner, statt nur enger zu stehen. */}
                    <View style={styles.clip} pointerEvents={editMode ? 'none' : 'auto'}>
                      <View
                        style={{
                          width: `${100 / blockScale(entry.w)}%`,
                          height: `${100 / blockScale(entry.w)}%`,
                          transformOrigin: 'top left',
                          transform: [{ scale: blockScale(entry.w) }],
                        }}
                      >
                        <HomeBlockView block={entry} onAddTask={onAddTask} />
                      </View>
                    </View>
                  </View>

                  {/* Nicht gewaehlt: ein Tipp waehlt aus — und die Seite rollt weiter. */}
                  {editMode && !picked ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('home.build.selectName', { name })}
                      onPress={() => setSelected(stored.id)}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}

                  {/* Gewaehlt: der Finger schiebt das Element, die Ecken ziehen es gross. */}
                  {picked ? (
                    <>
                      <BlockGrip
                        id={noDragScrollId(`move-${stored.id}`)}
                        label={t('home.build.move', { name })}
                        style={StyleSheet.absoluteFill}
                        onStart={() => {
                          rest();
                          setGesture({ id: stored.id, corner: null });
                        }}
                        onMove={(dx, dy) => {
                          const next = moveTo(
                            stored,
                            stored.x + Math.round(dx / cell),
                            stored.y + Math.round(dy / GRID_ROW),
                          );
                          show(next);
                          // Das Element steht schon im Zielfeld; der Rest folgt dem Finger.
                          moveX.setValue(dx - (next.x - stored.x) * cell);
                          moveY.setValue(dy - (next.y - stored.y) * GRID_ROW);
                        }}
                        onEnd={(dx, dy) => {
                          const next = moveTo(
                            stored,
                            stored.x + Math.round(dx / cell),
                            stored.y + Math.round(dy / GRID_ROW),
                          );
                          setGesture(null);
                          setDraft(null);
                          rest();
                          store.save(patchBlock(layout, stored.id, next));
                        }}
                      />
                      {CORNERS.map((corner) => {
                        const left = corner === 'tl' || corner === 'bl';
                        const top = corner === 'tl' || corner === 'tr';
                        return (
                          <BlockGrip
                            key={corner}
                            id={noDragScrollId(`${corner}-${stored.id}`)}
                            label={t('home.build.resize', { name })}
                            style={[
                              styles.handle,
                              left ? { left: -HANDLE / 3 } : { right: -HANDLE / 3 },
                              top ? { top: -HANDLE / 3 } : { bottom: -HANDLE / 3 },
                            ]}
                            dot={{
                              backgroundColor: theme.colors.surface,
                              borderColor: theme.colors.accentMark,
                            }}
                            onStart={() => {
                              rest();
                              setGesture({ id: stored.id, corner });
                            }}
                            onMove={(dx, dy) => {
                              // Schon beim Ziehen die neue Groesse — samt Inhalt.
                              show(
                                resizeBy(
                                  stored,
                                  corner,
                                  Math.round(dx / cell),
                                  Math.round(dy / GRID_ROW),
                                ),
                              );
                            }}
                            onEnd={(dx, dy) => {
                              const next = resizeBy(
                                stored,
                                corner,
                                Math.round(dx / cell),
                                Math.round(dy / GRID_ROW),
                              );
                              setGesture(null);
                              setDraft(null);
                              rest();
                              store.save(patchBlock(layout, stored.id, next));
                            }}
                          />
                        );
                      })}
                    </>
                  ) : null}
                </Animated.View>
              );
            })
          : null}

        {/* Was mit dem gewaehlten Element geht — gleich darunter. */}
        {chosen && cell > 0 ? (
          <View
            style={[
              styles.inspector,
              {
                left: gap / 2,
                right: gap / 2,
                top: (chosen.y + chosen.h) * GRID_ROW + gap / 2,
              },
            ]}
          >
            <HomeInspector
              block={chosen}
              onVariant={(variant) => store.save(patchBlock(layout, chosen.id, { variant }))}
              onResize={(dw, dh) =>
                store.save(patchBlock(layout, chosen.id, resizeBy(chosen, 'br', dw, dh)))
              }
              onDuplicate={() => store.save(duplicateBlock(layout, chosen.id))}
              onRemove={() => {
                setSelected(null);
                store.save(removeBlock(layout, chosen.id));
              }}
              onClose={() => setSelected(null)}
            />
          </View>
        ) : null}
      </View>

      {/* Ein Element dazulegen. */}
      <Sheet visible={sheet === 'add'} onClose={() => setSheet(null)} title={t('home.build.add')}>
        <View style={{ gap: theme.spacing.xs, paddingBottom: theme.spacing.lg }}>
          {BLOCK_KINDS.map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={blockName(t, kind)}
              onPress={() => {
                const block = newBlock(kind, layout);
                setSheet(null);
                setSelected(block.id);
                setEditing(true);
                store.save([...layout, block]);
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  minHeight: 52,
                  gap: theme.spacing.md,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.surfaceMuted,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Icon name={blockIcon(kind)} size={18} color={blockColor(theme, kind)} />
              <Text variant="body" style={{ fontWeight: theme.fontWeight.medium }}>
                {blockName(t, kind)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      {/* Eine Vorlage nehmen — freiwillig. */}
      <Sheet
        visible={sheet === 'template'}
        onClose={() => setSheet(null)}
        title={t('home.build.template')}
      >
        <HomeTemplates
          onPick={(template) => {
            setSheet(null);
            setSelected(null);
            store.save(templateLayout(template));
          }}
        />
      </Sheet>
    </View>
  );
}

/**
 * Eine Flaeche, an der der Finger zieht: die ganze Karte zum Schieben, die
 * Ecken zum Groesserziehen. Mit `dot` ist sie ein sichtbarer Eckgriff.
 *
 * `id` sagt dem Browser, dass hier **nicht gerollt** wird
 * (`noDragScrollId`) — sonst zoege die Maus die Seite mit.
 */
function BlockGrip({
  id,
  label,
  style,
  dot,
  onStart,
  onMove,
  onEnd,
}: {
  id: string;
  label: string;
  style: StyleProp<ViewStyle>;
  dot?: { backgroundColor: string; borderColor: string };
  onStart: () => void;
  onMove: (dx: number, dy: number) => void;
  onEnd: (dx: number, dy: number) => void;
}) {
  const [drag] = useState(() => new DragGesture());

  // Die neuesten Rueckrufe nachreichen — der Responder entsteht nur einmal.
  useEffect(() => drag.listen({ onStart, onMove, onEnd }), [drag, onStart, onMove, onEnd]);

  return (
    <View
      nativeID={id}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      style={style}
      {...drag.responder.panHandlers}
    >
      {dot ? <View style={[styles.dot, dot]} /> : null}
    </View>
  );
}

type DragHandlers = {
  onStart: () => void;
  onMove: (dx: number, dy: number) => void;
  onEnd: (dx: number, dy: number) => void;
};

/**
 * Der Zustand einer Ziehgeste — eine kleine Klasse, damit der Responder nur
 * einmal entsteht und die Rueckrufe trotzdem aktuell bleiben.
 */
class DragGesture {
  private handlers: DragHandlers | null = null;

  readonly responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // Solange hier gezogen wird, rollt die Liste darunter nicht mit.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => this.handlers?.onStart(),
    onPanResponderMove: (_event, state) => this.handlers?.onMove(state.dx, state.dy),
    onPanResponderRelease: (_event, state) => this.handlers?.onEnd(state.dx, state.dy),
    onPanResponderTerminate: () => this.handlers?.onEnd(0, 0),
  });

  listen(handlers: DragHandlers): () => void {
    this.handlers = handlers;
    return () => {
      if (this.handlers === handlers) this.handlers = null;
    };
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  slot: { position: 'absolute' },
  face: { flex: 1, overflow: 'hidden' },
  clip: { flex: 1, overflow: 'hidden' },
  drop: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  gridColumn: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  inspector: { position: 'absolute', zIndex: 4 },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2.5 },
});
