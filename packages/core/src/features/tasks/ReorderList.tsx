import { useEffect, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View, type PanResponderInstance } from 'react-native';

import type { TaskRow } from '@/db';
import { useTheme } from '@/theme';
import { ListSeparator } from '@/ui';

import { dropIndex, moveItem, shiftOf } from './order';

type Point = { x: number; y: number };

/** Ab so vielen Punkten nach dem langen Druck ist es ein Zug. */
const DRAG_SLOP = 6;

type ReorderListener = {
  onLift: (index: number, height: number) => void;
  onTarget: (target: number) => void;
  onDrop: (from: number, to: number) => void;
  onEnd: () => void;
};

const SILENT: ReorderListener = {
  onLift: () => undefined,
  onTarget: () => undefined,
  onDrop: () => undefined,
  onEnd: () => undefined,
};

/**
 * Druck und Ziehen, ausserhalb von React. Ein langer Druck hebt die Zeile an
 * (`arm`). Bewegt sich der Finger danach, uebernimmt dieser Responder den Zug
 * — vor `SwipeRow`, weil er weiter aussen in der Capture-Phase fragt. Laesst
 * man ohne Bewegung los, gibt `releaseArm` den Druckpunkt fuers Kontextmenue
 * zurueck.
 */
export class ReorderController {
  readonly dragY = new Animated.Value(0);
  readonly responder: PanResponderInstance;
  private heights: readonly number[] = [];
  private armed: { index: number; point: Point } | null = null;
  private claimed = false;
  private granted = false;
  private target = 0;
  private listener: ReorderListener = SILENT;

  constructor() {
    this.responder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (!this.armed || this.claimed) return false;
        if (Math.abs(gesture.dy) < DRAG_SLOP && Math.abs(gesture.dx) < DRAG_SLOP) return false;
        this.claimed = true;
        // Bekommt ein anderer den Zug doch, darf die Liste nicht gesperrt bleiben.
        setTimeout(() => {
          if (this.claimed && !this.granted) this.finish(false);
        }, 0);
        return true;
      },
      onPanResponderGrant: () => {
        this.granted = true;
        this.dragY.setValue(0);
      },
      onPanResponderMove: (_, gesture) => this.move(gesture.dy),
      onPanResponderRelease: () => this.finish(true),
      onPanResponderTerminate: () => this.finish(false),
      onPanResponderTerminationRequest: () => false,
    });
  }

  setListener(listener: ReorderListener) {
    this.listener = listener;
  }

  setHeight(index: number, height: number) {
    this.heights = Array.from({ length: Math.max(this.heights.length, index + 1) }, (_, at) =>
      at === index ? height : (this.heights[at] ?? 0),
    );
  }

  arm(index: number, point: Point) {
    this.armed = { index, point };
    this.claimed = false;
    this.granted = false;
    this.target = index;
    this.dragY.setValue(0);
    this.listener.onLift(index, this.heights[index] ?? 0);
  }

  /** Beim Loslassen: der Druckpunkt, wenn nicht gezogen wurde — sonst null. */
  releaseArm(index: number): Point | null {
    if (!this.armed || this.armed.index !== index || this.claimed) return null;
    const { point } = this.armed;
    this.armed = null;
    this.listener.onEnd();
    return point;
  }

  private move(dy: number) {
    if (!this.armed) return;
    this.dragY.setValue(dy);
    const next = dropIndex(this.armed.index, dy, this.heights);
    if (next === this.target) return;
    this.target = next;
    this.listener.onTarget(next);
  }

  private finish(commit: boolean) {
    const armed = this.armed;
    const target = this.target;
    this.armed = null;
    this.claimed = false;
    this.granted = false;
    this.dragY.setValue(0);
    if (!armed) return;
    if (commit && target !== armed.index) this.listener.onDrop(armed.index, target);
    this.listener.onEnd();
  }
}

export type ReorderBinding = {
  index: number;
  controller: ReorderController;
  lifted: boolean;
  /** Fuer die Bedienungshilfe: eine Zeile nach oben (−1) oder unten (+1). */
  moveBy: (delta: number) => void;
};

export type ReorderListProps = {
  rows: readonly TaskRow[];
  /** Wo die Linie zwischen zwei Zeilen beginnt. */
  inset: number;
  /** Linie auch ueber der ersten Zeile — wenn davor schon eine andere Liste steht. */
  leadingSeparator?: boolean;
  renderRow: (task: TaskRow, binding: ReorderBinding) => ReactNode;
  onReorder: (ids: readonly string[]) => void;
  onDragActive: (active: boolean) => void;
};

/**
 * Eine Liste, die sich von Hand ordnen laesst. Die neue Reihenfolge steht
 * sofort da und bleibt, bis die gespeicherte nachkommt.
 */
export function ReorderList({
  rows,
  inset,
  leadingSeparator = false,
  renderRow,
  onReorder,
  onDragActive,
}: ReorderListProps) {
  const theme = useTheme();
  const [controller] = useState(() => new ReorderController());
  const [drag, setDrag] = useState<{ start: number; target: number; height: number } | null>(null);
  const [pending, setPending] = useState<{ base: string; ids: readonly string[] } | null>(null);

  const ids = rows.map((row) => row.id);
  const base = ids.join('|');
  const orderIds = pending && pending.base === base ? pending.ids : ids;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = orderIds
    .map((id) => byId.get(id))
    .filter((row): row is TaskRow => row !== undefined);

  const drop = (from: number, to: number) => {
    const next = moveItem(orderIds, from, to);
    setPending({ base, ids: next });
    onReorder(next);
  };

  // Die neuesten Rueckrufe, ohne den Controller neu zu bauen.
  useEffect(() => {
    controller.setListener({
      onLift: (index, height) => {
        setDrag({ start: index, target: index, height });
        onDragActive(true);
      },
      onTarget: (target) => setDrag((current) => (current ? { ...current, target } : current)),
      onDrop: drop,
      onEnd: () => {
        setDrag(null);
        onDragActive(false);
      },
    });
  });

  return (
    <View>
      {ordered.map((task, index) => {
        const lifted = drag?.start === index;
        const shift = drag && !lifted ? shiftOf(index, drag.start, drag.target, drag.height) : 0;
        return (
          <Animated.View
            key={task.id}
            onLayout={(event) => controller.setHeight(index, event.nativeEvent.layout.height)}
            style={
              lifted
                ? [
                    theme.elevation.raised,
                    styles.lifted,
                    {
                      backgroundColor: theme.colors.surface,
                      transform: [{ translateY: controller.dragY }],
                    },
                  ]
                : { transform: [{ translateY: shift }] }
            }
            {...controller.responder.panHandlers}
          >
            {index > 0 || leadingSeparator ? <ListSeparator inset={inset} /> : null}
            {renderRow(task, {
              index,
              controller,
              lifted,
              moveBy: (delta) => {
                const to = Math.min(ordered.length - 1, Math.max(0, index + delta));
                if (to !== index) drop(index, to);
              },
            })}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lifted: { zIndex: 1 },
});
