/** Eckenradien. */
export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radii;
