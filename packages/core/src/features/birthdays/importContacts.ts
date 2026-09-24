import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

import { contacts as contactRepo } from '@/db';

import { draftBirthdayKey } from './birthdays';

/**
 * Geburtstage aus den Kontakten des Handys uebernehmen (`expo-contacts`).
 * Nur wer dort einen Geburtstag hat, kommt herein: als neuer Kontakt oder als
 * Datum an einem Kontakt gleichen Namens, der noch keines hat. Wer schon eines
 * hat, bleibt unberuehrt. Im Browser gibt es das nicht.
 */
export const canImportContacts = Platform.OS !== 'web';

export type ImportResult =
  | { ok: true; added: number; updated: number; skipped: number }
  | { ok: false; error: 'denied' | 'failed' };

/** Die aeltere Schnittstelle zaehlt die Monate ab 0 — die neue ab 1. */
function monthOf(date: { month: number }): number | null {
  const raw = Math.trunc(date.month);
  if (raw >= 0 && raw <= 11) return raw + 1;
  return null;
}

function nameOf(contact: { name?: string; firstName?: string; lastName?: string }): string {
  const full = contact.name?.trim() ?? '';
  if (full.length > 0) return full;
  return [contact.firstName, contact.lastName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');
}

export async function importBirthdays(accountId: string): Promise<ImportResult> {
  if (!canImportContacts) return { ok: false, error: 'failed' };
  try {
    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) return { ok: false, error: 'denied' };
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.Birthday, Contacts.Fields.PhoneNumbers],
    });
    const existing = await contactRepo.list(accountId);
    const byName = new Map(existing.map((row) => [row.name.trim().toLowerCase(), row]));

    let added = 0;
    let updated = 0;
    let skipped = 0;
    for (const contact of data) {
      const birthday = contact.birthday;
      const name = nameOf(contact);
      if (!birthday || typeof birthday.day !== 'number' || name.length === 0) continue;
      const month = monthOf(birthday);
      if (month === null) continue;
      const year = typeof birthday.year === 'number' && birthday.year > 0 ? birthday.year : null;
      const key = draftBirthdayKey(month, birthday.day, year);
      const phone = contact.phoneNumbers?.[0]?.number ?? null;

      const known = byName.get(name.toLowerCase());
      if (known) {
        if (known.birthday) {
          skipped += 1;
          continue;
        }
        await contactRepo.update(known.id, {
          birthday: key,
          birthYearKnown: year !== null,
          ...(phone && !known.phone ? { phone } : {}),
        });
        updated += 1;
        continue;
      }
      const row = await contactRepo.add({
        accountId,
        name,
        birthday: key,
        birthYearKnown: year !== null,
        phone,
      });
      byName.set(name.toLowerCase(), row);
      added += 1;
    }
    return { ok: true, added, updated, skipped };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
