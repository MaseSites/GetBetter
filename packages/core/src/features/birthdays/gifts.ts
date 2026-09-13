// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { ContactGift } from '../../db/types';

/**
 * Geschenkideen einer Person, ohne Speicher. Eine Idee ist offen, bis sie
 * verschenkt ist; dann traegt sie das Jahr und rutscht unter „Verschenkt“ —
 * so verschenkt man nichts doppelt.
 */

export type GiftInput = { text: string; url?: string | null; price?: string | null };

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  return text.length > 0 ? text : null;
}

/** Noch nicht verschenkt, in der Reihenfolge des Eintragens. */
export function openGifts(gifts: readonly ContactGift[] = []): ContactGift[] {
  return gifts.filter((gift) => gift.givenYear === undefined || gift.givenYear === null);
}

/** Verschenkt, das juengste Jahr zuerst. */
export function givenGifts(gifts: readonly ContactGift[] = []): ContactGift[] {
  return gifts
    .filter((gift) => typeof gift.givenYear === 'number')
    .sort((a, b) => (b.givenYear ?? 0) - (a.givenYear ?? 0) || a.text.localeCompare(b.text));
}

/** Die Idee, die in der Liste unter dem Namen steht. */
export function firstOpenGift(gifts: readonly ContactGift[] = []): ContactGift | null {
  return openGifts(gifts)[0] ?? null;
}

/** Eine Idee aus der Eingabe — null, wenn kein Text da ist. */
export function giftFrom(id: string, input: GiftInput): ContactGift | null {
  const text = trimmed(input.text);
  if (!text) return null;
  const url = trimmed(input.url);
  const price = trimmed(input.price);
  return { id, text, ...(url ? { url } : {}), ...(price ? { price } : {}) };
}

/** Anhaengen; ohne Text bleibt die Liste, wie sie ist. */
export function addGift(
  gifts: readonly ContactGift[] = [],
  id: string,
  input: GiftInput,
): ContactGift[] {
  const gift = giftFrom(id, input);
  return gift ? [...gifts, gift] : [...gifts];
}

/** Text, Link und Preis ersetzen; das Jahr bleibt. Ohne Text faellt die Idee weg. */
export function editGift(
  gifts: readonly ContactGift[] = [],
  id: string,
  input: GiftInput,
): ContactGift[] {
  return gifts.flatMap((gift) => {
    if (gift.id !== id) return [gift];
    const next = giftFrom(id, input);
    if (!next) return [];
    return [typeof gift.givenYear === 'number' ? { ...next, givenYear: gift.givenYear } : next];
  });
}

/** Abhaken heisst verschenkt (mit Jahr); `null` macht die Idee wieder offen. */
export function setGiven(
  gifts: readonly ContactGift[] = [],
  id: string,
  year: number | null,
): ContactGift[] {
  return gifts.map((gift) => (gift.id === id ? { ...gift, givenYear: year } : gift));
}

export function removeGift(gifts: readonly ContactGift[] = [], id: string): ContactGift[] {
  return gifts.filter((gift) => gift.id !== id);
}
