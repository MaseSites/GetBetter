import type { TranslationKey } from './de';
import { enA } from './en-a';
import { enAvatar } from './en-avatar';
import { enB } from './en-b';
import { enBirthdays } from './en-birthdays';
import { enC } from './en-c';
import { enHome } from './en-home';
import { enMailUi } from './en-mailui';
import { enNotes } from './en-notes';
import { enFit } from './en-fit';
import { enFit2 } from './en-fit2';
import { enFit3 } from './en-fit3';
import { enFit4 } from './en-fit4';
import { enFit5 } from './en-fit5';
import { enFit6 } from './en-fit6';
import { enFit7 } from './en-fit7';
import { enFit8 } from './en-fit8';
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
  ...enFit,
  ...enFit2,
  ...enFit3,
  ...enFit4,
  ...enFit5,
  ...enFit6,
  ...enFit7,
  ...enFit8,
};
