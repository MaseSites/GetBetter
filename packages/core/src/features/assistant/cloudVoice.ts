import { callService, serviceUrl } from '@/db/service';
import type { Language } from '@/i18n';

/**
 * Echt klingende Stimmen von ElevenLabs — ueber den eigenen Dienst, nie direkt:
 * der Schluessel liegt nur dort (`services/api/speech/service.js`).
 *
 * Ist der Dienst eingerichtet, sprechen alle mit diesen Stimmen: der Avatar,
 * das Gespraech, die Probe beim Aussuchen. Scheitert eine, springt die Stimme
 * des Browsers ein — lieber blechern als stumm.
 */

/** So beginnt eine Stimme von ElevenLabs im Konto; alles andere ist eine des Browsers. */
export const CLOUD_PREFIX = 'eleven:';

export type CloudVoice = {
  id: string;
  name: string;
  gender: string | null;
  accent: string | null;
  languages: readonly string[];
};

export type CloudState = {
  /** Ob der Dienst einen Schluessel hat. */
  configured: boolean;
  /** Was zuletzt schiefging (`auth_failed`, `quota_exceeded` …) — `null`, wenn alles lief. */
  problem: string | null;
  voices: readonly CloudVoice[];
};

/** So lange darf es dauern, bis der erste Ton kommt. Danach spricht der Browser. */
const START_MS = 12_000;
/** Laenger redet er in einem Satz nie. */
const LONGEST_MS = 90_000;

let state: CloudState = { configured: false, problem: null, voices: [] };
let loadedFor: Language | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function update(next: Partial<CloudState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function cloudState(): CloudState {
  return state;
}

export function onCloudChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fragt den Dienst, ob er Stimmen hat, und laedt sie fuer diese Sprache. Mehrfach
 * aufgerufen, fragt er nur einmal; `force` fragt neu, etwa beim Oeffnen der Auswahl.
 */
export function loadCloudVoices(language: Language, force = false): Promise<void> {
  if (!force && loadedFor === language) return loading ?? Promise.resolve();
  loadedFor = language;
  loading = (async () => {
    const status = await callService<{ configured: boolean; lastError: string | null }>(
      '/v1/speech/status',
    );
    // Ein Dienst ohne diese Route (noch nicht neu gestartet) hat eben keine Stimmen.
    if (!status.ok || !status.data.configured) {
      update({ configured: false, problem: null, voices: [] });
      return;
    }
    const listed = await callService<{ voices: CloudVoice[] }>(
      `/v1/speech/voices?language=${language}`,
    );
    update(
      listed.ok
        ? { configured: true, problem: status.data.lastError, voices: listed.data.voices }
        : { configured: true, problem: listed.error, voices: [] },
    );
  })();
  return loading;
}

/**
 * Die Stimme von ElevenLabs, die sprechen soll — oder `null`, wenn der Browser
 * spricht. Ist der Dienst eingerichtet, gilt eine gewaehlte Browser-Stimme
 * nicht mehr: dann spricht die gewaehlte von ElevenLabs, sonst die oberste.
 */
export function cloudVoiceFor(voiceUri: string | null): string | null {
  const first = state.voices[0];
  if (!state.configured || !first) return null;
  if (voiceUri?.startsWith(CLOUD_PREFIX)) {
    const id = voiceUri.slice(CLOUD_PREFIX.length);
    if (state.voices.some((voice) => voice.id === id)) return id;
  }
  return first.id;
}

type AudioLike = {
  play: () => Promise<void>;
  pause: () => void;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  onplaying: (() => void) | null;
};

type AudioClass = new (src: string) => AudioLike;

/** Spielt einen Satz von ElevenLabs ab. Einer nach dem anderen. */
export class CloudPlayer {
  private audio: AudioLike | null = null;
  private watch: ReturnType<typeof setTimeout> | null = null;
  private turn = 0;

  /** `onDone(true)` heisst gesagt, `onDone(false)` heisst: hat nicht geklappt. */
  play(text: string, voiceId: string, language: Language, onDone: (spoken: boolean) => void) {
    this.stop();
    const turn = this.turn;
    const AudioElement = (globalThis as { Audio?: AudioClass }).Audio;
    if (!AudioElement) {
      onDone(false);
      return;
    }

    let finished = false;
    const finish = (spoken: boolean) => {
      if (finished || turn !== this.turn) return;
      finished = true;
      this.clearWatch();
      this.audio = null;
      if (!spoken) void loadCloudVoices(language, true);
      onDone(spoken);
    };

    this.watch = setTimeout(() => finish(false), START_MS);
    void callService<{ url: string }>('/v1/speech', {
      method: 'POST',
      body: { text, voice: voiceId, language },
    }).then((prepared) => {
      if (turn !== this.turn || finished) return;
      if (!prepared.ok) {
        finish(false);
        return;
      }
      const audio = new AudioElement(`${serviceUrl()}${prepared.data.url}`);
      this.audio = audio;
      audio.onplaying = () => {
        this.clearWatch();
        this.watch = setTimeout(() => finish(true), LONGEST_MS);
      };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.play().catch(() => finish(false));
    });
  }

  /** Sofort still. Der laufende Satz meldet sich nicht mehr. */
  stop() {
    this.turn += 1;
    this.clearWatch();
    const audio = this.audio;
    this.audio = null;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.onplaying = null;
    audio.pause();
  }

  private clearWatch() {
    if (this.watch === null) return;
    clearTimeout(this.watch);
    this.watch = null;
  }
}
