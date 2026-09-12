import { callService } from '@/db/service';
import { isUploadId } from '@/theme/backdrops';

/** Was beim Hochladen schiefgehen kann — so, wie es die Auswahl erklaert. */
export type UploadError = 'offline' | 'notYet' | 'rejected' | 'failed';

export type UploadResult = { ok: true; id: string } | { ok: false; error: UploadError };

/** Legt ein eigenes Bild beim Dienst ab (`POST /v1/uploads`) und gibt seine Id zurueck. */
export async function uploadBackdrop(accountId: string, dataUrl: string): Promise<UploadResult> {
  const result = await callService<{ id?: unknown; url?: unknown }>('/v1/uploads', {
    method: 'POST',
    body: { accountId, dataUrl },
  });
  if (!result.ok) return { ok: false, error: uploadErrorOf(result.error) };
  const { id } = result.data;
  if (typeof id !== 'string' || !isUploadId(id)) return { ok: false, error: 'failed' };
  return { ok: true, id };
}

/** Raeumt ein eigenes Bild ab, das nirgends mehr gewaehlt ist. */
export async function removeUpload(id: string): Promise<boolean> {
  const result = await callService<{ ok?: boolean }>(`/v1/uploads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return result.ok;
}

function uploadErrorOf(error: string): UploadError {
  if (error === 'offline') return 'offline';
  // Ein Dienst, der die Route nicht kennt, laeuft noch mit einem alten Stand.
  if (error === 'unknown_route' || error === 'http_404') return 'notYet';
  if (
    error === 'bad_request' ||
    error === 'unsupported_type' ||
    error === 'too_large' ||
    error === 'http_413'
  ) {
    return 'rejected';
  }
  return 'failed';
}
