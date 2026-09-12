import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Ob das Geraet weniger Bewegung wuenscht. `null`, solange die Antwort noch
 * aussteht — so faengt keine Animation an, die gleich wieder abbrechen muesste.
 */
export function useReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => {
        if (alive) setReduced(false);
      });
    // Im Browser gibt es ohne `matchMedia` kein Abo.
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (alive) setReduced(value);
    });
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, []);

  return reduced;
}
