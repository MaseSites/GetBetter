import { Platform } from 'react-native';

/**
 * Was der Browser braucht und das Geraet nicht: die beiden Webschriften und
 * ein paar Regeln, die ausserhalb der React-Native-Welt liegen.
 *
 * Die Apps laufen mit `web.output: "single"`. Eine `+html.tsx` waere der
 * saubere Ort dafuer, aber Expo liest sie nur beim statischen Export — hier
 * haengen wir die Sachen darum beim Start selbst in den Kopfbereich.
 *
 * Auf dem Geraet passiert nichts: dort greift die Systemschrift, bis die
 * Schriftdateien unter `assets/fonts` liegen und mit `expo-font` geladen
 * werden. Beide stehen unter der Open Font License.
 */
const FONTS =
  'https://fonts.googleapis.com/css2' +
  '?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800' +
  '&family=Instrument+Sans:wght@400;500;600' +
  // Lieber sofort in der Systemschrift lesen als auf eine Webschrift warten.
  '&display=swap';

/**
 * Die Auswahlfarbe. Ohne sie waehlt der Browser kraeftig Blau aus, mitten in
 * einer sonst warmen Oberflaeche.
 */
const CSS = `
  ::selection { background: #C9F23F; color: #14150F; }
  * { -webkit-tap-highlight-color: transparent; }
`;

const MARKER = 'getbetter-web-chrome';

/** Einmal beim Start aufrufen. Mehrfache Aufrufe tun nichts. */
export function applyWebChrome(): void {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (document.getElementById(MARKER)) return;

  for (const href of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
    const pre = document.createElement('link');
    pre.rel = 'preconnect';
    pre.href = href;
    if (href.endsWith('gstatic.com')) pre.crossOrigin = 'anonymous';
    document.head.appendChild(pre);
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS;
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.id = MARKER;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Der Grund hinter dem Telefonrahmen.
 *
 * Er folgt dem Thema der App, nicht der Systemeinstellung: wer im Profil auf
 * Hell stellt, waehrend das Geraet dunkel steht, saehe sonst eine helle App in
 * einem schwarzen Rahmen.
 */
export function setWebBackground(color: string): void {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
}
