import { useMemo } from 'react';

import { useApp } from '@/state/AppContext';

import { normalizeAvatar, type AvatarStyle } from './style';

/**
 * Der Avatar des angemeldeten Kontos, gelesen, als waere alles gueltig. Ohne
 * Konto — auf dem Startbildschirm, beim Anmelden — der Standard.
 */
export function useAvatarStyle(): AvatarStyle {
  const { account } = useApp();
  const saved = account?.assistantAvatar;
  return useMemo(() => normalizeAvatar(saved), [saved]);
}
