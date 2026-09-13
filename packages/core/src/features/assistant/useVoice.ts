import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useI18n, type Language } from '@/i18n';
import { useApp } from '@/state/AppContext';

import { canListen, Voice, type SpeechProblem } from './speech';

/**
 * Wie oft er im Gespraech ins Leere hoeren darf, bevor er auflegt. Ohne diese
 * Grenze liefe das Mikrofon weiter, wenn niemand mehr da ist.
 */
const SILENT_TURNS_UNTIL_END = 2;

/** Welcher der beiden Knoepfe gerade laeuft. */
export type VoiceMode = 'off' | 'speak' | 'talk';

/** Woran man sieht, was er gerade tut. */
export type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking';

export type VoiceHandlers = {
  /** Eine einzelne Sprachnachricht — das Gesagte gehoert ins Feld. */
  onDictate: (text: string) => void;
  /** Eine Runde im Gespraech: was er darauf antwortet, oder `null`. */
  onTurn: (text: string) => Promise<string | null>;
};

type VoiceState = {
  mode: VoiceMode;
  phase: VoicePhase;
  /** Was er waehrend des Sprechens zu verstehen glaubt. */
  heard: string;
  problem: SpeechProblem | null;
};

const IDLE: VoiceState = { mode: 'off', phase: 'idle', heard: '', problem: null };

export type Voicing = VoiceState & {
  /** Ob hier ueberhaupt zugehoert werden kann. */
  available: boolean;
  /** Der Mikrofon-Knopf: anfangen, und beim zweiten Tipp fertig sein. */
  dictate: () => void;
  /** Der Gespraechs-Knopf: an und wieder aus. */
  talk: () => void;
  /** Eine Meldung wegraeumen, sobald der Nutzer etwas anderes tut. */
  clear: () => void;
};

/**
 * Der Ablauf hinter den beiden Knoepfen.
 *
 * Er lebt in einer kleinen Klasse: waehrend einer Runde aendert sich vieles,
 * das niemand sieht, und gerendert wird nur, was oben steht. Beim Verlassen
 * des Bildschirms wird alles losgelassen — ein Mikrofon, das weiterlaeuft,
 * waere ein Fehler.
 */
class VoiceSession {
  private readonly voice = new Voice();
  private handlers: VoiceHandlers = {
    onDictate: () => undefined,
    onTurn: () => Promise.resolve(null),
  };
  private state: VoiceState = IDLE;
  private silentTurns = 0;
  private alive = true;

  constructor(private readonly report: (state: VoiceState) => void) {}

  setHandlers(handlers: VoiceHandlers) {
    this.handlers = handlers;
  }

  setLanguage(language: Language) {
    this.voice.setLanguage(language);
  }

  /** Die Stimme, die er sich unter Aussehen geben laesst. */
  setVoice(uri: string | undefined) {
    this.voice.setVoice(uri);
  }

  dictate() {
    // Der zweite Tipp heisst: fertig gesprochen.
    if (this.state.mode === 'speak') {
      this.voice.finishListening();
      return;
    }
    this.begin('speak');
  }

  talk() {
    if (this.state.mode === 'talk') {
      this.end();
      return;
    }
    this.begin('talk');
  }

  clear() {
    if (this.state.problem === null) return;
    this.patch({ problem: null });
  }

  /**
   * Der Bildschirm ist nicht mehr vorn — beim Wechsel des Tabs oder wenn die
   * App in den Hintergrund geht. Alles aus, die Sitzung bleibt benutzbar.
   */
  pause() {
    if (this.state.mode === 'off') return;
    this.end();
  }

  /** Beim Verlassen des Bildschirms. Danach meldet sich nichts mehr. */
  release() {
    this.alive = false;
    this.voice.release();
  }

  private begin(mode: VoiceMode) {
    // Ehrlich statt still: wo nicht zugehoert werden kann, steht das da.
    if (!canListen()) {
      this.patch({ ...IDLE, problem: 'unavailable' });
      return;
    }
    this.silentTurns = 0;
    this.patch({ mode, phase: 'listening', heard: '', problem: null });
    this.listen();
  }

  private end(problem: SpeechProblem | null = null) {
    this.voice.release();
    this.silentTurns = 0;
    this.patch({ ...IDLE, problem });
  }

  private listen() {
    this.patch({ phase: 'listening', heard: '' });
    this.voice.listen({
      onPartial: (text) => {
        if (this.state.mode === 'off') return;
        this.patch({ heard: text });
      },
      onDone: (text, problem) => this.finishTurn(text, problem),
    });
  }

  private finishTurn(text: string, problem: SpeechProblem | null) {
    if (!this.alive || this.state.mode === 'off') return;

    // Nichts gehoert ist im Gespraech noch kein Grund aufzuhoeren.
    if (problem !== null && problem !== 'unheard') {
      this.end(problem);
      return;
    }

    if (this.state.mode === 'speak') {
      this.end(text.length === 0 ? 'unheard' : null);
      if (text.length > 0) this.handlers.onDictate(text);
      return;
    }

    if (text.length === 0) {
      this.silentTurns += 1;
      if (this.silentTurns >= SILENT_TURNS_UNTIL_END) {
        this.end('unheard');
        return;
      }
      this.listen();
      return;
    }

    this.silentTurns = 0;
    this.patch({ phase: 'thinking', heard: '' });
    void this.handlers.onTurn(text).then(
      (reply) => this.answer(reply),
      // Scheitert die Antwort, endet das Gespraech mit einem Satz statt still.
      () => this.end('failed'),
    );
  }

  private answer(reply: string | null) {
    if (!this.alive || this.state.mode !== 'talk') return;
    if (reply === null || reply.trim().length === 0) {
      this.listen();
      return;
    }
    this.patch({ phase: 'speaking' });
    // Erst zu Ende reden, dann wieder zuhoeren — sonst hoerte er sich selbst.
    this.voice.say(reply, () => {
      if (!this.alive || this.state.mode !== 'talk') return;
      this.listen();
    });
  }

  private patch(next: Partial<VoiceState>) {
    if (!this.alive) return;
    this.state = { ...this.state, ...next };
    this.report(this.state);
  }
}

export function useVoice({ onDictate, onTurn }: VoiceHandlers): Voicing {
  const { language } = useI18n();
  const { account } = useApp();
  const [state, setState] = useState<VoiceState>(IDLE);
  // Kein `useRef`: die Sitzung entsteht einmal, und `useState` ist dafuer da.
  const [session] = useState(() => new VoiceSession(setState));

  // Die neueste Rueckruffunktion reicht ein Effekt nach.
  useEffect(() => {
    session.setHandlers({ onDictate, onTurn });
  }, [session, onDictate, onTurn]);

  useEffect(() => {
    session.setLanguage(language);
  }, [session, language]);

  useEffect(() => {
    session.setVoice(account?.assistantVoice);
  }, [session, account?.assistantVoice]);

  // Der Tab bleibt beim Wechsel stehen — ohne das hier liefe das Mikrofon
  // weiter, waehrend man laengst woanders ist.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) session.pause();
  }, [session, focused]);

  // Und dasselbe, wenn die App in den Hintergrund geht oder der Browser-Tab
  // in den Hintergrund rueckt.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') session.pause();
    });
    return () => subscription.remove();
  }, [session]);

  useEffect(() => () => session.release(), [session]);

  return {
    ...state,
    available: canListen(),
    dictate: () => session.dictate(),
    talk: () => session.talk(),
    clear: () => session.clear(),
  };
}
