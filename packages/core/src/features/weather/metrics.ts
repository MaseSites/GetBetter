/**
 * Masse aus dem Bauplan (§6 Wetter), die die Skala im Theme nicht kennt. Wo
 * ein Wert dort schon steht (22, 20, 28 pt), nimmt der Code das Theme.
 */
export const WEATHER_METRICS = {
  /** Die Temperatur im Kopf: 96 pt, duenn, gleich breite Ziffern. */
  tempSize: 96,
  tempLine: 104,
  tempWeight: '200',
  /** „H: 21°  T: 12°“ */
  rangeSize: 17,
  rangeLine: 22,
  /** Der Kopf ist etwa 260 pt hoch und nach 120 pt Scrollen eingeklappt. */
  headerHeight: 260,
  collapseDistance: 120,
  /** Die gepinnte Zeile „Zürich / 18° | Bewölkt“. */
  pinnedHeight: 88,
  /** Die eigene Leiste unten mit Seitenpunkten und Listen-Symbol. */
  bottomBar: 49,
  dot: 7,
  /** Eine Zeile der Orte-Liste. */
  placeRow: 96,
  /** Eine Zeile der 7 Tage. */
  weekRow: 44,
  weekDayWidth: 52,
  weekIconWidth: 56,
  weekTempWidth: 36,
  rangeBarHeight: 5,
  nowDot: 9,
  /** Eine Spalte der Stundenleiste; Sonnenauf- und -untergang brauchen mehr Platz. */
  hourColumn: 52,
  sunColumn: 68,
  hourIcon: 24,
  /** Die Balken in Niederschlag und Tag-Blatt. */
  precipHeight: 64,
  chartHeight: 120,
  chartBarGap: 2,
  chartAxis: 56,
  compass: 36,
  /** Platzhalter beim ersten Laden, so hoch wie die fertigen Module. */
  hoursPlaceholder: 150,
  weekPlaceholder: 356,
  /** Deckkraft der leichten Flaechen als Hex-Anhang: 12 ≈ 7 %. */
  surfaceAlpha: '12',
  /** Die Spur hinter Balken: 24 ≈ 14 %. */
  trackAlpha: '24',
} as const;
