import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { canSpeak, onSoundAllowed, soundAllowed } from '@/features/assistant/speech';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/AppContext';

import { Narrator } from './narrator';

/** Wer ihn einmal stumm schaltet, hat Ruhe — auch auf dem naechsten Bildschirm und morgen. */
const MUTED_KEY = 'better-life/narration-muted/v1';

type NarrationState = {
  muted: boolean;
  /** Ob der Browser schon Ton erlaubt. Das tut er erst nach dem ersten Tipp auf der Seite. */
  allowed: boolean;
};

let state: NarrationState = { muted: false, allowed: soundAllowed() };
const listeners = new Set<() => void>();
let started = false;

function update(next: Partial<NarrationState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

/** Beim ersten Gebrauch: die gemerkte Wahl lesen und auf den ersten Tipp warten. */
function start() {
  if (started) return;
  started = true;
  void AsyncStorage.getItem(MUTED_KEY).then(
    (stored) => {
      if (stored === '1') update({ muted: true });
    },
    () => undefined,
  );
  if (!state.allowed) onSoundAllowed(() => update({ allowed: true }));
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): NarrationState {
  return state;
}

function setMuted(muted: boolean) {
  update({ muted });
  void AsyncStorage.setItem(MUTED_KEY, muted ? '1' : '0').catch(() => undefined);
}

export type Narration = {
  /** Ob hier ueberhaupt gesprochen werden kann — im Browser ja, auf dem Geraet noch nicht. */
  available: boolean;
  muted: boolean;
  /** Er moechte reden, der Browser erlaubt aber noch keinen Ton: ein Tipp genuegt. */
  waiting: boolean;
  toggle: () => void;
};

/**
 * Er sagt laut, was in seiner Blase steht — auf dem Startbildschirm, beim
 * Anmelden und beim Einrichten. Ein neuer `key` heisst ein neuer Satz; ein
 * leerer `text` heisst still sein. Er spricht mit der Stimme des Kontos, ohne
 * Konto mit der besten, die der Browser hat.
 */
export function useNarration(key: string, text: string): Narration {
  const { language } = useI18n();
  const { account } = useApp();
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [narrator] = useState(() => new Narrator());
  const voiceUri = account?.assistantVoice;
  const available = canSpeak();
  const speaks = available && current.allowed && !current.muted && text.length > 0;

  // Vor dem Sprechen: in welcher Sprache und mit welcher Stimme.
  useEffect(() => {
    narrator.configure(language, voiceUri);
  }, [narrator, language, voiceUri]);

  useEffect(() => {
    if (!speaks) {
      narrator.hush();
      return;
    }
    narrator.tell(key, text);
  }, [narrator, speaks, key, text]);

  useEffect(() => () => narrator.release(), [narrator]);

  return {
    available,
    muted: current.muted,
    waiting: available && !current.allowed && !current.muted,
    toggle: () => setMuted(!current.muted),
  };
}
