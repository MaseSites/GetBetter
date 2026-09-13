import { Linking, Platform, Share } from 'react-native';

import { contacts as contactRepo } from '@/db';
import { useTranslate } from '@/i18n';
import { useUndo } from '@/ui';

import { smsUrl, telUrl } from './links';

/** Teilen gibt es auf dem Telefon immer, im Browser nur, wo er es kann. */
export const canShare =
  Platform.OS !== 'web' ||
  (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

/** „Nachricht“ geht mit Nummer als SMS, ohne Nummer ueber das Teilen. */
export function canMessage(phone: string | null | undefined): boolean {
  return Boolean(phone) || canShare;
}

export type BirthdayActions = {
  message: (name: string, phone: string | null | undefined) => void;
  call: (phone: string) => void;
  shareWish: (name: string) => void;
  /** Nur der Geburtstag geht, nie der Kontakt — mit Rueckgaengig. */
  removeBirthday: (contactId: string) => Promise<void>;
};

/** Was man mit einem Geburtstag tut: gratulieren, anrufen, entfernen. */
export function useBirthdayActions(): BirthdayActions {
  const t = useTranslate();
  const undo = useUndo();

  function shareWish(name: string) {
    // Wer das Teilen abbricht, hat nichts falsch gemacht — dann passiert nichts.
    Share.share({ message: t('birthdays.wish', { name }) }).catch(() => undefined);
  }

  function message(name: string, phone: string | null | undefined) {
    if (!phone) {
      if (canShare) shareWish(name);
      return;
    }
    // Ohne Nachrichten-App (etwa im Browser am Computer) bleibt das Teilen.
    Linking.openURL(smsUrl(phone, t('birthdays.wish', { name }), Platform.OS)).catch(() => {
      if (canShare) shareWish(name);
    });
  }

  function call(phone: string) {
    // Ohne Telefon-App laesst sich nicht anrufen; dann bleibt es beim Tipp.
    Linking.openURL(telUrl(phone)).catch(() => undefined);
  }

  async function removeBirthday(contactId: string) {
    const before = await contactRepo.removeBirthday(contactId);
    if (!before) return;
    undo.show({
      message: t('birthdays.removed', { name: before.name }),
      onUndo: () => void contactRepo.restoreBirthday(before),
    });
  }

  return { message, call, shareWish, removeBirthday };
}
