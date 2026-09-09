/** "12.50", "12,50", "CHF 12.50" → 12.5; alles andere → null. */
export function parseAmount(text: string): number | null {
  // Ein Minus vorne ist kein Betrag — sonst wuerde "-5" still zu 5.
  if (text.trim().startsWith('-')) return null;
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Das Epsilon rettet 1.005 vor dem Gleitkomma — sonst wuerde daraus 1.00.
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
