/**
 * Im Browser gibt es keinen Live-Scanner: dort liest `barcodeScan.ts` den Code
 * aus einem Foto (wo `BarcodeDetector` existiert), sonst tippt man die Ziffern.
 * Auf iPhone und Android nimmt Metro `BarcodeScanner.native.tsx`.
 */
export const canScanLive = false;

export function BarcodeScanner(_props: { onCode: (code: string) => void; onCancel: () => void }) {
  return null;
}
