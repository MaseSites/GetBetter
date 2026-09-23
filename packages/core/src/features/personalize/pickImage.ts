import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** Laengste Seite nach dem Verkleinern — reicht fuer jeden Telefonbildschirm. */
export const MAX_IMAGE_EDGE = 1280;

/** JPEG-Qualitaet: kaum sichtbar schlechter, ein Bruchteil der Groesse. */
export const IMAGE_QUALITY = 0.82;

/** Das Bild liess sich nicht lesen — kein Bild, kaputt oder ein Format, das niemand kennt. */
export class ImageReadError extends Error {
  constructor() {
    super('image_unreadable');
    this.name = 'ImageReadError';
  }
}

/** Ob es hier eine Bildauswahl gibt: im Browser der Dateidialog, auf dem Geraet die Fotos. */
export function canPickImage(): boolean {
  if (Platform.OS === 'web') return typeof document !== 'undefined';
  return true;
}

/**
 * Laesst ein Bild waehlen und gibt es verkleinert als JPEG-Data-URL zurueck —
 * im Browser ueber den Dateidialog und ein Canvas, auf dem Geraet ueber die
 * Fotos (`expo-image-picker`) und `expo-image-manipulator`. Beide Wege
 * liefern dasselbe: laengste Seite `MAX_IMAGE_EDGE`, JPEG.
 *
 * `null` heisst: nichts gewaehlt oder keine Erlaubnis. Wirft `ImageReadError`,
 * wenn die Datei kein lesbares Bild ist.
 *
 * Im Browser muss der Aufruf direkt aus einem Tipp heraus kommen: der Dateidialog
 * oeffnet sich nur als Antwort auf eine Handlung.
 */
export async function pickImage(): Promise<string | null> {
  if (!canPickImage()) return null;
  if (Platform.OS !== 'web') return pickOnDevice();
  const file = await chooseFile();
  if (!file) return null;
  if (!file.type.startsWith('image/')) throw new ImageReadError();
  return shrink(file);
}

/** Auf dem Geraet: Erlaubnis fragen, ein Foto waehlen, verkleinern, als JPEG kodieren. */
async function pickOnDevice(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;

  const longest = Math.max(asset.width, asset.height);
  if (!Number.isFinite(longest) || longest <= 0) throw new ImageReadError();
  const scale = Math.min(1, MAX_IMAGE_EDGE / longest);
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    if (scale < 1) {
      context.resize(
        asset.width >= asset.height
          ? { width: Math.max(1, Math.round(asset.width * scale)) }
          : { height: Math.max(1, Math.round(asset.height * scale)) },
      );
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: IMAGE_QUALITY,
      base64: true,
    });
    if (!saved.base64) throw new ImageReadError();
    return `data:image/jpeg;base64,${saved.base64}`;
  } catch {
    throw new ImageReadError();
  }
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
