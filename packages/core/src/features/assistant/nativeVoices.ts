// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { RawVoice } from './voices';

/**
 * Eine Stimme, wie sie `expo-speech` auf dem Geraet meldet — hier nur als
 * Form, damit die Rechnung ohne das Paket testbar bleibt.
 */
export type NativeVoice = {
  identifier: string;
  name: string;
  language: string;
  /** iOS: `Default` oder `Enhanced`. */
  quality?: string;
};

/**
 * Dieselbe Form wie die Stimmen des Browsers, damit `rankVoices` sie
 * einordnet: „Enhanced“ (iOS) klingt wie ein Mensch, Stimmen aus dem Netz
 * (Android: `…-network`) sauber, die Sprachpakete des Systems blechern.
 */
export function rawOfNative(voice: NativeVoice): RawVoice {
  const enhanced = (voice.quality ?? '').toLowerCase() === 'enhanced';
  return {
    uri: voice.identifier,
    name: enhanced ? `${voice.name} (Enhanced)` : voice.name,
    tag: voice.language.replace('_', '-'),
    local: !/network/iu.test(voice.identifier),
  };
}
