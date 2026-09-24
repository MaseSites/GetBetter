import { useEffect, useState, useSyncExternalStore } from 'react';

import { canSpeak, onSoundAllowed, soundAllowed } from '@/features/assistant/speech';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/AppContext';

import { Narrator } from './narrator';

/** Ob der Browser schon Ton erlaubt. Das tut er erst nach dem ersten Tipp auf der Seite. */
let allowed = soundAllowed();
const listeners = new Set<() => void>();
let started = false;

function subscribe(listener: () => void) {
  if (!started) {
    started = true;
    if (!allowed) {
      onSoundAllowed(() => {
        allowed = true;
        for (const each of listeners) each();
      });
    }
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): boolean {
  return allowed;
}

/**
 * Er sagt laut, was in seiner Blase steht — auf dem Startbildschirm, beim
 * Anmelden und beim Einrichten: einmal, wenn die Blase erscheint, und dann ist
 * Ruhe. Keinen Knopf zum Wiederholen oder Stummschalten. Ein neuer `key` heisst
 * ein neuer Satz; ein leerer `text` heisst still sein. Er spricht mit der
 * Stimme des Kontos, ohne Konto mit der besten, die der Browser hat.
 *
 * Im Browser gibt es Ton erst nach dem ersten Tipp auf der Seite — bis dahin
 * bleibt er still und sagt den Satz, der dann in der Blase steht.
 */
export function useNarration(key: string, text: string): void {
  const { language } = useI18n();
  const { personal } = useApp();
  const soundOk = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [narrator] = useState(() => new Narrator());
  // Ohne Abo die beste Stimme des Browsers.
  const voiceUri = personal.voice;
  const speaks = canSpeak() && soundOk && text.length > 0;

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
}
