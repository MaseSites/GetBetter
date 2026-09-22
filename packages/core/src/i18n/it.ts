import type { TranslationKey } from './de';
import { itA } from './it-a';
import { itAvatar } from './it-avatar';
import { itB } from './it-b';
import { itBirthdays } from './it-birthdays';
import { itC } from './it-c';
import { itHome } from './it-home';
import { itMailUi } from './it-mailui';
import { itNotes } from './it-notes';
import { itFit } from './it-fit';
import { itFit2 } from './it-fit2';
import { itFit3 } from './it-fit3';
import { itFit4 } from './it-fit4';
import { itFit5 } from './it-fit5';
import { itFit6 } from './it-fit6';
import { itFit7 } from './it-fit7';
import { itFit8 } from './it-fit8';
import { itPlan } from './it-plan';
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
  ...itHome,
  ...itVoice,
  ...itAvatar,
  ...itShell,
  ...itTasks,
  ...itNotes,
  ...itBirthdays,
  ...itWeather,
  ...itMailUi,
  ...itUi,
  ...itPlan,
  ...itFit,
  ...itFit2,
  ...itFit3,
  ...itFit4,
  ...itFit5,
  ...itFit6,
  ...itFit7,
  ...itFit8,
};
