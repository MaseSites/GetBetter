import { currentApp } from '@/app/identity';
import { callService, serviceUrl, withToken, type ServiceCall } from '@/db/service';
import type { Language } from '@/i18n';

import { createPlayback, type Playback } from './playback';

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

/** Warum dieses Konto in dieser App keine Stimmen von ElevenLabs bekommt. */
export type CloudBlock = 'plan_required' | 'budget_exhausted';

export type CloudState = {
  /** Ob der Dienst einen Schluessel hat — und dieses Konto sie benutzen darf. */
  configured: boolean;
  /** Was zuletzt schiefging (`auth_failed`, `quota_exceeded` …) — `null`, wenn alles lief. */
  problem: string | null;
  voices: readonly CloudVoice[];
  /** Ohne Abo oder mit aufgebrauchtem Kontingent: dann spricht der Browser, und das steht da. */
  blocked: CloudBlock | null;
};

type SpeechStatus = {
  configured: boolean;
  lastError: string | null;
  /** Ein Dienst von vorher kennt das Feld nicht — dann gilt: erlaubt. */
  allowed?: boolean;
  reason?: string | null;
};

const blockOf = (reason: string | null | undefined): CloudBlock =>
  reason === 'budget_exhausted' ? 'budget_exhausted' : 'plan_required';

/** So lange darf es dauern, bis der erste Ton kommt. Danach spricht der Browser. */
const START_MS = 12_000;
/** Laenger redet er in einem Satz nie. */
const LONGEST_MS = 90_000;

let state: CloudState = { configured: false, problem: null, voices: [], blocked: null };
let loadedFor: Language | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
/** Wer gerade angemeldet ist — damit der Dienst den Verbrauch dem Konto zuschreibt. */
let speaker: string | null = null;

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
 * Das angemeldete Konto, oder `null` vor dem Anmelden. Setzt `AppProvider`.
 * Ob es Stimmen von ElevenLabs bekommt, haengt am Abo — also neu fragen.
 */
export function setSpeaker(accountId: string | null) {
  if (speaker === accountId) return;
  speaker = accountId;
  const language = loadedFor;
  loadedFor = null;
  if (language !== null) void loadCloudVoices(language, true);
}

/** `/v1/speech/status` fuer dieses Konto in dieser App. */
function statusPath(): string {
  const query = new URLSearchParams({ app: currentApp().id });
  if (speaker) query.set('accountId', speaker);
  return `/v1/speech/status?${query.toString()}`;
}

/**
 * Fragt den Dienst, ob er Stimmen hat und dieses Konto sie benutzen darf, und
 * laedt sie fuer diese Sprache. Mehrfach aufgerufen, fragt er nur einmal;
 * `force` fragt neu, etwa beim Oeffnen der Auswahl.
 */
export function loadCloudVoices(language: Language, force = false): Promise<void> {
  if (!force && loadedFor === language) return loading ?? Promise.resolve();
  loadedFor = language;
  loading = (async () => {
    const status = await callService<SpeechStatus>(statusPath());
    // Ein Dienst ohne diese Route (noch nicht neu gestartet) hat eben keine Stimmen.
    if (!status.ok || !status.data.configured) {
      update({ configured: false, problem: null, voices: [], blocked: null });
      return;
    }
    // Ohne Abo (oder aufgebraucht) wie „nicht eingerichtet“ — nur mit einem Satz dazu.
    if (status.data.allowed === false) {
      update({
        configured: false,
        problem: null,
        voices: [],
        blocked: blockOf(status.data.reason),
      });
      return;
    }
    const listed = await callService<{ voices: CloudVoice[] }>(
      `/v1/speech/voices?language=${language}`,
    );
    update(
      listed.ok
        ? {
            configured: true,
            problem: status.data.lastError,
            voices: listed.data.voices,
            blocked: null,
          }
        : { configured: true, problem: listed.error, voices: [], blocked: null },
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

type Prepared = ServiceCall<{ url: string }>;

/** Spielt einen Satz von ElevenLabs ab. Einer nach dem anderen. */
export class CloudPlayer {
  private playback: Playback | null = null;
  private watch: ReturnType<typeof setTimeout> | null = null;
  private turn = 0;

  /** `onDone(true)` heisst gesagt, `onDone(false)` heisst: hat nicht geklappt. */
  play(text: string, voiceId: string, language: Language, onDone: (spoken: boolean) => void) {
    this.start(
      () =>
        callService<{ url: string }>('/v1/speech', {
          method: 'POST',
          body: { text, voice: voiceId, language, accountId: speaker, app: currentApp().id },
        }),
      language,
      onDone,
    );
  }

  /**
   * Die Probe beim Aussuchen: den Satz waehlt der Dienst, je Sprache einen ohne
   * Namen. So entsteht sie je Stimme nur einmal und kostet danach niemanden etwas.
   */
  playSample(voiceId: string, language: Language, onDone: (spoken: boolean) => void) {
    this.start(
      () =>
        callService<{ url: string }>('/v1/speech/sample', {
          method: 'POST',
          body: { voice: voiceId, language, accountId: speaker, app: currentApp().id },
        }),
      language,
      onDone,
    );
  }

  /** Sofort still. Der laufende Satz meldet sich nicht mehr. */
  stop() {
    this.turn += 1;
    this.clearWatch();
    const playing = this.playback;
    this.playback = null;
    playing?.stop();
  }

  private start(
    prepare: () => Promise<Prepared>,
    language: Language,
    onDone: (spoken: boolean) => void,
  ) {
    this.stop();
    const turn = this.turn;

    let finished = false;
    const finish = (spoken: boolean) => {
      if (finished || turn !== this.turn) return;
      finished = true;
      this.clearWatch();
      this.playback = null;
      if (!spoken) void loadCloudVoices(language, true);
      onDone(spoken);
    };

    this.watch = setTimeout(() => finish(false), START_MS);
    void prepare().then((prepared) => {
      if (turn !== this.turn || finished) return;
      if (!prepared.ok) {
        finish(false);
        return;
      }
      // Im Browser ein Audio-Element, auf dem Geraet expo-audio (`playback.ts`).
      const playback = createPlayback(withToken(`${serviceUrl()}${prepared.data.url}`), {
        onPlaying: () => {
          this.clearWatch();
          this.watch = setTimeout(() => finish(true), LONGEST_MS);
        },
        onEnded: () => finish(true),
        onError: () => finish(false),
      });
      if (!playback) {
        finish(false);
        return;
      }
      this.playback = playback;
      playback.start();
    });
  }

  private clearWatch() {
    if (this.watch === null) return;
    clearTimeout(this.watch);
    this.watch = null;
  }
}
