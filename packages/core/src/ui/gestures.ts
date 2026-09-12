import type { PanResponderGestureState } from 'react-native';

/**
 * Gemeinsame Masse fuer alle Wischgesten. So fuehlt sich Wischen ueberall
 * gleich an: dieselbe Strecke, bis eine Geste zaehlt, dieselbe Richtungsregel.
 */

/** So weit muss sich der Finger bewegen, bevor eine Geste ihre Richtung hat. */
export const SWIPE_SLOP = 10;

/** Eine Geste gilt als waagrecht, wenn sie deutlich mehr quer als hoch geht. */
export function isHorizontalSwipe(gesture: PanResponderGestureState, slop = SWIPE_SLOP): boolean {
  return Math.abs(gesture.dx) > slop && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
}

/** Nach unten, und nicht bloss ein schraeger Wisch zur Seite. */
export function isDownwardSwipe(gesture: PanResponderGestureState, slop = SWIPE_SLOP): boolean {
  return gesture.dy > slop && gesture.dy > Math.abs(gesture.dx) * 1.5;
}

/** Ab dieser Geschwindigkeit (Punkte pro Millisekunde) reicht ein kurzer Wisch. */
export const FLING_VELOCITY = 0.8;
