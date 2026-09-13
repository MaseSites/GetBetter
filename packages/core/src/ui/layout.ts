/**
 * Feste Masse der Huelle, die mehrere Bausteine kennen muessen: wo die
 * Tab-Leiste endet, wie gross der Knopf unten rechts ist, wie gross eine
 * Trefferflaeche mindestens sein muss.
 */

/** Hoehe der Tab-Leiste ohne den unteren Sicherheitsabstand. */
export const TAB_BAR_HEIGHT = 76;

/** Der runde Knopf unten rechts. */
export const FLOATING_BUTTON_SIZE = 56;

/** Kleinste Trefferflaeche, auch fuer Kreise, die kleiner gezeichnet sind. */
export const HIT_TARGET = 44;

/** Breite der Spalte links in einer Zeile (Kreis, Bild, Symbol). */
export const ROW_LEADING_WIDTH = HIT_TARGET;

/** Mindesthoehe einer Listenzeile mit einer, zwei und drei Textzeilen. */
export const ROW_MIN_HEIGHT = { one: 44, two: 60, three: 76 } as const;

/** Ab so vielen Millisekunden ist ein Druck ein langer Druck. */
export const LONG_PRESS_MS = 350;
