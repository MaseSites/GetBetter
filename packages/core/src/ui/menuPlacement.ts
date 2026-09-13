/**
 * Wo ein Menue neben seinem Anker steht — ohne React Native, damit es sich
 * unter Node pruefen laesst. Alle Werte in Fensterkoordinaten.
 */

export type Rect = { x: number; y: number; width: number; height: number };

export type MenuPlacementInput = {
  anchor: Rect;
  menu: { width: number; height: number };
  /** Die Flaeche, die das Menue nicht verlassen darf. */
  bounds: Rect;
  /** Abstand zum Anker und zum Rand. */
  gap: number;
  /** `start`: linke Kanten buendig; `end`: rechte Kanten buendig. */
  align: 'start' | 'end';
  /** Wohin es lieber geht, wenn beides passt. */
  prefer: 'below' | 'above';
};

export type MenuPlacement = { left: number; top: number; above: boolean };

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Unter den Anker, wenn es dort Platz hat — sonst darueber. Passt es auf keiner
 * Seite, nimmt es die groessere und bleibt im Rahmen.
 */
export function placeMenu(input: MenuPlacementInput): MenuPlacement {
  const { anchor, menu, bounds, gap } = input;

  const spaceBelow = bounds.y + bounds.height - (anchor.y + anchor.height) - gap * 2;
  const spaceAbove = anchor.y - bounds.y - gap * 2;
  const fitsBelow = menu.height <= spaceBelow;
  const fitsAbove = menu.height <= spaceAbove;

  let above: boolean;
  if (input.prefer === 'above') {
    above = fitsAbove || (!fitsBelow && spaceAbove >= spaceBelow);
  } else {
    above = !fitsBelow && (fitsAbove || spaceAbove > spaceBelow);
  }

  const rawTop = above ? anchor.y - gap - menu.height : anchor.y + anchor.height + gap;
  const rawLeft = input.align === 'end' ? anchor.x + anchor.width - menu.width : anchor.x;

  return {
    left: clamp(rawLeft, bounds.x + gap, bounds.x + bounds.width - menu.width - gap),
    top: clamp(rawTop, bounds.y + gap, bounds.y + bounds.height - menu.height - gap),
    above,
  };
}
