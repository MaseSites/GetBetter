import { idempotencyKey } from '../../db/fitEvents';

/**
 * Ein Schluessel je Absicht (dieses Rezept, diese Plan-Mahlzeit), solange das
 * Blatt offen ist: ein zweiter Tipp oder ein Neuversuch nach einem Netzfehler
 * legt nichts doppelt an.
 */
export class IntentKeys {
  private keys = new Map<string, string>();

  of(intent: string): string {
    const known = this.keys.get(intent);
    if (known) return known;
    const key = idempotencyKey(intent.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'meal');
    this.keys.set(intent, key);
    return key;
  }
}
