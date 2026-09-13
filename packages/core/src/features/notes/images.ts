import type { ImageSourcePropType } from 'react-native';

import type { NoteBlock } from '@/db/types';
import { canPickImage, ImageReadError, pickImage } from '@/features/personalize/pickImage';
import { removeUpload, uploadBackdrop, type UploadError } from '@/features/personalize/uploads';
import type { TranslationKey } from '@/i18n';
import { uploadSource } from '@/theme/backdrops';

/**
 * Bilder in Notizen: gewaehlt wie ein eigener Hintergrund (`pickImage`,
 * verkleinert) und beim Dienst unter `/v1/uploads` abgelegt. Nur Bilder —
 * Dateien, Sprachaufnahmen und PDFs brauchen Pakete, die noch fehlen.
 */

export type NoteImageError = UploadError | 'unreadable';

/** `null`: nichts gewaehlt. */
export type NoteImageResult =
  { ok: true; id: string } | { ok: false; error: NoteImageError } | null;

/** Im Browser ja; auf dem Geraet fehlt dafuer noch expo-image-picker. */
export function canAddImage(): boolean {
  return canPickImage();
}

export async function addNoteImage(accountId: string): Promise<NoteImageResult> {
  let dataUrl: string | null;
  try {
    dataUrl = await pickImage();
  } catch (error) {
    if (error instanceof ImageReadError) return { ok: false, error: 'unreadable' };
    throw error;
  }
  if (!dataUrl) return null;
  return uploadBackdrop(accountId, dataUrl);
}

export function noteImageSource(uploadId: string): ImageSourcePropType {
  return uploadSource(uploadId);
}

export const IMAGE_ERROR_KEYS: Readonly<Record<NoteImageError, TranslationKey>> = {
  offline: 'notes.image.error.offline',
  notYet: 'notes.image.error.notYet',
  rejected: 'notes.image.error.rejected',
  failed: 'notes.image.error.failed',
  unreadable: 'notes.image.error.unreadable',
};

export function imageIdsOf(blocks: readonly NoteBlock[] | undefined): string[] {
  return (blocks ?? [])
    .map((block) => (block.kind === 'image' ? block.uploadId : undefined))
    .filter((id): id is string => typeof id === 'string');
}

/** Raeumt die Bilder endgueltig geloeschter Notizen beim Dienst ab. Was nicht klappt, bleibt liegen. */
export async function removeNoteImages(
  rows: readonly { blocks?: readonly NoteBlock[] }[],
): Promise<void> {
  const ids = rows.flatMap((row) => imageIdsOf(row.blocks));
  await Promise.all(ids.map((id) => removeUpload(id).catch(() => false)));
}
