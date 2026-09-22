/**
 * Masse des Trainingshefts, genau wie im Entwurf (`Training.dc.html`,
 * `Trainingsplan.dc.html`). Der Entwurf setzt die Zeilenhoehe auf „normal“ —
 * bei Instrument Sans und Bricolage Grotesque sind das die Werte hier, nicht
 * die der allgemeinen Skala. Schriftgroessen und Abstaende kommen weiter aus
 * `useTheme()`; nur was die Skala nicht kennt, steht hier mit Namen.
 */
export const TRAINING = {
  /** Grundschrift des Entwurfs: Satznummer, kg, Wdh, Name einer Uebung. */
  rowSize: 16,
  rowLine: 20,
  /** Zeilenhoehe „normal“ je Schriftgroesse. */
  line11: 14,
  line12: 15,
  line13: 16,
  line14: 18,
  line22: 26,
  /** Laufweite der kleinen Versalien: 0.09 em bei 11 px. */
  capsTracking: 0.99,
  /** Grosse Titel im Block: −0.03 em bei 34 px, −0.02 em bei 22 px. */
  displayTracking: -1.02,
  statTracking: -0.44,
  /** Ein Block: oben 13, unten 14. */
  blockTop: 13,
  blockBottom: 14,
  /** Zwischen Kopf und Inhalt: der Kopf traegt unten 12, dazu 2. */
  headerGap: 2,
  /** Haarlinie zwischen Zeilen. */
  hairline: 1,
  /** Die Tabelle: 28 | 1fr | 64 | 52 | 34, Zeilen 8/10 innen, 10 rund. */
  colSet: 28,
  colKg: 64,
  colReps: 52,
  rowPadX: 10,
  /** Unter der Kopfzeile der Tabelle. */
  headPadBottom: 4,
  /** Unter dem Satz „Letztes Mal …“ bis zum Kopf: 6. */
  lastLineGap: 6,
  /** Datumsspalte „Fr 25.“ */
  dateColumn: 54,
} as const;
