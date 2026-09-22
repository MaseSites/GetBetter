import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
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

/** Woher das Bild kommt: Kamera (am Telefon direkt fotografieren) oder die Fotos. */
export type ImageSource = 'camera' | 'library';

/** Kamera oder Fotos haben keine Erlaubnis — die App sagt, wo man sie gibt. */
export class ImagePermissionError extends Error {
  constructor() {
    super('image_permission');
    this.name = 'ImagePermissionError';
  }
}

/**
 * Ob es hier eine Bildauswahl gibt: im Browser die Dateiwahl, auf iPhone und
 * Android Kamera und Fotos ueber expo-image-picker.
 */
export function canPickImage(): boolean {
  if (Platform.OS === 'web') return typeof document !== 'undefined';
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Ob es sich lohnt, „Foto machen“ und „Aus Fotos“ getrennt anzubieten — nur auf dem Telefon. */
export function hasCamera(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
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
export async function pickImage(source: ImageSource = 'library'): Promise<string | null> {
  if (!canPickImage()) return null;
  if (Platform.OS !== 'web') return pickNative(source);
  const file = await chooseFile(source);
  if (!file) return null;
  if (!file.type.startsWith('image/')) throw new ImageReadError();
  return shrink(file);
}

/**
 * Auf dem Telefon: Kamera oder Fotos, dann auf `MAX_IMAGE_EDGE` verkleinert
 * und neu als JPEG kodiert — ohne EXIF, also ohne Ort und Geraet.
 */
async function pickNative(source: ImageSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new ImagePermissionError();
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
    allowsEditing: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_IMAGE_EDGE) {
    context.resize(
      asset.width >= asset.height
        ? { width: MAX_IMAGE_EDGE, height: null }
        : { width: null, height: MAX_IMAGE_EDGE },
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
}

function chooseFile(source: ImageSource): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // Auf dem Telefon oeffnet der Browser damit gleich die Kamera; am Rechner die Dateiwahl.
    if (source === 'camera') input.setAttribute('capture', 'environment');
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
