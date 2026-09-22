/**
 * Barcodes pruefen: EAN-13, EAN-8 und UPC-A (12 Stellen, wird zu EAN-13).
 * Ohne gueltige Pruefziffer geht keine Anfrage hinaus.
 */

function checkDigitOk(digits) {
  const body = digits.slice(0, -1);
  const sum = [...body].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

/** Gibt den bereinigten Code (EAN-13 oder EAN-8) oder null. */
function normalizeBarcode(input) {
  const digits = String(input ?? '').replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const code = digits.length === 12 ? `0${digits}` : digits;
  if (code.length !== 13 && code.length !== 8) return null;
  return checkDigitOk(code) ? code : null;
}

module.exports = { normalizeBarcode };
