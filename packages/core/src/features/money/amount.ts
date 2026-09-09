/** "12.50", "12,50", "CHF 12.50" → 12.5; alles andere → null. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}
