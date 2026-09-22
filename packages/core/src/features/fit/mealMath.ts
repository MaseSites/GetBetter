import type { Macros } from '../../db/fitTypes';

/**
 * Vorschau-Rechnungen fuer das Eintragen und Bearbeiten — nur Vorschau, der
 * Dienst rechnet beim Speichern selbst. Rein und getestet.
 */

/** Ein Lebensmittel im Korb, bevor die Mahlzeit gespeichert wird. */
export type BasketItem = {
  foodId: string;
  name: string;
  per100: Macros;
  grams: number;
  /** Das gesuchte Wort — daraus lernt die Suche. */
  term?: string;
};

/** Hinzufuegen; dasselbe Lebensmittel nochmal zaehlt die Gramm zusammen. */
export function addToBasket<T extends BasketItem>(basket: readonly T[], item: T): T[] {
  const index = basket.findIndex((entry) => entry.foodId === item.foodId);
  if (index < 0) return [...basket, item];
  return basket.map((entry, position) =>
    position === index ? { ...entry, grams: entry.grams + item.grams } : entry,
  );
}

export function removeFromBasket<T extends BasketItem>(basket: readonly T[], foodId: string): T[] {
  return basket.filter((entry) => entry.foodId !== foodId);
}

/** Werte einer Menge aus den Werten je 100 g. */
export function macrosOf(per100: Macros, grams: number): Macros {
  const factor = grams / 100;
  return {
    kcal: per100.kcal * factor,
    proteinG: per100.proteinG * factor,
    carbsG: per100.carbsG * factor,
    fatG: per100.fatG * factor,
  };
}

export function totalOf(items: readonly { per100: Macros; grams: number }[]): Macros {
  return items.reduce<Macros>(
    (sum, item) => {
      const part = macrosOf(item.per100, item.grams);
      return {
        kcal: sum.kcal + part.kcal,
        proteinG: sum.proteinG + part.proteinG,
        carbsG: sum.carbsG + part.carbsG,
        fatG: sum.fatG + part.fatG,
      };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Eine Zeile der Foto-Analyse, wie sie im Blatt bearbeitet wird. */
export type PhotoRow = {
  key: string;
  term: string;
  food: { id: string; name: string; per100: Macros } | null;
  /** Was im Feld steht (null: leer oder unlesbar). */
  grams: number | null;
  /** Die Schaetzung der KI — fehlt bei Zeilen, die man selbst hinzugefuegt hat. */
  aiGrams: number | null;
  minGrams: number | null;
  maxGrams: number | null;
};

/**
 * Summe und Spanne der Foto-Zeilen, live aus den geaenderten Gramm: die
 * Spanne waechst mit der Menge (dieselbe Rechnung wie `scaledRanges` im Dienst).
 */
export function photoPreview(rows: readonly PhotoRow[]): {
  kcal: number;
  min: number;
  max: number;
} {
  let kcal = 0;
  let min = 0;
  let max = 0;
  for (const row of rows) {
    if (!row.food || row.grams === null || row.grams <= 0) continue;
    const per = row.food.per100.kcal / 100;
    kcal += per * row.grams;
    if (row.aiGrams && row.aiGrams > 0) {
      const ratio = row.grams / row.aiGrams;
      min += per * Math.min(row.grams, (row.minGrams ?? row.aiGrams) * ratio);
      max += per * Math.max(row.grams, (row.maxGrams ?? row.aiGrams) * ratio);
    } else {
      min += per * row.grams;
      max += per * row.grams;
    }
  }
  return { kcal: Math.round(kcal), min: Math.round(min), max: Math.round(max) };
}
