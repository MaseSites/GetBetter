import { Platform } from 'react-native';

/**
 * Im Browser rollt eine Liste nur mit dem Mausrad — am Telefon zieht man sie
 * mit dem Finger. Damit sich die Vorschau wie das Telefon anfuehlt, laesst
 * sich hier alles mit gedrueckter Maus ziehen: Listen, das Wecker-Rad, der
 * Stundenstreifen beim Wetter, Chips. Losgelassen rollt es mit Schwung aus.
 *
 * Auf dem Geraet tut das nichts, dort rollt das System selbst. Beruehrungen
 * (auch im Handy-Modus des Browsers) laufen ebenfalls am Code vorbei.
 */

/** Bis hierhin ist es ein Klick, danach ein Zug. */
const SLOP = 6;
/** Wie stark der Schwung pro Bild nachlaesst. */
const FRICTION = 0.95;
/** Darunter steht die Liste still (Punkte pro Millisekunde). */
const MIN_SPEED = 0.03;
/** Aus diesem Zeitfenster am Ende des Zugs kommt die Wurfgeschwindigkeit. */
const VELOCITY_WINDOW_MS = 80;
const FRAME_MS = 16;

const DRAGGING_CLASS = 'gb-dragging';
/** Merkt sich am Dokument, dass die Griffe haengen — auch ueber ein Neuladen des Moduls hinweg. */
const MARKER = 'gb-drag-scroll';
const CSS = `html.${DRAGGING_CLASS}, html.${DRAGGING_CLASS} * { user-select: none !important; cursor: grabbing !important; }`;

type Axis = 'x' | 'y';
type Sample = { time: number; delta: number };

/** Das naechste Element in dieser Richtung, das sich tatsaechlich noch bewegen kann. */
function scrollerFor(start: Element | null, axis: Axis, delta: number): HTMLElement | null {
  for (let node = start; node && node !== document.documentElement; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue;
    const style = getComputedStyle(node);
    const overflow = axis === 'y' ? style.overflowY : style.overflowX;
    if (overflow !== 'auto' && overflow !== 'scroll') continue;
    const max =
      axis === 'y' ? node.scrollHeight - node.clientHeight : node.scrollWidth - node.clientWidth;
    if (max <= 1) continue;
    const position = axis === 'y' ? node.scrollTop : node.scrollLeft;
    // Zieht man nach unten (positiv), wandert die Liste Richtung Anfang.
    const canMove = delta > 0 ? position > 0 : position < max - 1;
    if (canMove) return node;
  }
  return null;
}

function scrollBy(node: HTMLElement, axis: Axis, delta: number) {
  if (axis === 'y') node.scrollTop -= delta;
  else node.scrollLeft -= delta;
}

/** Einmal beim Start aufrufen; weitere Aufrufe tun nichts. */
export function enableDragScroll(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (document.getElementById(MARKER)) return;

  const style = document.createElement('style');
  style.id = MARKER;
  style.textContent = CSS;
  document.head.appendChild(style);

  let start: { x: number; y: number; target: Element } | null = null;
  let drag: {
    node: HTMLElement | null;
    axis: Axis;
    last: number;
    samples: Sample[];
  } | null = null;
  let frame = 0;
  let swallowClick = false;

  function stopMomentum() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function momentum(node: HTMLElement, axis: Axis, velocity: number) {
    let speed = velocity;
    const step = () => {
      speed *= FRICTION;
      if (Math.abs(speed) < MIN_SPEED) {
        frame = 0;
        return;
      }
      scrollBy(node, axis, speed * FRAME_MS);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  function finish() {
    if (drag?.node) {
      const now = performance.now();
      const recent = drag.samples.filter((sample) => now - sample.time <= VELOCITY_WINDOW_MS);
      const first = recent[0];
      if (first && recent.length > 1) {
        const elapsed = Math.max(FRAME_MS, now - first.time);
        const distance = recent.reduce((sum, sample) => sum + sample.delta, 0);
        momentum(drag.node, drag.axis, distance / elapsed);
      }
    }
    if (drag) document.documentElement.classList.remove(DRAGGING_CLASS);
    start = null;
    drag = null;
    // Der Klick nach dem Loslassen kommt sofort; ein spaeterer (etwa per Tastatur) gilt wieder.
    if (swallowClick)
      setTimeout(() => {
        swallowClick = false;
      }, 0);
  }

  window.addEventListener(
    'pointerdown',
    (event) => {
      stopMomentum();
      swallowClick = false;
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      // In Feldern markiert die Maus Text — das bleibt so.
      if (!target || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      start = { x: event.clientX, y: event.clientY, target };
    },
    true,
  );

  window.addEventListener(
    'pointermove',
    (event) => {
      if (!start) return;
      if ((event.buttons & 1) === 0) {
        finish();
        return;
      }
      if (!drag) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        const axis: Axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
        drag = {
          node: scrollerFor(start.target, axis, axis === 'y' ? dy : dx),
          axis,
          last: axis === 'y' ? start.y : start.x,
          samples: [],
        };
        // Wer gezogen hat, wollte nichts antippen.
        swallowClick = true;
        document.documentElement.classList.add(DRAGGING_CLASS);
        window.getSelection()?.removeAllRanges();
      }
      const position = drag.axis === 'y' ? event.clientY : event.clientX;
      const delta = position - drag.last;
      drag.last = position;
      if (drag.node && delta !== 0) {
        scrollBy(drag.node, drag.axis, delta);
        drag.samples = [
          ...drag.samples.filter((sample) => event.timeStamp - sample.time <= VELOCITY_WINDOW_MS),
          { time: event.timeStamp, delta },
        ];
      }
    },
    true,
  );

  window.addEventListener('pointerup', finish, true);
  window.addEventListener('pointercancel', finish, true);
  window.addEventListener('wheel', stopMomentum, { passive: true, capture: true });
  window.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    },
    true,
  );
}
