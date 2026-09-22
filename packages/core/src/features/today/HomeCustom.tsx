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

import { useI18n } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Chip, Icon, Sheet, Text, type IconName } from '@/ui';

import { blockIcon, blockName, HomeBlockView, variantLabel } from './HomeBlockView';
import {
  BLOCK_KINDS,
  CORNERS,
  GRID_COLUMNS,
  GRID_ROW,
  blockScale,
  canvasRows,
  moveTo,
  newBlock,
  patchBlock,
  removeBlock,
  resizeBy,
  templateLayout,
  variantsOf,
  type BlockVariant,
  type Corner,
  type HomeBlock,
  type TemplateKey,
} from './homeLayout';
import { useHomeLayout } from './useHomeLayout';

/** Die drei Vorlagen heissen wie die drei festen Ansichten. */
const TEMPLATE_LABELS = {
  list: 'today.view.list',
  grid: 'today.view.grid',
  focus: 'today.view.focus',
} as const;

/** So gross ist ein Eckgriff. */
const HANDLE = 26;
/** Die runden Knoepfe am Element: gross genug fuer den Daumen. */
const BUTTON = 36;
/** So viele leere Zeilen stehen beim Bearbeiten unten bereit. */
const SPARE_ROWS = 3;

type Gesture = { id: string; corner: Corner | null };

/**
 * Die eigene Ansicht: eine freie Flaeche. Die Elemente liegen auf einem Raster
 * von vier Spalten und lassen sich im Bearbeiten **hinschieben, wohin man
 * will**, und **an den Ecken** groesser und kleiner ziehen; je Element gibt es
 * Stile. Man landet gleich hier, ohne vorher eine Vorlage zu waehlen — eine
 * Vorlage ist nur ein Angebot. Gemerkt wird alles je Konto auf dem Geraet.
 */
export function HomeCustom({ onAddTask }: { onAddTask: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const account = useAccount();
  const store = useHomeLayout(account.id);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<'add' | 'template' | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
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
  const rows = canvasRows(layout) + (editMode ? SPARE_ROWS : 0);
  const block = layout.find((entry) => entry.id === chosen) ?? null;

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
            onPress={() => setEditing((value) => !value)}
          />
        )}
      </View>

      {empty ? (
        <View style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.lg }}>
          <Text variant="title">{t('home.build.startTitle')}</Text>
          <Text variant="label" tone="muted">
            {t('home.build.startBody')}
          </Text>
        </View>
      ) : null}

      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: rows * GRID_ROW }}
      >
        {/* Beim Bearbeiten liegt das Raster blass darunter — man sieht, wohin es rastet. */}
        {editMode && cell > 0
          ? Array.from({ length: rows + 1 }, (_, row) => (
              <View
                key={`line-${row}`}
                style={[
                  styles.gridLine,
                  { top: row * GRID_ROW, backgroundColor: theme.colors.border },
                ]}
              />
            ))
          : null}

        {cell > 0
          ? layout.map((stored) => {
              // Waehrend des Ziehens gilt der Entwurf — Lage, Groesse und Inhalt.
              const entry = draft?.id === stored.id ? draft : stored;
              const active = gesture?.id === entry.id;
              const moving = active && gesture?.corner === null;
              return (
                <Animated.View
                  key={entry.id}
                  style={[
                    styles.slot,
                    active ? theme.elevation.raised : null,
                    {
                      left: entry.x * cell + gap / 2,
                      top: entry.y * GRID_ROW + gap / 2,
                      width: entry.w * cell - gap,
                      height: entry.h * GRID_ROW - gap,
                      transform: active ? [{ translateX: moveX }, { translateY: moveY }] : [],
                      zIndex: active ? 2 : 1,
                      opacity: moving ? 0.9 : 1,
                    },
                  ]}
                >
                  {/* Die Schiebeflaeche liegt unter der Karte: so bleiben die
                      Knoepfe oben rechts drueckbar. */}
                  {editMode ? (
                    <BlockGrip
                      label={t('home.build.move', { name: blockName(t, entry.kind) })}
                      style={styles.moveArea}
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
                  ) : null}
                  <View
                    pointerEvents={editMode ? 'box-none' : 'auto'}
                    style={[
                      styles.face,
                      {
                        borderRadius: theme.radii.md,
                        ...(editMode
                          ? {
                              borderWidth: 1.5,
                              borderColor: active ? theme.colors.accentMark : theme.colors.border,
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
                          color={theme.colors.textMuted}
                        />
                        <Text variant="caption" tone="muted" numberOfLines={1} style={styles.grow}>
                          {blockName(t, entry.kind)}
                        </Text>
                        <RoundButton
                          icon="settings"
                          label={t('home.build.settings', { name: blockName(t, entry.kind) })}
                          onPress={() => setChosen(entry.id)}
                        />
                        <RoundButton
                          icon="trash"
                          danger
                          label={t('home.build.removeName', { name: blockName(t, entry.kind) })}
                          onPress={() => store.save(removeBlock(layout, entry.id))}
                        />
                      </View>
                    ) : null}
                    {/* Im Bearbeiten ist der Inhalt nur Bild — der Finger schiebt.
                        Ein schmales Element baut seinen Inhalt in voller Breite
                        und zieht ihn dann zusammen: so werden Formen und Schrift
                        mit kleiner, statt nur enger zu stehen. */}
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

                  {editMode ? (
                    <>
                      {/* Die Ecken ziehen die Groesse. */}
                      {CORNERS.map((corner) => {
                        const left = corner === 'tl' || corner === 'bl';
                        const top = corner === 'tl' || corner === 'tr';
                        return (
                          <BlockGrip
                            key={corner}
                            label={t('home.build.resize', { name: blockName(t, entry.kind) })}
                            style={[
                              styles.handle,
                              left ? { left: -2 } : { right: -2 },
                              top ? { top: -2 } : { bottom: -2 },
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
      </View>

      {/* Ein Element aendern: Stil — oder weg damit. */}
      <Sheet
        visible={block !== null}
        onClose={() => setChosen(null)}
        title={block ? blockName(t, block.kind) : ''}
      >
        {block ? (
          <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="section" tone="muted">
                {t('home.build.style')}
              </Text>
              <View style={[styles.wrap, { gap: theme.spacing.sm }]}>
                {variantsOf(block.kind).map((variant) => (
                  <Chip
                    key={variant}
                    label={variantLabel(t, block.kind, variant)}
                    selected={variant === block.variant}
                    onPress={() =>
                      store.save(patchBlock(layout, block.id, { variant: variant as BlockVariant }))
                    }
                  />
                ))}
              </View>
            </View>

            <Text variant="label" tone="faint">
              {t('home.build.hint')}
            </Text>

            <Button
              label={t('home.build.remove')}
              icon="trash"
              variant="danger"
              onPress={() => {
                const next = removeBlock(layout, block.id);
                setChosen(null);
                store.save(next);
              }}
            />
          </View>
        ) : null}
      </Sheet>

      {/* Ein Element dazulegen. */}
      <Sheet visible={sheet === 'add'} onClose={() => setSheet(null)} title={t('home.build.add')}>
        <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
          {BLOCK_KINDS.map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={blockName(t, kind)}
              onPress={() => {
                setSheet(null);
                store.save([...layout, newBlock(kind, layout)]);
              }}
              style={({ pressed }) => [
                styles.row,
                { minHeight: 44, gap: theme.spacing.md, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Icon name={blockIcon(kind)} size={18} color={theme.colors.textMuted} />
              <Text variant="body">{blockName(t, kind)}</Text>
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
        <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
          <Text variant="label" tone="muted">
            {t('home.build.templateBody')}
          </Text>
          {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((template) => (
            <Button
              key={template}
              label={t(TEMPLATE_LABELS[template])}
              variant="secondary"
              onPress={() => {
                setSheet(null);
                store.save(templateLayout(template));
              }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

/** Ein runder Knopf am Element — gross genug, um ihn zu treffen. */
function RoundButton({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={theme.spacing.xs}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: theme.radii.pill,
          backgroundColor: danger ? theme.colors.dangerSoft : theme.colors.surfaceMuted,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Icon name={icon} size={18} color={danger ? theme.colors.danger : theme.colors.text} />
    </Pressable>
  );
}

/**
 * Eine Flaeche, an der der Finger zieht: die ganze Karte zum Schieben, die
 * Ecken zum Groesserziehen. Mit `dot` ist sie ein sichtbarer Eckgriff.
 */
function BlockGrip({
  label,
  style,
  dot,
  onStart,
  onMove,
  onEnd,
}: {
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
      accessibilityRole="button"
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { position: 'absolute' },
  face: { flex: 1, overflow: 'hidden' },
  clip: { flex: 1, overflow: 'hidden' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  // Schieben faengt ueberall auf der Karte an, ausser an den Ecken.
  moveArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  button: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
