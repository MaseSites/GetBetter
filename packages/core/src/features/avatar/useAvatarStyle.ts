import { useApp } from '@/state/AppContext';

import type { AvatarStyle } from './style';

/**
 * Der Avatar des angemeldeten Kontos, gelesen, als waere alles gueltig. Ohne
 * Konto — auf dem Startbildschirm, beim Anmelden — und ohne Abo der Standard.
 */
export function useAvatarStyle(): AvatarStyle {
  return useApp().personal.avatar;
}
