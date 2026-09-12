import { useEffect, useState } from 'react';
import { Animated, PanResponder, Platform, type PanResponderInstance } from 'react-native';

import { FLING_VELOCITY, isHorizontalSwipe } from './gestures';

/** So weit muss man wischen, damit es zum naechsten Monat, Tag oder zur naechsten Woche geht. */
const STEP_DISTANCE = 64;
/** Die Flaeche folgt dem Finger nur ein Stueck — sie soll zeigen, dass etwas passiert. */
const FOLLOW = 0.35;
/** Erst deutlich waagrecht — Tipps auf Tage und Termine bleiben Tipps. */
const STEP_SLOP = 20;

const useNativeDriver = Platform.OS !== 'web';

class StepController {
  readonly offset = new Animated.Value(0);
  readonly responder: PanResponderInstance;
  private onStep: (direction: -1 | 1) => void = () => undefined;

  constructor() {
    const back = () =>
      Animated.spring(this.offset, {
        toValue: 0,
        useNativeDriver,
        bounciness: 0,
        speed: 24,
      }).start();

    this.responder = PanResponder.create({
      // Erst in der Blasenphase: eine Wisch-Zeile darin (Capture) bekommt den Wisch
      // nach links zuerst, alles andere landet hier — auch ueber antippbaren Tagen.
      onMoveShouldSetPanResponder: (_, gesture) => isHorizontalSwipe(gesture, STEP_SLOP),
      onPanResponderMove: (_, gesture) => this.offset.setValue(gesture.dx * FOLLOW),
      onPanResponderRelease: (_, gesture) => {
        back();
        if (gesture.dx <= -STEP_DISTANCE || gesture.vx < -FLING_VELOCITY) this.onStep(1);
        else if (gesture.dx >= STEP_DISTANCE || gesture.vx > FLING_VELOCITY) this.onStep(-1);
      },
      onPanResponderTerminate: back,
      onPanResponderTerminationRequest: () => false,
    });
  }

  setOnStep(onStep: (direction: -1 | 1) => void) {
    this.onStep = onStep;
  }
}

/**
 * Nach links wischen heisst weiter, nach rechts zurueck — fuer Kalender und
 * Monatsansichten. Gibt die Griffe fuer die Flaeche zurueck und eine
 * Verschiebung, mit der sie dem Finger ein Stueck folgt.
 */
export function useSwipeSteps(onStep: (direction: -1 | 1) => void) {
  const [controller] = useState(() => new StepController());

  useEffect(() => {
    controller.setOnStep(onStep);
  }, [controller, onStep]);

  return {
    panHandlers: controller.responder.panHandlers,
    style: { transform: [{ translateX: controller.offset }] },
  };
}
