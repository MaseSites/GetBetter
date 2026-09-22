import type { TranslationKey } from './de';
import { enA } from './en-a';
import { enAvatar } from './en-avatar';
import { enB } from './en-b';
import { enBirthdays } from './en-birthdays';
import { enC } from './en-c';
import { enHome } from './en-home';
import { enMailUi } from './en-mailui';
import { enNotes } from './en-notes';
import { enPlan } from './en-plan';
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
  ...enHome,
  ...enVoice,
  ...enAvatar,
  ...enShell,
  ...enTasks,
  ...enNotes,
  ...enBirthdays,
  ...enWeather,
  ...enMailUi,
  ...enUi,
  ...enPlan,
};
