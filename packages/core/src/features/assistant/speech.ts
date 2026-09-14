import { Platform } from 'react-native';

import { isViewing } from '@/app/viewMode';
import type { Language } from '@/i18n';

import { CloudPlayer, cloudVoiceFor, loadCloudVoices } from './cloudVoice';
import { rankVoices, type RankedVoice, type RawVoice } from './voices';

/**
 * Zuhoeren und Sprechen — ohne Zusatzpaket.
 *
 * Im Browser gibt es beides eingebaut: `SpeechRecognition` (in den meisten
 * Browsern nur unter `webkit`) versteht Gesprochenes, `speechSynthesis` liest
 * vor. Auf dem Geraet gaebe es das nur mit einem Paket, das noch nicht dabei
 * ist — dort sagt `canListen()` ehrlich nein, statt so zu tun.
 *
 * Geprueft wird zur Laufzeit, nicht nur nach Plattform: auch ein Browser kann
 * die Spracherkennung nicht kennen.
 */

/** Was schiefgehen kann, waehrend zugehoert wird. */
export type SpeechProblem = 'unavailable' | 'denied' | 'noDevice' | 'unheard' | 'failed';

/**
 * Eine Stimme, aus der man waehlen kann — mit kurzem Namen und wie gut sie
 * klingt. `cloud` kommt von ElevenLabs (`uri` beginnt mit `eleven:`), `browser`
 * ist eine Stimme dieses Browsers.
 */
export type SpeechVoice = RankedVoice & {
  provider: 'browser' | 'cloud';
  gender: string | null;
};

/** Eine Runde Zuhoeren. `onDone` kommt genau einmal — auch wenn nichts ankam. */
export type ListenTurn = {
  /** Was er waehrend des Sprechens zu verstehen glaubt. */
  onPartial: (text: string) => void;
  /** Das Ende der Runde: der verstandene Satz, sonst warum nicht. */
  onDone: (text: string, problem: SpeechProblem | null) => void;
};

/** Die Sprache des Kontos als BCP-47 — Schweizer Varianten, wie ueberall. */
const SPEECH_TAG: Record<Language, string> = {
  de: 'de-CH',
  fr: 'fr-CH',
  it: 'it-CH',
  en: 'en-US',
};

/**
 * Nur das, was hier gebraucht wird. TypeScript kennt die Ereignisse der
 * Spracherkennung, die Erkennung selbst aber (noch) nicht.
 */
type Recogniser = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecogniserClass = new () => Recogniser;

type SpeechScope = {
  SpeechRecognition?: RecogniserClass;
  webkitSpeechRecognition?: RecogniserClass;
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: new (text: string) => SpeechSynthesisUtterance;
};

function scope(): SpeechScope {
  return globalThis as unknown as SpeechScope;
}

function recogniserClass(): RecogniserClass | null {
  if (Platform.OS !== 'web') return null;
  const found = scope();
  return found.SpeechRecognition ?? found.webkitSpeechRecognition ?? null;
}

/** Ob hier ueberhaupt jemand zuhoeren kann. Im Nur-Lesen-Modus nie: kein Mikrofon. */
export function canListen(): boolean {
  return recogniserClass() !== null && !isViewing();
}

/** Ob hier vorgelesen werden kann. Fehlt das, bleibt die Antwort trotzdem lesbar. */
export function canSpeak(): boolean {
  if (Platform.OS !== 'web' || isViewing()) return false;
  const found = scope();
  return found.speechSynthesis !== undefined && found.SpeechSynthesisUtterance !== undefined;
}

/**
 * Die Stimmen, die zu dieser Sprache passen: die natuerlich klingenden zuerst,
 * bei gleicher Guete die Schweizer Fassung (siehe `rankVoices`).
 *
 * Leer, wenn dieser Browser nicht sprechen kann; leer auch beim allerersten
 * Aufruf, solange die Liste noch laedt (siehe `onVoicesChanged`).
 */
export function listVoices(language: Language): readonly SpeechVoice[] {
  const synthesis = scope().speechSynthesis;
  if (!synthesis) return [];
  return rankVoices(synthesis.getVoices().map(rawOf), language, SPEECH_TAG[language]).map(
    (voice) => ({ ...voice, provider: 'browser' as const, gender: null }),
  );
}

function rawOf(voice: SpeechSynthesisVoice): RawVoice {
  return { uri: voice.voiceURI, name: voice.name, tag: voice.lang, local: voice.localService };
}

/** Die beste Stimme fuer dieses Sprachkennzeichen — die, die ohne eigene Wahl spricht. */
function bestFor(
  voices: readonly SpeechSynthesisVoice[],
  tag: string,
): SpeechSynthesisVoice | undefined {
  const best = rankVoices(voices.map(rawOf), tag.split('-')[0] ?? tag, tag)[0];
  return best ? voices.find((voice) => voice.voiceURI === best.uri) : undefined;
}

/**
 * Ob der Browser schon Ton erlaubt. Vor dem ersten Tipp oder Tastendruck auf
 * der Seite bleibt die Sprachausgabe stumm — so wollen es die Browser, und das
 * laesst sich nicht umgehen. Wo er es nicht verraet, gilt: erlaubt.
 */
export function soundAllowed(): boolean {
  const found = globalThis as { navigator?: { userActivation?: { hasBeenActive: boolean } } };
  const activation = found.navigator?.userActivation;
  return activation ? activation.hasBeenActive : true;
}

const ACTIVATING_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;

/** Meldet sich einmal, sobald Ton erlaubt ist. Gibt zurueck, wie man aufhoert zu warten. */
export function onSoundAllowed(listener: () => void): () => void {
  const page = (globalThis as { document?: Document }).document;
  if (!page || soundAllowed()) return () => undefined;
  let done = false;
  const detach = (check: () => void) => {
    for (const name of ACTIVATING_EVENTS) page.removeEventListener(name, check, true);
  };
  const check = () => {
    // Erst nach dem Ereignis nachsehen: dann hat der Browser die Erlaubnis sicher vermerkt.
    setTimeout(() => {
      if (done || !soundAllowed()) return;
      done = true;
      detach(check);
      listener();
    }, 0);
  };
  for (const name of ACTIVATING_EVENTS) page.addEventListener(name, check, true);
  return () => {
    done = true;
    detach(check);
  };
}

/**
 * Die Stimmen stehen nicht sofort bereit — die meisten Browser reichen sie
 * nach. Gibt zurueck, wie man wieder aufhoert zuzuhoeren.
 */
export function onVoicesChanged(listener: () => void): () => void {
  const synthesis = scope().speechSynthesis;
  if (!synthesis) return () => undefined;
  synthesis.addEventListener('voiceschanged', listener);
  return () => synthesis.removeEventListener('voiceschanged', listener);
}

function problemOf(code: SpeechRecognitionErrorCode): SpeechProblem | null {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied';
  if (code === 'audio-capture') return 'noDevice';
  if (code === 'no-speech') return 'unheard';
  // `aborted` heisst: wir selbst haben aufgehoert. Das ist kein Fehler.
  if (code === 'aborted') return null;
  return 'failed';
}

/** Alles zusammensetzen, was in dieser Runde verstanden wurde. */
function transcriptOf(results: SpeechRecognitionResultList): string {
  let text = '';
  for (let index = 0; index < results.length; index += 1) {
    const best = results[index]?.[0];
    if (best) text += best.transcript;
  }
  return text;
}

/**
 * Wie lange nach dem Aufhoeren auf das Ende gewartet wird, bevor er selbst
 * Schluss macht. Grosszuegig: der letzte Satz wird beim Dienst fertig
 * erkannt, und den soll niemand abschneiden.
 */
const END_GRACE_MS = 4000;

/**
 * So lange darf das Vorlesen brauchen, bis es beginnt. Faengt es bis dahin
 * nicht an — kein Ton erlaubt, keine Stimme installiert —, geht es ohne
 * weiter: die Antwort steht ja geschrieben da. Ein Gespraech, das auf eine
 * Stimme wartet, die nie kommt, waere sonst zu Ende, ohne es zu sagen.
 */
const SPEAK_START_MS = 1500;

/**
 * Und so lange hoechstens, bis es fertig ist. Manche Browser melden das Ende
 * einer laengeren Antwort nie — dann gilt sie nach der Zeit als gesagt, die
 * sie gebraucht haette. Grosszuegig gerechnet, damit nichts abgeschnitten
 * wird, was wirklich noch laeuft.
 */
const SPEAK_MS_PER_CHAR = 110;
const SPEAK_EXTRA_MS = 2000;
const SPEAK_MAX_MS = 20000;

function speakingMs(text: string): number {
  return Math.min(SPEAK_MAX_MS, SPEAK_EXTRA_MS + text.length * SPEAK_MS_PER_CHAR);
}

/** Die Runde, die gerade laeuft. */
type Running = {
  recogniser: Recogniser;
  /** Ob die Erkennung wirklich begonnen hat. Ohne Erlaubnis tut sie das nie. */
  started: boolean;
  finish: () => void;
};

/**
 * Das Mikrofon als kleine Klasse — der Zustand lebt ausserhalb von React,
 * gerendert wird nur, was man sieht.
 *
 * Eine Runde nach der anderen: `listen()` beendet eine laufende Runde still,
 * und waehrend vorgelesen wird, hoert niemand zu — sonst hoerte er sich selbst.
 */
export class Voice {
  private language: Language = 'de';
  private tag: string = SPEECH_TAG.de;
  private running: Running | null = null;
  private grace: ReturnType<typeof setTimeout> | null = null;
  private saying: SpeechSynthesisUtterance | null = null;
  private watch: ReturnType<typeof setTimeout> | null = null;
  private voiceUri: string | null = null;
  private readonly cloud = new CloudPlayer();

  setLanguage(language: Language) {
    this.language = language;
    this.tag = SPEECH_TAG[language];
    // Wer spricht, soll die echten Stimmen kennen, bevor der erste Satz kommt.
    void loadCloudVoices(language);
  }

  /** Die gewaehlte Stimme. Ohne sie nimmt der Browser die erste passende. */
  setVoice(uri: string | undefined) {
    const clean = uri?.trim() ?? '';
    this.voiceUri = clean.length > 0 ? clean : null;
  }

  listen(turn: ListenTurn) {
    const Klass = recogniserClass();
    if (!Klass || isViewing()) {
      turn.onDone('', 'unavailable');
      return;
    }

    // Was noch laeuft, gehoert einer alten Runde und wird still beendet —
    // und geredet wird jetzt auch nicht mehr, sonst hoerte er sich selbst.
    this.stop();
    this.silence();

    const recogniser = new Klass();
    let heard = '';
    let problem: SpeechProblem | null = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      this.clearGrace();
      if (this.running?.recogniser === recogniser) this.running = null;
      detach(recogniser);
      turn.onDone(heard.trim(), problem);
    };

    const running: Running = { recogniser, started: false, finish };

    recogniser.lang = this.tag;
    // Eine Aeusserung je Runde: danach ist Platz fuer die Antwort.
    recogniser.continuous = false;
    recogniser.interimResults = true;
    recogniser.maxAlternatives = 1;

    recogniser.onstart = () => {
      running.started = true;
    };
    recogniser.onresult = (event) => {
      heard = transcriptOf(event.results);
      turn.onPartial(heard.trim());
    };
    recogniser.onerror = (event) => {
      problem = problemOf(event.error);
    };
    recogniser.onend = finish;

    this.running = running;
    try {
      recogniser.start();
    } catch {
      // Ein zweites `start()` wirft. Dann gilt die Runde als gescheitert.
      problem = 'failed';
      finish();
    }
  }

  /**
   * Aufhoeren, aber behalten, was schon verstanden wurde — `onDone` kommt noch.
   *
   * Hat die Erkennung nie begonnen (die Erlaubnis steht noch aus, oder sie
   * wird nie erteilt), meldet der Browser auch kein Ende. Dann macht er selbst
   * Schluss, sonst bliebe der Knopf fuer immer auf „hoert zu“ stehen.
   */
  finishListening() {
    const running = this.running;
    if (!running) return;
    try {
      running.recogniser.stop();
    } catch {
      // Schon vorbei.
    }
    if (!running.started) {
      this.giveUp(running);
      return;
    }
    this.clearGrace();
    this.grace = setTimeout(() => {
      this.grace = null;
      if (this.running === running) this.giveUp(running);
    }, END_GRACE_MS);
  }

  /** Sofort still sein. Die laufende Runde meldet sich nicht mehr. */
  stop() {
    const running = this.running;
    this.clearGrace();
    if (!running) return;
    this.running = null;
    detach(running.recogniser);
    abort(running.recogniser);
  }

  /** Kein Ende in Sicht: das Mikrofon loslassen und die Runde selbst schliessen. */
  private giveUp(running: Running) {
    this.clearGrace();
    if (this.running === running) this.running = null;
    detach(running.recogniser);
    abort(running.recogniser);
    running.finish();
  }

  private clearGrace() {
    if (this.grace === null) return;
    clearTimeout(this.grace);
    this.grace = null;
  }

  /**
   * Vorlesen. `onDone` kommt in jedem Fall — auch wenn dieser Browser nicht
   * vorlesen kann oder gar nicht erst anfaengt; dann eben frueher, damit ein
   * Gespraech nicht haengen bleibt.
   */
  say(text: string, onDone: () => void) {
    this.silence();
    const clean = text.trim();
    // Nur ansehen: er redet nicht — weder Erzaehler noch Gespraech noch Probe.
    if (clean.length === 0 || isViewing()) {
      onDone();
      return;
    }
    // Ist ElevenLabs eingerichtet, spricht es dort. Scheitert das — kein
    // Guthaben, kein Netz —, spricht der Browser: lieber blechern als stumm.
    const cloudVoice = cloudVoiceFor(this.voiceUri);
    if (cloudVoice) {
      this.cloud.play(clean, cloudVoice, this.language, (spoken) => {
        if (spoken) onDone();
        else this.sayInBrowser(clean, onDone);
      });
      return;
    }
    this.sayInBrowser(clean, onDone);
  }

  /**
   * Die Probe beim Aussuchen einer Stimme. Bei ElevenLabs spricht der Dienst
   * einen festen Satz ohne Namen — einmal erzeugt, danach fuer alle gratis. Der
   * Browser liest `fallback`, denselben Satz aus `assistant.voice.sampleAnon`.
   */
  saySample(fallback: string, onDone: () => void) {
    this.silence();
    if (isViewing()) {
      onDone();
      return;
    }
    const cloudVoice = cloudVoiceFor(this.voiceUri);
    if (!cloudVoice) {
      this.say(fallback, onDone);
      return;
    }
    this.cloud.playSample(cloudVoice, this.language, (spoken) => {
      if (spoken) onDone();
      else this.sayInBrowser(fallback.trim(), onDone);
    });
  }

  private sayInBrowser(clean: string, onDone: () => void) {
    const found = scope();
    const Utterance = found.SpeechSynthesisUtterance;
    const synthesis = found.speechSynthesis;
    if (!Utterance || !synthesis) {
      onDone();
      return;
    }

    const utterance = new Utterance(clean);
    utterance.lang = this.tag;
    // Ohne eigene Wahl spricht die beste Stimme, die der Browser hat — nicht
    // die erste, und die ist oft die blecherne.
    const voices = synthesis.getVoices();
    const chosen =
      (this.voiceUri ? voices.find((voice) => voice.voiceURI === this.voiceUri) : undefined) ??
      bestFor(voices, this.tag);
    if (chosen) utterance.voice = chosen;

    const finish = () => {
      // Wurde dazwischen abgebrochen, gehoert dieses Ende einer alten Antwort.
      if (this.saying !== utterance) return;
      this.clearWatch();
      this.saying = null;
      onDone();
    };

    /** Kein Anfang oder kein Ende in Sicht: weiter, statt stumm zu warten. */
    const giveUp = () => {
      this.watch = null;
      if (this.saying !== utterance) return;
      this.silence();
      onDone();
    };

    utterance.onstart = () => {
      // Es redet — ab jetzt zaehlt, wie lange es dafuer brauchen darf.
      this.clearWatch();
      this.watch = setTimeout(giveUp, speakingMs(clean));
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    this.saying = utterance;
    this.watch = setTimeout(giveUp, SPEAK_START_MS);
    synthesis.speak(utterance);
  }

  /** Mitten im Satz aufhoeren. */
  silence() {
    this.cloud.stop();
    this.clearWatch();
    this.saying = null;
    const synthesis = scope().speechSynthesis;
    // Nur abbrechen, wenn wirklich etwas laeuft: `cancel()` direkt vor
    // `speak()` verschluckt in manchen Browsern die naechste Antwort.
    if (synthesis && (synthesis.speaking || synthesis.pending)) synthesis.cancel();
  }

  private clearWatch() {
    if (this.watch === null) return;
    clearTimeout(this.watch);
    this.watch = null;
  }

  /** Beim Verlassen des Bildschirms: kein Mikrofon laeuft weiter. */
  release() {
    this.stop();
    this.silence();
  }
}

function detach(recogniser: Recogniser) {
  recogniser.onstart = null;
  recogniser.onresult = null;
  recogniser.onerror = null;
  recogniser.onend = null;
}

function abort(recogniser: Recogniser) {
  try {
    recogniser.abort();
  } catch {
    // Schon vorbei.
  }
}
