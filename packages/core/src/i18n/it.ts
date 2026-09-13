import type { TranslationKey } from './de';
import { itA } from './it-a';
import { itB } from './it-b';
import { itBirthdays } from './it-birthdays';
import { itC } from './it-c';
import { itMailUi } from './it-mailui';
import { itNotes } from './it-notes';
import { itShell } from './it-shell';
import { itTasks } from './it-tasks';
import { itUi } from './it-ui';
import { itVoice } from './it-voice';
import { itWeather } from './it-weather';

/** Italienisch, vollstaendig: jeder Schluessel aus `de`. Fehlt einer, meldet es der Typ. */
export const it: Readonly<Record<TranslationKey, string>> = {
  ...itA,
  ...itB,
  ...itC,
  ...itVoice,
  ...itShell,
  ...itTasks,
  ...itNotes,
  ...itBirthdays,
  ...itWeather,
  ...itMailUi,
  ...itUi,
};
