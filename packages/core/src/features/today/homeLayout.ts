/**
 * Die eigene Ansicht der Startseite — der Baukasten. Reine Rechnung, getestet
 * in `homeLayout.test.ts`.
 *
 * Die Flaeche ist ein **Raster**: `GRID_COLUMNS` Spalten breit, beliebig viele
 * Zeilen hoch. Ein Block liegt frei darauf — `{ x, y, w, h }` in Rasterfeldern
 * —, laesst sich also hinschieben, wohin man will, und an den Ecken groesser
 * und kleiner ziehen. Bloecke duerfen sich ueberlappen: es ist die eigene
 * Ansicht, nicht die der App.
 */

export const BLOCK_KINDS = ['band', 'tasks', 'notes', 'news', 'quick', 'apps'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

/** Die Stile je Element — der erste ist der Standard. */
export const BLOCK_VARIANTS = {
  band: ['thread', 'now', 'compact'],
  tasks: ['page', 'list'],
  notes: ['cards', 'list'],
  news: ['stack', 'count'],
  quick: ['carousel', 'icons'],
  apps: ['cards'],
} as const satisfies Record<BlockKind, readonly string[]>;

export type BlockVariant = (typeof BLOCK_VARIANTS)[BlockKind][number];

/** So viele Spalten hat die Flaeche — vier passen auf ein Handy. */
export const GRID_COLUMNS = 4;
/** So hoch ist eine Rasterzeile in Punkten. */
export const GRID_ROW = 56;
/** Kleiner geht ein Block nicht. */
export const MIN_W = 1;
export const MIN_H = 1;

export type HomeBlock = {
  id: string;
  kind: BlockKind;
  variant: BlockVariant;
  /** Spalte, Zeile, Breite und Hoehe in Rasterfeldern. */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type HomeLayout = readonly HomeBlock[];

/** Die vier Ecken, an denen man zieht. */
export const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;
export type Corner = (typeof CORNERS)[number];

/** Je Konto auf dem Geraet gemerkt. */
export function homeLayoutKey(accountId: string): string {
  return `home.layout.${accountId}`;
}

/** Die Stile dieses Elements. */
export function variantsOf(kind: BlockKind): readonly string[] {
  return BLOCK_VARIANTS[kind];
}

/** Passt der Stil zum Element? Sonst der erste. */
export function variantOf(kind: BlockKind, variant: unknown): BlockVariant {
  const known = variantsOf(kind).find((name) => name === variant);
  return (known ?? variantsOf(kind)[0]) as BlockVariant;
}

const whole = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;

/** Ein Block bleibt im Raster: nie breiter als die Flaeche, nie links daneben. */
export function clampBlock(block: HomeBlock): HomeBlock {
  const w = Math.min(GRID_COLUMNS, Math.max(MIN_W, whole(block.w, GRID_COLUMNS)));
  const h = Math.max(MIN_H, whole(block.h, 4));
  const x = Math.min(GRID_COLUMNS - w, Math.max(0, whole(block.x, 0)));
  const y = Math.max(0, whole(block.y, 0));
  return { ...block, x, y, w, h };
}

let counter = 0;

/** Wie viele Zeilen die Flaeche braucht — die unterste Kante aller Bloecke. */
export function canvasRows(layout: HomeLayout): number {
  return layout.reduce((rows, block) => Math.max(rows, block.y + block.h), 0);
}

/** Ein neuer Block: volle Breite, unter allem anderen. */
export function newBlock(kind: BlockKind, layout: HomeLayout = []): HomeBlock {
  counter += 1;
  return clampBlock({
    id: `${kind}-${counter}`,
    kind,
    variant: variantOf(kind, undefined),
    x: 0,
    y: canvasRows(layout),
    w: GRID_COLUMNS,
    h: 4,
  });
}

/** Einen Block hinschieben, wohin man will — nur nicht aus dem Raster. */
export function moveTo(block: HomeBlock, x: number, y: number): HomeBlock {
  return clampBlock({ ...block, x, y });
}

/**
 * An einer Ecke ziehen: rechts und unten wird der Block groesser, links und
 * oben wandert zugleich sein Anfang. Kleiner als ein Feld wird er nie, und
 * ueber den linken oder rechten Rand geht er nicht hinaus.
 */
export function resizeBy(block: HomeBlock, corner: Corner, dx: number, dy: number): HomeBlock {
  const left = corner === 'tl' || corner === 'bl';
  const top = corner === 'tl' || corner === 'tr';

  let { x, y, w, h } = block;
  if (left) {
    const shift = Math.min(dx, w - MIN_W);
    const nextX = Math.max(0, x + shift);
    w += x - nextX;
    x = nextX;
  } else {
    w = Math.min(GRID_COLUMNS - x, Math.max(MIN_W, w + dx));
  }
  if (top) {
    const shift = Math.min(dy, h - MIN_H);
    const nextY = Math.max(0, y + shift);
    h += y - nextY;
    y = nextY;
  } else {
    h = Math.max(MIN_H, h + dy);
  }
  return clampBlock({ ...block, x, y, w, h });
}

/** Einen Block aendern — Stil oder Lage. */
export function patchBlock(layout: HomeLayout, id: string, patch: Partial<HomeBlock>): HomeBlock[] {
  return layout.map((block) => {
    if (block.id !== id) return block;
    const kind = block.kind;
    const next = { ...block, ...patch, kind };
    return clampBlock({ ...next, variant: variantOf(kind, next.variant) });
  });
}

/** Zum naechsten Stil dieses Elements — nach dem letzten wieder zum ersten. */
export function nextVariant(kind: BlockKind, variant: BlockVariant): BlockVariant {
  const all = variantsOf(kind);
  const index = all.indexOf(variant);
  return (all[(index + 1) % all.length] ?? all[0]) as BlockVariant;
}

export function removeBlock(layout: HomeLayout, id: string): HomeBlock[] {
  return layout.filter((block) => block.id !== id);
}

/** Ein Element kopieren — die Kopie liegt gleich darunter, sonst gleich. */
export function duplicateBlock(layout: HomeLayout, id: string): HomeBlock[] {
  const index = layout.findIndex((block) => block.id === id);
  const block = layout[index];
  if (!block) return [...layout];
  counter += 1;
  const copy = clampBlock({ ...block, id: `${block.kind}-${counter}`, y: block.y + block.h });
  return [...layout.slice(0, index + 1), copy, ...layout.slice(index + 1)];
}

/** Die drei Vorlagen — dieselben Ansichten wie die drei festen Knoepfe. */
export const TEMPLATES = ['list', 'grid', 'focus'] as const;
export type TemplateKey = (typeof TEMPLATES)[number];

export function templateLayout(template: TemplateKey): HomeBlock[] {
  const make = (
    kind: BlockKind,
    variant: BlockVariant,
    x: number,
    y: number,
    w: number,
    h: number,
  ): HomeBlock => clampBlock({ ...newBlock(kind), variant, x, y, w, h });

  if (template === 'grid') {
    return [
      make('band', 'thread', 0, 0, 4, 5),
      make('tasks', 'list', 0, 5, 2, 3),
      make('notes', 'list', 2, 5, 2, 3),
      make('news', 'count', 0, 8, 4, 2),
      make('quick', 'carousel', 0, 10, 4, 4),
    ];
  }
  if (template === 'focus') {
    return [make('band', 'now', 0, 0, 4, 4), make('tasks', 'page', 0, 4, 4, 6)];
  }
  return [
    make('news', 'stack', 0, 0, 4, 3),
    make('band', 'thread', 0, 3, 4, 7),
    make('tasks', 'page', 0, 10, 4, 6),
    make('notes', 'cards', 0, 16, 4, 4),
    make('quick', 'carousel', 0, 20, 4, 4),
  ];
}

/**
 * Was gespeichert war — alles Krumme faellt weg. Ein aelterer Stand kannte
 * `span` und `size` statt des Rasters; der wird umgerechnet.
 */
export function parseLayout(raw: string | null | undefined): HomeBlock[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    let row = 0;
    const blocks = value.flatMap((entry): HomeBlock[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const stored = entry as Record<string, unknown>;
      const kind = BLOCK_KINDS.find((name) => name === stored.kind);
      if (!kind) return [];
      const old = stored.x === undefined && stored.y === undefined;
      const block = clampBlock({
        id: typeof stored.id === 'string' && stored.id.length > 0 ? stored.id : newBlock(kind).id,
        kind,
        variant: variantOf(kind, stored.variant),
        x: old ? 0 : whole(stored.x, 0),
        y: old ? row : whole(stored.y, 0),
        w: old ? (stored.span === 'half' ? 2 : GRID_COLUMNS) : whole(stored.w, GRID_COLUMNS),
        h: old ? (stored.size === 'sm' ? 3 : 5) : whole(stored.h, 4),
      });
      row += block.h;
      return [block];
    });
    return blocks.length > 0 ? blocks : null;
  } catch {
    return null;
  }
}

/** So klein darf ein Element werden, bevor nichts mehr lesbar ist. */
export const MIN_SCALE = 0.4;

/**
 * Wie stark ein Element verkleinert wird: ein volles ist 1, ein halbes 0.5.
 * So schrumpfen Formen und Schrift mit — der Inhalt wird in voller Breite
 * gebaut und dann zusammengezogen, statt nur enger zu werden.
 */
export function blockScale(w: number): number {
  const scale = w / GRID_COLUMNS;
  return Math.max(MIN_SCALE, Math.min(1, Number.isFinite(scale) ? scale : 1));
}
