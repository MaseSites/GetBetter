/**
 * Reihenfolge von Hand: wohin eine gezogene Zeile faellt und was danach in
 * `order` steht. Rein, ohne Gesten und ohne Speicher.
 */

/** Verschiebt ein Element; gibt immer eine neue Liste zurueck. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list];
  const item = list[from];
  if (item === undefined) return [...list];
  const without = list.filter((_, index) => index !== from);
  const target = Math.min(Math.max(0, to), without.length);
  return [...without.slice(0, target), item, ...without.slice(target)];
}

/**
 * Der neue Platz einer Zeile, die um `dy` gezogen wurde: so viele andere
 * Zeilen, deren Mitte ueber der Mitte der gezogenen liegt.
 */
export function dropIndex(start: number, dy: number, heights: readonly number[]): number {
  if (start < 0 || start >= heights.length) return start;
  const tops = heights.map((_, index) =>
    heights.slice(0, index).reduce((sum, height) => sum + height, 0),
  );
  const center = (tops[start] ?? 0) + (heights[start] ?? 0) / 2 + dy;
  return heights.filter(
    (height, index) => index !== start && (tops[index] ?? 0) + height / 2 < center,
  ).length;
}

/** Wie weit eine andere Zeile ausweicht, solange eine gezogen wird. */
export function shiftOf(
  index: number,
  start: number,
  target: number,
  draggedHeight: number,
): number {
  if (index === start) return 0;
  if (start < target && index > start && index <= target) return -draggedHeight;
  if (target < start && index >= target && index < start) return draggedHeight;
  return 0;
}

/** Nur die Zeilen, deren `order` sich wirklich aendert. */
export function orderChanges(
  ids: readonly string[],
  current: ReadonlyMap<string, number | undefined>,
): { id: string; order: number }[] {
  return ids
    .map((id, order) => ({ id, order }))
    .filter(({ id, order }) => current.get(id) !== order);
}
