import { Platform } from 'react-native';

/** Laengste Seite nach dem Verkleinern — reicht fuer jeden Telefonbildschirm. */
export const MAX_IMAGE_EDGE = 1280;

/** JPEG-Qualitaet: kaum sichtbar schlechter, ein Bruchteil der Groesse. */
export const IMAGE_QUALITY = 0.82;

/** Das Bild liess sich nicht lesen — kein Bild, kaputt oder ein Format, das der Browser nicht kennt. */
export class ImageReadError extends Error {
  constructor() {
    super('image_unreadable');
    this.name = 'ImageReadError';
  }
}

/**
 * Ob es hier eine Bildauswahl gibt. Im Browser ja; auf dem Geraet braucht es
 * dafuer expo-image-picker, und das ist noch nicht dabei.
 */
export function canPickImage(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

/**
 * Laesst ein Bild waehlen und gibt es verkleinert als JPEG-Data-URL zurueck.
 *
 * `null` heisst: nichts gewaehlt — abgebrochen, oder auf dem Geraet, wo es
 * noch keine Auswahl gibt. Wirft `ImageReadError`, wenn die Datei kein
 * lesbares Bild ist.
 *
 * Muss direkt aus einem Tipp heraus aufgerufen werden: der Browser oeffnet
 * den Dateidialog nur als Antwort auf eine Handlung.
 */
export async function pickImage(): Promise<string | null> {
  if (!canPickImage()) return null;
  const file = await chooseFile();
  if (!file) return null;
  if (!file.type.startsWith('image/')) throw new ImageReadError();
  return shrink(file);
}

function chooseFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => finish(input.files?.item(0) ?? null));
    // Abbrechen melden die Browser seit 2023 als `cancel`.
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ImageReadError());
    image.src = url;
  });
}

/** Auf `MAX_IMAGE_EDGE` verkleinern und als JPEG kodieren. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    if (longest === 0) throw new ImageReadError();
    const scale = Math.min(1, MAX_IMAGE_EDGE / longest);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new ImageReadError();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    // JPEG kennt keine Transparenz: durchsichtige Stellen eines PNG werden weiss statt schwarz.
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
    if (!dataUrl.startsWith('data:image/jpeg')) throw new ImageReadError();
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}
