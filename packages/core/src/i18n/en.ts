import type { TranslationKey } from './de';
import { enA } from './en-a';
import { enB } from './en-b';
import { enBirthdays } from './en-birthdays';
import { enC } from './en-c';
import { enMailUi } from './en-mailui';
import { enNotes } from './en-notes';
import { enShell } from './en-shell';
import { enTasks } from './en-tasks';
import { enUi } from './en-ui';
import { enVoice } from './en-voice';
import { enWeather } from './en-weather';

/** Englisch, vollstaendig: jeder Schluessel aus `de`. Fehlt einer, meldet es der Typ. */
export const en: Readonly<Record<TranslationKey, string>> = {
  ...enA,
  ...enB,
  ...enC,
  ...enVoice,
  ...enShell,
  ...enTasks,
  ...enNotes,
  ...enBirthdays,
  ...enWeather,
  ...enMailUi,
  ...enUi,
};
