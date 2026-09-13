import { Voice } from '@/features/assistant/speech';
import type { Language } from '@/i18n';

/**
 * So lange nach einem neuen Satz beginnt er zu reden — wenn die Blase aufgeht.
 * Haengt sich ein Bildschirm gleich nach dem Laden noch einmal ein, raeumt der
 * erste seinen Satz vorher ab, und es bleibt bei einem.
 */
const TELL_DELAY_MS = 350;

/**
 * Er sagt laut, was in seiner Blase steht — einmal je Satz.
 *
 * Die Blase waechst mit, waehrend man tippt; vorgelesen wird trotzdem nur beim
 * Wechsel des Schluessels. Wo der Browser nicht sprechen kann oder keinen Ton
 * erlaubt, bleibt er still — die Blase steht ja geschrieben da.
 */
export class Narrator {
  private readonly voice = new Voice();
  private told: string | null = null;
  private pending: ReturnType<typeof setTimeout> | null = null;
  /** Ob gerade sein eigener Satz laeuft. Nur den bricht er ab, nie den eines anderen. */
  private talking = false;

  configure(language: Language, voiceUri: string | undefined) {
    this.voice.setLanguage(language);
    this.voice.setVoice(voiceUri);
  }

  /** Den Satz zu diesem Schluessel sagen. Derselbe Schluessel ein zweites Mal bleibt still. */
  tell(key: string, text: string) {
    if (this.told === key) return;
    this.told = key;
    this.clearPending();
    this.pending = setTimeout(() => {
      this.pending = null;
      this.talking = true;
      this.voice.say(text, () => {
        this.talking = false;
      });
    }, TELL_DELAY_MS);
  }

  /** Still sein. Danach sagt er denselben Satz beim naechsten `tell` wieder. */
  hush() {
    this.told = null;
    this.clearPending();
    if (!this.talking) return;
    this.talking = false;
    this.voice.silence();
  }

  /** Beim Verlassen: kein Satz redet auf dem naechsten Bildschirm weiter. */
  release() {
    this.hush();
  }

  private clearPending() {
    if (this.pending === null) return;
    clearTimeout(this.pending);
    this.pending = null;
  }
}
