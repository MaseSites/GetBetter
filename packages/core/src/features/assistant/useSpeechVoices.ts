import { useEffect, useState, useSyncExternalStore } from 'react';

import { useI18n, type Language } from '@/i18n';

import {
  CLOUD_PREFIX,
  cloudState,
  loadCloudVoices,
  onCloudChange,
  type CloudVoice,
} from './cloudVoice';
import { listVoices, onVoicesChanged, type SpeechVoice } from './speech';

function fromCloud(voice: CloudVoice, language: Language): SpeechVoice {
  return {
    uri: `${CLOUD_PREFIX}${voice.id}`,
    name: voice.name,
    label: voice.name,
    tag: language,
    local: false,
    tier: 'natural',
    provider: 'cloud',
    gender: voice.gender,
  };
}

/**
 * Die Stimmen, aus denen er sich eine aussuchen laesst — in der Sprache des
 * Kontos.
 *
 * Ist ElevenLabs im Dienst eingerichtet, stehen nur noch dessen Stimmen zur
 * Wahl: echt klingend statt blechern. Sonst die des Browsers. Die Liste des
 * Browsers ist beim ersten Rendern fast immer leer — Browser reichen die
 * Stimmen nach —, darum wird nachgehoert und neu gerendert.
 */
export function useSpeechVoices(): readonly SpeechVoice[] {
  const { language } = useI18n();
  const cloud = useSyncExternalStore(onCloudChange, cloudState, cloudState);
  const [browser, setBrowser] = useState<readonly SpeechVoice[]>(() => listVoices(language));

  useEffect(() => {
    let alive = true;
    const read = () => {
      if (alive) setBrowser(listVoices(language));
    };
    read();
    const stop = onVoicesChanged(read);
    void loadCloudVoices(language);
    return () => {
      alive = false;
      stop();
    };
  }, [language]);

  if (cloud.configured && cloud.voices.length > 0) {
    return cloud.voices.map((voice) => fromCloud(voice, language));
  }
  return browser;
}
