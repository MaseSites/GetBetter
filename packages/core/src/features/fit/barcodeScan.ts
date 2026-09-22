import { Platform } from 'react-native';

/**
 * Einen Barcode aus einem Foto lesen — im Browser ueber `BarcodeDetector`,
 * wo es ihn gibt (Chrome auf Android, macOS, ChromeOS). Sonst tippt man die
 * Ziffern unter dem Strichcode ab; die Pruefziffer prueft der Dienst.
 */

type Detected = { rawValue: string };
type Detector = { detect: (image: ImageBitmapSource) => Promise<Detected[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

function detectorClass(): DetectorClass | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const candidate = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  return candidate ?? null;
}

export function canDetectBarcode(): boolean {
  return detectorClass() !== null;
}

/** Liest den ersten EAN/UPC aus einer Data-URL, oder null. */
export async function detectBarcode(dataUrl: string): Promise<string | null> {
  const Detector = detectorClass();
  if (!Detector) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const found = await new Detector({ formats: ['ean_13', 'ean_8', 'upc_a'] }).detect(bitmap);
    return found[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}
