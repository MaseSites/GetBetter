/** Eckenradien. */
export const radii = {
  /** Marken, Haekchen, Punkte. */
  xs: 6,
  /** Knoepfe, Eingabefelder, Chips. */
  sm: 12,
  /** Eintraege im Tagesband und Zahlenkacheln. */
  item: 14,
  /** Karten. */
  md: 16,
  /** Bloecke mit grosser Zahl auf den Bereichsseiten. */
  panel: 18,
  /** Freistehende, grosse Karten. */
  lg: 22,
  /** Blaetter. */
  xl: 28,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radii;
