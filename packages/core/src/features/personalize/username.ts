import { normaliseUsername } from '@/auth/accounts';
import { fetchByUsername } from '@/db/service';

export type UsernameCheck = 'ok' | 'empty' | 'taken' | 'offline';

/**
 * Ob dieser Benutzername noch frei ist. Nur der Dienst weiss es — darum wird
 * er gefragt. Antwortet er nicht, wird nichts gespeichert: lieber ehrlich
 * sagen, dass es gerade nicht geht, als einen Namen doppelt vergeben.
 */
export async function checkUsername(wanted: string, ownId: string): Promise<UsernameCheck> {
  const next = normaliseUsername(wanted);
  if (next.length === 0) return 'empty';

  const found = await fetchByUsername(next);
  if (found.ok) return found.account.id === ownId ? 'ok' : 'taken';
  return found.error === 'not_found' ? 'ok' : 'offline';
}
