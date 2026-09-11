/**
 * Abstandsskala. Keine anderen Abstandswerte im Code verwenden.
 *
 * Zwei Register: innerhalb eines Bausteins xs bis md, zwischen Bausteinen und
 * Abschnitten lg bis xxl. Wenn überall derselbe Abstand steht, behauptet das
 * Layout, alles sei gleich wichtig.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** Seitenrand eines Bildschirms. */
  edge: 20,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingKey = keyof typeof spacing;
