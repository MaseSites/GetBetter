import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * Ein Satz vom Dienst als Ton: im Browser ein `Audio`-Element, auf dem
 * Geraet `expo-audio`. Beide melden dasselbe — es spielt, es ist zu Ende,
 * es ging schief —, damit `CloudPlayer` nichts davon wissen muss.
 */
export type PlaybackHandlers = {
  /** Einmal, sobald wirklich Ton kommt. */
  onPlaying: () => void;
  onEnded: () => void;
  onError: () => void;
};

export type Playback = {
  start: () => void;
  /** Sofort still; danach meldet sich nichts mehr. */
  stop: () => void;
};

type AudioElementLike = {
  play: () => Promise<void>;
  pause: () => void;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  onplaying: (() => void) | null;
};

type AudioClass = new (url: string) => AudioElementLike;

/** `null`, wenn hier nichts spielen kann. */
export function createPlayback(url: string, handlers: PlaybackHandlers): Playback | null {
  if (Platform.OS === 'web') return createWebPlayback(url, handlers);
  return createDevicePlayback(url, handlers);
}

function createWebPlayback(url: string, handlers: PlaybackHandlers): Playback | null {
  const AudioElement = (globalThis as { Audio?: AudioClass }).Audio;
  if (!AudioElement) return null;
  let audio: AudioElementLike | null = null;
  let started = false;
  return {
    start() {
      audio = new AudioElement(url);
      audio.onplaying = () => {
        if (started) return;
        started = true;
        handlers.onPlaying();
      };
      audio.onended = () => handlers.onEnded();
      audio.onerror = () => handlers.onError();
      audio.play().catch(() => handlers.onError());
    },
    stop() {
      const playing = audio;
      audio = null;
      if (!playing) return;
      playing.onended = null;
      playing.onerror = null;
      playing.onplaying = null;
      playing.pause();
    },
  };
}

/** Einmal je Lauf: auch mit stummgeschaltetem iPhone soll er reden. */
let audioMode: Promise<void> | null = null;
function ensureAudioMode(): Promise<void> {
  audioMode ??= setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  return audioMode;
}

function createDevicePlayback(url: string, handlers: PlaybackHandlers): Playback {
  let player: AudioPlayer | null = null;
  let done = false;
  let started = false;

  const release = () => {
    const current = player;
    player = null;
    try {
      current?.pause();
      current?.remove();
    } catch {
      // Schon weg.
    }
  };
  const finish = (ok: boolean) => {
    if (done) return;
    done = true;
    release();
    if (ok) handlers.onEnded();
    else handlers.onError();
  };

  return {
    start() {
      void ensureAudioMode().then(() => {
        if (done) return;
        try {
          const created = createAudioPlayer({ uri: url });
          player = created;
          created.addListener('playbackStatusUpdate', (status) => {
            if (status.playing && !started) {
              started = true;
              handlers.onPlaying();
            }
            if (status.didJustFinish) finish(true);
          });
          created.play();
        } catch {
          finish(false);
        }
      });
    },
    stop() {
      if (done) return;
      done = true;
      release();
    },
  };
}
