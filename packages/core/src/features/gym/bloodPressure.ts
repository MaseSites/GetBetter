/**
 * Blutdruck einordnen nach ESC 2024 (Praxismessung, mmHg):
 * nicht erhoeht < 120/70, erhoeht 120–139 / 70–89, Hypertonie ab 140/90.
 * Die hoehere Kategorie von oben und unten zaehlt. Eine Einordnung, keine Diagnose.
 */
export type BpCategory = 'normal' | 'elevated' | 'hypertension';

const RANK: Record<BpCategory, number> = { normal: 0, elevated: 1, hypertension: 2 };

function systolicOf(sys: number): BpCategory {
  if (sys >= 140) return 'hypertension';
  if (sys >= 120) return 'elevated';
  return 'normal';
}

function diastolicOf(dia: number): BpCategory {
  if (dia >= 90) return 'hypertension';
  if (dia >= 70) return 'elevated';
  return 'normal';
}

export function bpCategoryOf(sys: number, dia: number | null): BpCategory {
  const top = systolicOf(sys);
  if (dia === null || !Number.isFinite(dia)) return top;
  const bottom = diastolicOf(dia);
  return RANK[bottom] > RANK[top] ? bottom : top;
}
