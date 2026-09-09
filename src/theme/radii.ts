/** Eckenradien. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radii;
