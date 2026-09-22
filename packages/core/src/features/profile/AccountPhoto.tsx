import { useApp } from '@/state/AppContext';
import { uploadUrl } from '@/theme/backdrops';
import { Avatar } from '@/ui';

/**
 * Das Profilbild des Kontos — ohne eigenes das Kuerzel des Spitznamens. Liest
 * das Konto selbst, damit Profil, Einstellungen und Blatt dasselbe zeigen.
 */
export function AccountPhoto({ size }: { size: number }) {
  const { account } = useApp();
  if (!account) return null;
  const name = account.firstName || account.username || account.email;
  const photo = account.photoUploadId;
  return <Avatar name={name} size={size} {...(photo ? { imageUri: uploadUrl(photo) } : {})} />;
}
